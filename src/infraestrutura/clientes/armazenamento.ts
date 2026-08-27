import { createHmac, randomUUID } from "node:crypto";

import {
  BlobSASPermissions,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

import type {
  AutorizacaoEmitida,
  CredencialDeUpload,
  EmissorDeCredencialDeUpload,
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

type Conta = {
  nome: string;
  credencial: StorageSharedKeyCredential;
  endpoint: string;
};

let contaCompartilhada: Conta | null = null;

/**
 * Lê a conta da variável de execução.
 *
 * **A cadeia de conexão é analisada aqui, e não entregue ao SDK**, por uma razão prática: para assinar
 * é preciso `StorageSharedKeyCredential` explícito, e obtê-lo de um `BlobServiceClient` depende de um
 * campo cujo tipo é uma união de três credenciais. Ler três pares `chave=valor` é mais estável que
 * conviver com essa união.
 */
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

  const partes = new Map(
    cadeia
      .split(";")
      .map((par) => par.trim())
      .filter((par) => par !== "")
      .map((par) => {
        const corte = par.indexOf("=");
        return [par.slice(0, corte), par.slice(corte + 1)] as const;
      }),
  );

  const nome = partes.get("AccountName");
  const chave = partes.get("AccountKey");
  if (nome === undefined || chave === undefined) {
    throw new Error("ARMAZENAMENTO_CONEXAO sem AccountName ou AccountKey.");
  }

  contaCompartilhada = {
    nome,
    credencial: new StorageSharedKeyCredential(nome, chave),
    endpoint: partes.get("BlobEndpoint") ?? `https://${nome}.blob.core.windows.net`,
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

/** O que o ticket carrega, e é o que o item 13b vai conferir na reivindicação (contrato §10.2). */
type CargaDoTicket = {
  chave: string;
  chaveMiniatura: string;
  organizacaoId: string;
  pessoaId: string;
  tipoConteudo: string;
  tamanhoMaximo: number;
  expiraEm: string;
};

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

function assinarTicket(carga: CargaDoTicket): string {
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
