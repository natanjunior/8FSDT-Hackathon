import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

import type {
  ArmazenamentoDeAnexos,
  AutorizacaoEmitida,
  CargaDoTicketDeAnexo,
  CredencialDeUpload,
  EmissorDeCredencialDeUpload,
  ObjetoDescrito,
  PedidoDeAutorizacao,
} from "@/aplicacao/anexo";
import { TIPO_DE_CONTEUDO_DA_MINIATURA } from "@/dominio/anexo";

/**
 * ============================================================================
 *  O cliente de storage. **Terceiro e último arquivo do repositório autorizado
 *  a importar um SDK** — ADR-0006, regra de lint 1. `@azure/*` já estava na
 *  lista de SDKs do `eslint.config.mjs` desde o esqueleto.
 * ============================================================================
 *
 * Implementa `EmissorDeCredencialDeUpload`, e **o servidor nunca se conecta ao storage por aqui**: ele
 * calcula uma assinatura. Não há ida e voltas de rede no caminho quente da autorização — é o que faz o
 * endpoint caber no orçamento de 60 segundos do RNF6 e não consumir franquia de vCPU-s (ADR-0004).
 *
 * **O ticket mora aqui junto com a SAS, e não é mistura.** Ele existe por uma razão só: tornar o upload
 * **verificável na hora de reivindicar**, sem tabela de uploads pendentes (contrato §10.2). SAS e ticket
 * são as duas metades de um mecanismo; separá-las poria metade de uma decisão em cada módulo.
 *
 * **`conferirTicket` é do item 13b** e nasce neste arquivo, ao lado de `assinarTicket` — é onde a
 * reivindicação vai conferir assinatura, portador e validade.
 */

/** Um contêiner só, e o nome é o mesmo em todo ambiente. Ele não é configuração — é parte do desenho. */
const CONTEINER = "anexos";

/** Quinze minutos: a validade da SAS e a do ticket são a mesma janela (contrato §10.2). */
const VALIDADE_EM_MINUTOS = 15;

/** Dez minutos: a SAS de leitura vive menos que o ticket, e a razão está no contrato §10.4 — uma vez
 *  emitida, a URL vale para quem a tiver. TTL curto é a mitigação, junto do `Referrer-Policy`. */
const VALIDADE_DE_LEITURA_EM_MINUTOS = 10;

type Conta = {
  nome: string;
  credencial: StorageSharedKeyCredential;
  endpoint: string;
};

let contaCompartilhada: Conta | null = null;

/**
 * Os pares `chave=valor` da cadeia, sem interpretar nenhum deles.
 *
 * **A cadeia de conexão é analisada aqui, e não entregue ao SDK**, por uma razão prática: para assinar
 * é preciso `StorageSharedKeyCredential` explícito, e obtê-lo de um `BlobServiceClient` depende de um
 * campo cujo tipo é uma união de três credenciais. Ler três pares `chave=valor` é mais estável que
 * conviver com essa união.
 */
function camposDaCadeia(cadeia: string): Map<string, string> {
  return new Map(
    cadeia
      .split(";")
      .map((par) => par.trim())
      .filter((par) => par !== "")
      .map((par) => {
        const corte = par.indexOf("=");
        return [par.slice(0, corte), par.slice(corte + 1)] as const;
      }),
  );
}

/**
 * O endereço de blob que a cadeia declara, **sem a barra final** — e é o conserto do V-13.
 *
 * `az storage account show-connection-string` devolve `BlobEndpoint` terminado em barra, e os três
 * consumidores do endpoint neste arquivo concatenam com `/`: a URL do `PUT`, a de leitura e o
 * `new BlobServiceClient(endpoint, …)` de `blob()`, que serve `descrever` e `marcarConfirmado`. Sem
 * normalizar, a URL sai com barra dupla, o contêiner vira vazio e o `PUT` do navegador morre em falha de
 * rede — sem resposta, e por isso sem código de erro que a tela pudesse explicar.
 *
 * **É pura, e sai pelo `index.ts` devolvendo `string`**: a `Conta` carrega `StorageSharedKeyCredential`, e
 * tipo de SDK não atravessa a superfície pública.
 */
export function enderecoDaCadeia(cadeia: string): string {
  const partes = camposDaCadeia(cadeia);
  const declarado = partes.get("BlobEndpoint");
  const bruto =
    declarado === undefined || declarado === ""
      ? `https://${partes.get("AccountName") ?? ""}.blob.core.windows.net`
      : declarado;

  return bruto.replace(/\/+$/u, "");
}

/** Lê a conta da variável de execução, uma vez por processo. */
function conta(): Conta {
  if (contaCompartilhada !== null) return contaCompartilhada;

  const cadeia = process.env.ARMAZENAMENTO_CONEXAO;
  if (cadeia === undefined || cadeia === "") {
    throw new Error(
      "ARMAZENAMENTO_CONEXAO não está definida. Em produção ela chega como secret do Container App, em " +
        "tempo de execução — nunca como ARG de build (ADR-0004: a imagem é pública). Localmente ela vem " +
        "do `npm run local`, apontando para o Azurite.",
    );
  }

  const partes = camposDaCadeia(cadeia);
  const nome = partes.get("AccountName");
  const chave = partes.get("AccountKey");
  if (nome === undefined || chave === undefined) {
    throw new Error("ARMAZENAMENTO_CONEXAO sem AccountName ou AccountKey.");
  }

  contaCompartilhada = {
    nome,
    credencial: new StorageSharedKeyCredential(nome, chave),
    endpoint: enderecoDaCadeia(cadeia),
  };

  return contaCompartilhada;
}

