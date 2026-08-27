import { beforeEach, describe, expect, it } from "vitest";

import {
  AnexoAcimaDoLimite,
  AnexoNaoEncontrado,
  AnexoNaoReconhecido,
  type ArmazenamentoDeAnexos,
  type CargaDoTicketDeAnexo,
  type ObjetoDescrito,
} from "@/aplicacao/anexo";
import {
  OcorrenciaNaoEncontrada,
  podeLerOcorrencia,
  reivindicarAnexo,
  verAnexoDaOcorrencia,
  type RepositorioEscopadoDeOcorrencias,
} from "@/aplicacao/ocorrencia";
import { TIPO_DE_CONTEUDO_DA_MINIATURA } from "@/dominio/anexo";
import {
  criarArmazenamentoDeAnexos,
  criarEmissorDeCredencialDeUpload,
} from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  As seis conferências, uma a uma — contra um duplo
 * ============================================================================
 *
 * **Por que duplo e não Azurite.** As conferências são REGRA, e regra que só se testa contra o provedor
 * real é regra que ninguém exercita no laço curto. O adaptador é exercitado no teste de integração e no
 * passo manual; o que este arquivo prova é a decisão.
 */

const ORGANIZACAO = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const PESSOA = "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d";
const CHAVE = "anx_01JB8Z6K9T2M4N7Q";
const MINIATURA = "anx_01JB8Z6K9T2M4N7Q_mini";
const AGORA = "2026-08-27T13:00:00.000Z";

const cargaBoa = (): CargaDoTicketDeAnexo => ({
  chave: CHAVE,
  chaveMiniatura: MINIATURA,
  organizacaoId: ORGANIZACAO,
  pessoaId: PESSOA,
  tipoConteudo: "image/jpeg",
  tamanhoMaximo: 400_000,
  expiraEm: "2026-08-27T13:15:00.000Z",
});

const objetoBom = (): ObjetoDescrito => ({
  tipoConteudo: "image/jpeg",
  tamanhoBytes: 391_244,
  nomeArquivo: null,
  estado: "pendente",
});

const miniaturaBoa = (): ObjetoDescrito => ({
  tipoConteudo: TIPO_DE_CONTEUDO_DA_MINIATURA,
  tamanhoBytes: 14_302,
  nomeArquivo: null,
  estado: "pendente",
});

type Cenario = {
  carga: CargaDoTicketDeAnexo | null;
  objetos: Map<string, ObjetoDescrito>;
  /** Chaves cuja troca de etiqueta falha — `false`, não exceção. */
  confirmacaoFalha: Set<string>;
  /** Chaves cuja troca de etiqueta **estoura** — o outro modo de falha. */
  confirmacaoEstoura: Set<string>;
  confirmadas: string[];
};

let cenario: Cenario;

/** O duplo. **Nenhuma decisão aqui** — é o que a porta prometeu ser. */
const armazenamento = (): ArmazenamentoDeAnexos => ({
  conferirTicket: () => cenario.carga,
  descrever: async (chave) => cenario.objetos.get(chave) ?? null,
  marcarConfirmado: async (chave) => {
    if (cenario.confirmacaoEstoura.has(chave)) throw new Error("o storage caiu");
    if (cenario.confirmacaoFalha.has(chave)) return false;
    cenario.confirmadas.push(chave);
    return true;
  },
  urlDeLeitura: (chave) => `https://storage.invalido/anexos/${chave}?sig=falsa`,
});

const contexto = { organizacaoId: ORGANIZACAO, pessoaId: PESSOA, agora: AGORA };
const referencia = { chave: CHAVE, ticket: "eyJhbGciOiJIUzI1NiJ9.qualquer" };

const reivindicar = () => reivindicarAnexo(armazenamento(), contexto, referencia);

beforeEach(() => {
  cenario = {
    carga: cargaBoa(),
    objetos: new Map([
      [CHAVE, objetoBom()],
      [MINIATURA, miniaturaBoa()],
    ]),
    confirmacaoFalha: new Set(),
    confirmacaoEstoura: new Set(),
    confirmadas: [],
  };
});