/**
 * A chave do objeto: **opaca, sem caminho com significado e sem nome de contêiner** (modelo §2.8).
 *
 * A plataforma de storage já mudou uma vez neste projeto; com chave opaca, trocar de provedor não toca o
 * banco. O sufixo `_mini` segue o exemplo publicado no `openapi.yaml` e é o que garante que as duas chaves
 * sejam distintas — o `UNIQUE (chave)` de `anexos` recusa que sejam iguais.
 */
function novaChave(): { chave: string; chaveMiniatura: string } {
  const chave = `anx_${randomUUID().replaceAll("-", "")}`;
  return { chave, chaveMiniatura: `${chave}_mini` };
}

/**
 * O destino de um `PUT`.
 *
 * **A permissão inclui `t` (etiqueta), e é o que torna a §10.3 implementável.** Na emissão o objeto ainda
 * não existe, então não há o que o servidor etiquete: quem escreve `estado=pendente` é o `PUT` do cliente,
 * pelo cabeçalho `x-ms-tags`. Sem a permissão de etiqueta na SAS, o storage recusaria o cabeçalho e todo
 * objeto nasceria sem marca — invisível para a regra de ciclo de vida, que filtra por etiqueta **igual a
 * valor** e não por ausência dela.
 */
function destino(chave: string, tipoConteudo: string, expiraEm: Date): CredencialDeUpload {
  const { credencial, endpoint } = conta();

  const parametros = generateBlobSASQueryParameters(
    {
      containerName: CONTEINER,
      blobName: chave,
      permissions: BlobSASPermissions.parse("cwt"),
      expiresOn: expiraEm,
      protocol: endpoint.startsWith("https://") ? SASProtocol.Https : SASProtocol.HttpsAndHttp,
    },
    credencial,
  ).toString();

  return {
    url: `${endpoint}/${CONTEINER}/${chave}?${parametros}`,
    metodo: "PUT",
    cabecalhos: {
      "x-ms-blob-type": "BlockBlob",
      "x-ms-blob-content-type": tipoConteudo,
      "x-ms-tags": "estado=pendente",
    },
    expiraEm: expiraEm.toISOString(),
  };
}

/** A carga é declarada pela Aplicação, que é quem a consome. Aqui só se assina e se confere — **um tipo
 *  só nas duas pontas do HMAC** (contrato §10.2). */
type Carga = CargaDoTicketDeAnexo;

/**
 * A chave de assinatura do ticket, **derivada** do segredo de sessão em vez de reutilizá-lo.
 *
 * Uma variável nova para isto seria a sexta, e o custo não se paga; usar a mesma chave para dois tipos de
 * token seria pior — a separação de domínio abaixo custa uma linha e impede que uma assinatura de um valha
 * como assinatura do outro.
 */
function chaveDoTicket(): Buffer {
  const segredo = process.env.SEGREDO_DE_SESSAO;
  if (segredo === undefined || segredo.length < 32) {
    throw new Error(
      "SEGREDO_DE_SESSAO ausente ou curta demais (mínimo 32 caracteres) — o ticket de anexo assina com " +
        "uma chave derivada dela.",
    );
  }
  return createHmac("sha256", segredo).update("ticket-de-anexo/v1").digest();
}