describe("o caminho feliz", () => {
  it("devolve tipo, tipoConteudo e tamanhoBytes vindos do HEAD, não do que o cliente declarou", async () => {
    cenario.objetos.set(CHAVE, { ...objetoBom(), tamanhoBytes: 123_456 });

    const dados = await reivindicar();

    expect(dados).toMatchObject({
      tipo: "imagem",
      chave: CHAVE,
      thumbnailChave: MINIATURA,
      tipoConteudo: "image/jpeg",
      tamanhoBytes: 123_456,
      nomeArquivo: null,
      titulo: null,
      anexadoPorPessoaId: PESSOA,
      anexadoEm: AGORA,
    });
  });

  it("promove os DOIS objetos a confirmado", async () => {
    await reivindicar();
    expect(new Set(cenario.confirmadas)).toStrictEqual(new Set([CHAVE, MINIATURA]));
  });

  it("carrega o `titulo` quando o cliente o manda — o campo é aceito e gravado", async () => {
    const dados = await reivindicarAnexo(armazenamento(), contexto, {
      ...referencia,
      titulo: "Lâmpada da vaga 34",
    });
    expect(dados.titulo).toBe("Lâmpada da vaga 34");
  });

  it("lê `nomeArquivo` do Content-Disposition quando ele existir", async () => {
    cenario.objetos.set(CHAVE, { ...objetoBom(), nomeArquivo: "orcamento.pdf" });
    expect((await reivindicar()).nomeArquivo).toBe("orcamento.pdf");
  });
});