function assinarTicket(carga: Carga): string {
  const corpo = Buffer.from(JSON.stringify(carga)).toString("base64url");
  const assinatura = createHmac("sha256", chaveDoTicket()).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

/**
 * O emissor.
 *
 * **Uma autorização, dois destinos, um ticket, um slot do limite.** Duas autorizações separadas
 * consumiriam duas idas e voltas dentro do orçamento de 60 segundos do RNF6, e dois slots das 30/h.
 */
export function criarEmissorDeCredencialDeUpload(): EmissorDeCredencialDeUpload {
  return {
    async emitir(pedido: PedidoDeAutorizacao): Promise<AutorizacaoEmitida> {
      const { chave, chaveMiniatura } = novaChave();
      const expiraEm = new Date(Date.now() + VALIDADE_EM_MINUTOS * 60 * 1000);

      const ticket = assinarTicket({
        chave,
        chaveMiniatura,
        organizacaoId: pedido.organizacaoId,
        pessoaId: pedido.pessoaId,
        tipoConteudo: pedido.tipoConteudo,
        tamanhoMaximo: pedido.tamanhoBytes,
        expiraEm: expiraEm.toISOString(),
      });

      return {
        chave,
        chaveMiniatura,
        ticket,
        upload: destino(chave, pedido.tipoConteudo, expiraEm),
        uploadMiniatura: destino(chaveMiniatura, TIPO_DE_CONTEUDO_DA_MINIATURA, expiraEm),
      };
    },
  };
}

/**
 * ============================================================================
 *  O adaptador de objeto — o outro lado do ticket
 * ============================================================================
 *
 * **Ele não decide nada**, e é o que a spec do 13b §3.4 chama de porta burra: descreve, troca etiqueta e
 * assina. As seis conferências são da Aplicação, e é lá que elas se testam com duplo.
 *
 * **`conferirTicket` não toca a conta de storage** — é HMAC puro —, e é por isso que `conta()` só é
 * chamada dentro dos outros três métodos. Quem só confere ticket não precisa de `ARMAZENAMENTO_CONEXAO`.
 */
export function criarArmazenamentoDeAnexos(): ArmazenamentoDeAnexos {
  function blob(chave: string) {
    const { credencial, endpoint } = conta();
    return new BlobServiceClient(endpoint, credencial)
      .getContainerClient(CONTEINER)
      .getBlobClient(chave);
  }

  return {
    conferirTicket(ticket) {
      const partes = ticket.split(".");
      if (partes.length !== 2) return null;

      const [corpo, assinatura] = partes;
      if (corpo === undefined || assinatura === undefined || corpo === "") return null;

      const esperada = createHmac("sha256", chaveDoTicket()).update(corpo).digest("base64url");
      // **Comparação de tempo constante**: `timingSafeEqual` recusa buffers de tamanhos diferentes, então
      // o tamanho é conferido antes — e um tamanho diferente já é assinatura errada.
      const a = Buffer.from(assinatura, "utf8");
      const b = Buffer.from(esperada, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

      try {
        return JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as Carga;
      } catch {
        // Assinatura válida com corpo ilegível é impossível por construção — mas ler JSON de um valor
        // vindo de fora nunca estoura em silêncio.
        return null;
      }
    },

    /**
     * **`HEAD` e etiquetas em paralelo, devolvidos como um fato só.**
     *
     * No Azure são duas chamadas: `getProperties` traz tamanho, tipo e `Content-Disposition`, e só
     * `getTags` traz o **valor** da etiqueta (`x-ms-tag-count` diz que há etiqueta, não qual). Separá-las
     * na porta obrigaria a Aplicação a sequenciá-las.
     *
     * **Objeto ausente é `null`, não exceção** — é um desfecho normal do caminho de reivindicação, e a
     * porta prometeu `null`.
     */
    async descrever(chave) {
      const cliente = blob(chave);

      const [propriedades, etiquetas] = await Promise.all([
        cliente.getProperties().catch(() => null),
        cliente.getTags().catch(() => null),
      ]);

      if (propriedades === null) return null;

      const descrito: ObjetoDescrito = {
        tipoConteudo: propriedades.contentType ?? null,
        tamanhoBytes: propriedades.contentLength ?? 0,
        nomeArquivo: nomeDoContentDisposition(propriedades.contentDisposition ?? null),
        estado: etiquetas?.tags.estado ?? null,
      };

      return descrito;
    },

    /**
     * A troca de etiqueta — **uma chamada de metadado**. Não move bytes, e portanto não desfaz a razão de
     * a §10.1 do contrato ter escolhido SAS.
     *
     * **`setTags` substitui o conjunto inteiro**, e é o comportamento certo aqui: `estado` é a única
     * etiqueta que este produto escreve.
     */
    async marcarConfirmado(chave) {
      try {
        await blob(chave).setTags({ estado: "confirmado" });
        return true;
      } catch {
        return false;
      }
    },

    /**
     * A SAS de **leitura**, de 10 minutos. `sp=r` e mais nada — a de escrita do 13a é `cwt`, e dar `w`
     * aqui deixaria qualquer leitor sobrescrever a evidência.
     */
    urlDeLeitura(chave) {
      const { credencial, endpoint } = conta();
      const expiraEm = new Date(Date.now() + VALIDADE_DE_LEITURA_EM_MINUTOS * 60 * 1000);

      const parametros = generateBlobSASQueryParameters(
        {
          containerName: CONTEINER,
          blobName: chave,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn: expiraEm,
          protocol: endpoint.startsWith("https://") ? SASProtocol.Https : SASProtocol.HttpsAndHttp,
        },
        credencial,
      ).toString();

      return `${endpoint}/${CONTEINER}/${chave}?${parametros}`;
    },
  };
}

/**
 * `Content-Disposition: attachment; filename="x.jpg"` → `x.jpg`.
 *
 * **Pelo nosso cliente isto é sempre `null`**: `controle-de-foto.tsx` não escreve o cabeçalho, e não vai
 * passar a escrever — o arquivo é recomprimido no aparelho, então o nome original é resíduo de outro
 * arquivo (modelo §6.16 recusou `nome_original` por isso). A leitura existe porque o `HEAD` já a traz de
 * graça e porque o contrato declara a coluna.
 */
function nomeDoContentDisposition(cabecalho: string | null): string | null {
  if (cabecalho === null) return null;
  const achado = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/iu.exec(cabecalho);
  const nome = achado?.[1]?.trim();
  return nome === undefined || nome === "" ? null : nome;
}