describe("as seis conferências, uma a uma", () => {
  it("1 · assinatura inválida", async () => {
    cenario.carga = null;
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("2 · portador de outra organização", async () => {
    cenario.carga = { ...cargaBoa(), organizacaoId: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8" };
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("2 · portador de outra Pessoa, na mesma organização", async () => {
    cenario.carga = { ...cargaBoa(), pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f" };
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("3 · ticket expirado", async () => {
    cenario.carga = { ...cargaBoa(), expiraEm: "2026-08-27T12:59:59.000Z" };
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("4 · a `chave` do corpo não é a do ticket", async () => {
    cenario.carga = { ...cargaBoa(), chave: "anx_outra_coisa" };
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("5 · o objeto não existe no storage", async () => {
    cenario.objetos.delete(CHAVE);
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("6 · o tipo real não é o autorizado", async () => {
    cenario.objetos.set(CHAVE, { ...objetoBom(), tipoConteudo: "image/png" });
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("6 · o objeto é maior que o teto do TICKET, e a recusa é a outra", async () => {
    cenario.objetos.set(CHAVE, { ...objetoBom(), tamanhoBytes: 400_001 });
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoAcimaDoLimite);
  });

  it("nenhuma recusa promove objeto nenhum", async () => {
    cenario.objetos.delete(CHAVE);
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
    expect(cenario.confirmadas).toStrictEqual([]);
  });
});

describe("a etiqueta aceita DOIS valores — e é o que salva a S-T7", () => {
  it("aceita `pendente`", async () => {
    await expect(reivindicar()).resolves.toMatchObject({ chave: CHAVE });
  });

  it("aceita `confirmado` — o reenvio depois de a etiqueta já ter sido trocada", async () => {
    // Ler o 13b.6 ao pé da letra devolveria `422` aqui, justamente onde o 13b.3 e a S-T7 exigem
    // `409 ANEXO_JA_REIVINDICADO`. Achado A-1 da spec.
    cenario.objetos.set(CHAVE, { ...objetoBom(), estado: "confirmado" });
    await expect(reivindicar()).resolves.toMatchObject({ chave: CHAVE });
  });

  it("recusa objeto SEM a etiqueta — é disto que o critério 13b.6 fala", async () => {
    cenario.objetos.set(CHAVE, { ...objetoBom(), estado: null });
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });

  it("recusa valor desconhecido de etiqueta", async () => {
    cenario.objetos.set(CHAVE, { ...objetoBom(), estado: "reciclado" });
    await expect(reivindicar()).rejects.toBeInstanceOf(AnexoNaoReconhecido);
  });
});

describe("a miniatura degrada para null e NUNCA derruba o registro", () => {
  it("miniatura ausente no storage", async () => {
    cenario.objetos.delete(MINIATURA);
    expect((await reivindicar()).thumbnailChave).toBeNull();
  });

  it("miniatura com tipo estranho", async () => {
    cenario.objetos.set(MINIATURA, { ...miniaturaBoa(), tipoConteudo: "image/jpeg" });
    expect((await reivindicar()).thumbnailChave).toBeNull();
  });

  it("miniatura sem etiqueta", async () => {
    cenario.objetos.set(MINIATURA, { ...miniaturaBoa(), estado: null });
    expect((await reivindicar()).thumbnailChave).toBeNull();
  });

  it("troca de etiqueta da miniatura que devolve false", async () => {
    cenario.confirmacaoFalha.add(MINIATURA);
    expect((await reivindicar()).thumbnailChave).toBeNull();
  });

  it("troca de etiqueta da miniatura que ESTOURA", async () => {
    cenario.confirmacaoEstoura.add(MINIATURA);
    expect((await reivindicar()).thumbnailChave).toBeNull();
  });

  it("a miniatura só é gravada se o HEAD E a troca passarem — prévia quebrada é pior que ausente", async () => {
    cenario.confirmacaoFalha.add(MINIATURA);
    const dados = await reivindicar();
    expect(dados.thumbnailChave).toBeNull();
    expect(dados.chave).toBe(CHAVE);
  });
});

describe("a falha ao confirmar o PRINCIPAL derruba tudo", () => {
  it("`false` na troca de etiqueta sobe como erro, e NÃO é 4xx", async () => {
    cenario.confirmacaoFalha.add(CHAVE);
    // Gravar a linha com o objeto ainda `pendente` faria a faxina apagar, em 24–48 h, a evidência de
    // uma ocorrência viva — o dano que a §10.3 diz ser o pior dos dois. Criar a ocorrência SEM o anexo
    // faria a pessoa sair da tela convencida de ter anexado. `500` é o único desfecho que não mente.
    await expect(reivindicar()).rejects.not.toBeInstanceOf(AnexoNaoReconhecido);
    await expect(reivindicar()).rejects.toThrow(/etiqueta/iu);
  });

  it("exceção na troca de etiqueta também sobe", async () => {
    cenario.confirmacaoEstoura.add(CHAVE);
    await expect(reivindicar()).rejects.toThrow();
  });
});

describe("a leitura do anexo — o 302, e a chave que nunca sai daqui", () => {
  const OCORRENCIA = "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";
  const ANEXO = "c3d4e5f6-7a8b-4c9d-8e0f-1a2b3c4d5e6f";
  const AUTOR = { pessoaId: PESSOA, nome: "Helena Rocha" };

  const repositorio = (opcoes: {
    ocorrencia?: unknown;
    objeto?: { chave: string; thumbnailChave: string | null } | null;
  }) =>
    ({
      // **`in` e não `??`**: o caso da ocorrência inalcançável injeta `null` de propósito, e o `??` o
      // trataria como ausente — devolvendo a ocorrência padrão e provando o contrário do que o caso diz.
      porId: async () => ("ocorrencia" in opcoes ? opcoes.ocorrencia : { id: OCORRENCIA, autor: AUTOR }),
      objetoDoAnexo: async () => opcoes.objeto ?? null,
    }) as unknown as RepositorioEscopadoDeOcorrencias;

  const eu = { pessoaId: PESSOA, podeLerTodas: false };
  const outro = { pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f", podeLerTodas: false };
  const gestor = { pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f", podeLerTodas: true };

  const pedido = { ocorrenciaId: OCORRENCIA, anexoId: ANEXO, variante: "original" as const };

  it("o autor recebe a URL assinada do objeto principal", async () => {
    const url = await verAnexoDaOcorrencia(
      repositorio({ objeto: { chave: CHAVE, thumbnailChave: MINIATURA } }),
      armazenamento(),
      eu,
      pedido,
    );
    expect(url).toBe(`https://storage.invalido/anexos/${CHAVE}?sig=falsa`);
  });

  it("`?variante=miniatura` é a MESMA operação, com a mesma autorização", async () => {
    const url = await verAnexoDaOcorrencia(
      repositorio({ objeto: { chave: CHAVE, thumbnailChave: MINIATURA } }),
      armazenamento(),
      eu,
      { ...pedido, variante: "miniatura" },
    );
    expect(url).toBe(`https://storage.invalido/anexos/${MINIATURA}?sig=falsa`);
  });

  it("miniatura ausente é 404 ANEXO_NAO_ENCONTRADO, e não o objeto principal", async () => {
    await expect(
      verAnexoDaOcorrencia(
        repositorio({ objeto: { chave: CHAVE, thumbnailChave: null } }),
        armazenamento(),
        eu,
        { ...pedido, variante: "miniatura" },
      ),
    ).rejects.toBeInstanceOf(AnexoNaoEncontrado);
  });

  it("anexo que não é desta ocorrência é 404 ANEXO_NAO_ENCONTRADO", async () => {
    await expect(
      verAnexoDaOcorrencia(repositorio({ objeto: null }), armazenamento(), eu, pedido),
    ).rejects.toBeInstanceOf(AnexoNaoEncontrado);
  });

  it("ocorrência inalcançável é 404 OCORRENCIA_NAO_ENCONTRADA — e nem chega a ler o anexo", async () => {
    await expect(
      verAnexoDaOcorrencia(repositorio({ ocorrencia: null }), armazenamento(), eu, pedido),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });

  it("quem não é autor nem Gestor recebe o MESMO 404 da ocorrência, nunca 403", async () => {
    // §6.3: não confirmar a existência do que você não pode alcançar.
    await expect(
      verAnexoDaOcorrencia(
        repositorio({ objeto: { chave: CHAVE, thumbnailChave: null } }),
        armazenamento(),
        outro,
        pedido,
      ),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });

  it("o Gestor alcança o anexo de ocorrência de que não é autor", async () => {
    await expect(
      verAnexoDaOcorrencia(
        repositorio({ objeto: { chave: CHAVE, thumbnailChave: null } }),
        armazenamento(),
        gestor,
        pedido,
      ),
    ).resolves.toContain(CHAVE);
  });
});

describe("`podeLerOcorrencia` — a regra que estava escrita duas vezes", () => {
  const lida = { autor: { pessoaId: PESSOA } };

  it("o autor pode", () => {
    expect(podeLerOcorrencia(lida, { pessoaId: PESSOA, podeLerTodas: false })).toBe(true);
  });

  it("quem tem `ler_todas` pode, mesmo sem ser autor", () => {
    expect(podeLerOcorrencia(lida, { pessoaId: "outro", podeLerTodas: true })).toBe(true);
  });

  it("mais ninguém", () => {
    expect(podeLerOcorrencia(lida, { pessoaId: "outro", podeLerTodas: false })).toBe(false);
  });
});

/**
 * ============================================================================
 *  O ida e volta do ticket — o único par desta fatia em que um duplo não prova nada
 * ============================================================================
 *
 * Um ticket falso conferido por um verificador falso é tautologia: só o par REAL prova que o que o 13a
 * assina é o que o 13b lê. E ele não toca a rede — assinar e conferir são HMAC puro —, então roda no laço
 * curto como qualquer teste de aplicação. **É por isto que este bloco está aqui e não num terceiro
 * arquivo:** o DoD conta arquivos de teste novos, e a spec fixou dois.
 */
describe("o ticket que o 13a assina é o que o 13b lê", () => {
  const CONEXAO =
    "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;" +
    "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
    "BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

  beforeEach(() => {
    process.env.SEGREDO_DE_SESSAO = "um-segredo-de-teste-com-mais-de-32-caracteres";
    process.env.ARMAZENAMENTO_CONEXAO = CONEXAO;
  });

  it("devolve a carga inteira", async () => {
    const emitida = await criarEmissorDeCredencialDeUpload().emitir({
      organizacaoId: ORGANIZACAO,
      pessoaId: PESSOA,
      tipoConteudo: "image/jpeg",
      tamanhoBytes: 400_000,
    });

    const carga = criarArmazenamentoDeAnexos().conferirTicket(emitida.ticket);

    expect(carga).toMatchObject({
      chave: emitida.chave,
      chaveMiniatura: emitida.chaveMiniatura,
      organizacaoId: ORGANIZACAO,
      pessoaId: PESSOA,
      tipoConteudo: "image/jpeg",
      tamanhoMaximo: 400_000,
    });
  });

  it("recusa ticket adulterado — a carga trocada não bate com a assinatura", async () => {
    const emitida = await criarEmissorDeCredencialDeUpload().emitir({
      organizacaoId: ORGANIZACAO,
      pessoaId: PESSOA,
      tipoConteudo: "image/jpeg",
      tamanhoBytes: 400_000,
    });

    const [, assinatura] = emitida.ticket.split(".");
    const forjada = Buffer.from(
      JSON.stringify({ ...cargaBoa(), tamanhoMaximo: 99_000_000 }),
      "utf8",
    ).toString("base64url");

    expect(criarArmazenamentoDeAnexos().conferirTicket(`${forjada}.${assinatura!}`)).toBeNull();
  });

  it("recusa lixo sem estourar", () => {
    const armazem = criarArmazenamentoDeAnexos();
    expect(armazem.conferirTicket("")).toBeNull();
    expect(armazem.conferirTicket("sem-ponto")).toBeNull();
    expect(armazem.conferirTicket("a.b.c.d")).toBeNull();
  });

  it("a SAS de leitura aponta para o contêiner `anexos` e não é a de escrita", () => {
    const url = criarArmazenamentoDeAnexos().urlDeLeitura("anx_qualquer");
    expect(url).toContain("/anexos/anx_qualquer?");
    // `sp=r` — leitura, e só. A SAS de escrita do 13a é `cwt`.
    expect(url).toMatch(/[?&]sp=r(&|$)/u);
  });
});
