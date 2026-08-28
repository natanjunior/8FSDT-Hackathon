import { describe, expect, it } from "vitest";

import {
  AnexoDaOcorrencia,
  comandosDisponiveis,
  COMANDOS_IMPLEMENTADOS,
  Ocorrencia,
  RegistroDeTransicao,
  transicaoPermitida,
} from "@/dominio/ocorrencia";

/**
 * ============================================================================
 *  O grupo 1 da ADR-0008 — exaustivo, em memória, em milissegundos
 * ============================================================================
 *
 * É aqui que o volume vai, e é aqui que os sete itens do lote 6 vão acrescentar casos **sem arquivo
 * novo**. O agregado não persiste (ADR-0005), e é isso que torna este grupo barato.
 */

const REGISTRO = {
  titulo: "Lâmpada queimada na garagem",
  descricao: "Queimada faz três dias, corredor escuro.",
  categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
  areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
  areaTipo: "comum" as const,
  localizacaoComplemento: "ao lado da vaga 34",
  autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
  ocorreuEm: "2026-08-25T13:02:11.000Z",
};

describe("Ocorrencia.registrar", () => {
  it("nasce aberta e normal — os dois escritos pelo agregado, nunca pelo cliente", () => {
    const ocorrencia = Ocorrencia.registrar(REGISTRO);

    expect(ocorrencia.status).toBe("aberta");
    expect(ocorrencia.prioridade).toBe("normal");
  });

  it("grava exatamente UM registro de transição — a invariante 2", () => {
    expect(Ocorrencia.registrar(REGISTRO).trilha).toHaveLength(1);
  });

  it("o primeiro registro tem statusAnterior nulo e sequencia 1 — a premissa P1", () => {
    const [primeiro] = Ocorrencia.registrar(REGISTRO).trilha;

    expect(primeiro?.statusAnterior).toBeNull();
    expect(primeiro?.statusNovo).toBe("aberta");
    expect(primeiro?.sequencia).toBe(1);
  });

  it("o registro carrega os cinco campos do enunciado", () => {
    const [primeiro] = Ocorrencia.registrar(REGISTRO).trilha;

    // status anterior · novo status · data e horário · autor da transição · observação
    expect(primeiro?.statusAnterior).toBeNull();
    expect(primeiro?.statusNovo).toBe("aberta");
    expect(primeiro?.ocorreuEm).toBe("2026-08-25T13:02:11.000Z");
    expect(primeiro?.autorPessoaId).toBe(REGISTRO.autorPessoaId);
    expect(primeiro?.observacao).toBeNull();
  });

  it("congela o tipo da área no instante do registro", () => {
    expect(Ocorrencia.registrar({ ...REGISTRO, areaTipo: "privativa" }).areaTipo).toBe("privativa");
  });

  it("a trilha é imutável — mexer no que sai não mexe no agregado", () => {
    const ocorrencia = Ocorrencia.registrar(REGISTRO);
    const roubada = ocorrencia.trilha as unknown as unknown[];

    expect(() => roubada.push({})).toThrow();
    expect(ocorrencia.trilha).toHaveLength(1);
  });
});

describe("a máquina de estados — a tabela da arquitetura.md §4", () => {
  it.each([
    ["aberta", "analisar"],
    ["aberta", "cancelar"],
    ["em_analise", "iniciar-atendimento"],
    ["em_analise", "pausar"],
    ["em_analise", "cancelar"],
    ["em_atendimento", "resolver"],
    ["em_atendimento", "pausar"],
    ["em_atendimento", "cancelar"],
    ["pausada", "retomar"],
    ["pausada", "cancelar"],
  ] as const)("%s aceita %s", (status, comando) => {
    expect(transicaoPermitida(status, comando)).toBe(true);
  });

  it.each([
    // **A transição inválida que o DoD cobra.** Resolver exige passar por
    // `em_atendimento`; de `aberta` não sai.
    ["aberta", "resolver"],
    ["aberta", "iniciar-atendimento"],
    ["aberta", "retomar"],
    ["em_analise", "resolver"],
    ["resolvida", "analisar"],
    ["resolvida", "cancelar"],
    ["cancelada", "analisar"],
    ["cancelada", "cancelar"],
  ] as const)("%s recusa %s", (status, comando) => {
    expect(transicaoPermitida(status, comando)).toBe(false);
  });

  it("resolvida e cancelada são poços — não sai transição nenhuma delas (D24)", () => {
    for (const terminal of ["resolvida", "cancelada"] as const) {
      const saidas = (
        ["analisar", "iniciar-atendimento", "pausar", "retomar", "resolver", "cancelar"] as const
      ).filter((comando) => transicaoPermitida(terminal, comando));
      expect(saidas).toStrictEqual([]);
    }
  });
});

describe("comandosDisponiveis", () => {
  const TODAS = [
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.alterar_prioridade",
    "ocorrencia.cancelar_qualquer",
  ];

  it("hoje devolve vazia, porque COMANDOS_IMPLEMENTADOS está vazia", () => {
    expect(COMANDOS_IMPLEMENTADOS).toStrictEqual([]);
    expect(
      comandosDisponiveis({ status: "aberta", permissoes: TODAS, ehAutor: false }),
    ).toStrictEqual([]);
  });

  /**
   * **A derivação é real, e é isto que prova.** Se ela fosse `[]` chumbado, este teste passaria com o
   * filtro desligado e continuaria passando com a lista cheia — e os itens 16 a 27 descobririam tarde
   * que não havia derivação nenhuma.
   */
  it("com o filtro desligado, deriva de verdade da tabela × permissões", () => {
    const semFiltro = { status: "aberta" as const, permissoes: TODAS, ehAutor: false, filtro: null };

    expect(comandosDisponiveis(semFiltro)).toStrictEqual([
      "analisar",
      "atribuir-responsavel",
      "alterar-prioridade",
      "cancelar",
    ]);
  });

  it("sai na ordem do enum Comando — os que movem adiante primeiro, cancelar por último", () => {
    const emAtendimento = comandosDisponiveis({
      status: "em_atendimento",
      permissoes: ["ocorrencia.pausar", "ocorrencia.resolver", "ocorrencia.cancelar_qualquer"],
      ehAutor: false,
      filtro: null,
    });

    expect(emAtendimento).toStrictEqual(["pausar", "resolver", "cancelar"]);
  });

  it("o Solicitante autor em aberta só pode cancelar a própria", () => {
    expect(
      comandosDisponiveis({
        status: "aberta",
        permissoes: ["ocorrencia.registrar", "ocorrencia.cancelar_propria"],
        ehAutor: true,
        filtro: null,
      }),
    ).toStrictEqual(["cancelar"]);
  });

  it("quem não é autor e só tem cancelar_propria não pode cancelar", () => {
    expect(
      comandosDisponiveis({
        status: "aberta",
        permissoes: ["ocorrencia.registrar", "ocorrencia.cancelar_propria"],
        ehAutor: false,
        filtro: null,
      }),
    ).toStrictEqual([]);
  });

  it("em cancelada a lista é vazia para todo mundo, e vazia é resposta legítima", () => {
    expect(
      comandosDisponiveis({ status: "cancelada", permissoes: TODAS, ehAutor: true, filtro: null }),
    ).toStrictEqual([]);
  });

  it("atribuir-responsavel é recusado nos dois terminais (contrato §8.4)", () => {
    for (const terminal of ["resolvida", "cancelada"] as const) {
      expect(
        comandosDisponiveis({
          status: terminal,
          permissoes: ["ocorrencia.atribuir"],
          ehAutor: false,
          filtro: null,
        }),
      ).toStrictEqual([]);
    }
  });

  it("registrar-solucao-aplicada só sai de em_atendimento e pausada", () => {
    const permissoes = ["ocorrencia.registrar_solucao"];
    const de = (status: "aberta" | "em_analise" | "em_atendimento" | "pausada" | "resolvida") =>
      comandosDisponiveis({ status, permissoes, ehAutor: false, filtro: null });

    expect(de("em_atendimento")).toStrictEqual(["registrar-solucao-aplicada"]);
    expect(de("pausada")).toStrictEqual(["registrar-solucao-aplicada"]);
    expect(de("aberta")).toStrictEqual([]);
    expect(de("em_analise")).toStrictEqual([]);
    expect(de("resolvida")).toStrictEqual([]);
  });

  it("avaliar só em resolvida, só do autor, e some depois de avaliada (invariante 8)", () => {
    const base = { permissoes: ["ocorrencia.avaliar"], filtro: null };

    expect(comandosDisponiveis({ ...base, status: "resolvida", ehAutor: true })).toStrictEqual([
      "avaliar",
    ]);
    expect(comandosDisponiveis({ ...base, status: "resolvida", ehAutor: false })).toStrictEqual([]);
    expect(comandosDisponiveis({ ...base, status: "em_analise", ehAutor: true })).toStrictEqual([]);
    expect(
      comandosDisponiveis({ ...base, status: "resolvida", ehAutor: true, jaAvaliada: true }),
    ).toStrictEqual([]);
  });

  it("alterar-prioridade é congelada nos terminais (invariante 7, D6)", () => {
    const base = { permissoes: ["ocorrencia.alterar_prioridade"], ehAutor: false, filtro: null };

    expect(comandosDisponiveis({ ...base, status: "aberta" })).toStrictEqual(["alterar-prioridade"]);
    expect(comandosDisponiveis({ ...base, status: "resolvida" })).toStrictEqual([]);
    expect(comandosDisponiveis({ ...base, status: "cancelada" })).toStrictEqual([]);
  });
});

describe("o anexo é filho do agregado, não vizinho dele", () => {
  const dadosDoAnexo = {
    tipo: "imagem" as const,
    chave: "anx_01JB8Z6K9T2M4N7Q",
    thumbnailChave: "anx_01JB8Z6K9T2M4N7Q_mini",
    nomeArquivo: null,
    titulo: null,
    tipoConteudo: "image/jpeg",
    tamanhoBytes: 391_244,
    anexadoPorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
    anexadoEm: "2026-08-27T13:02:11.000Z",
  };

  const base = {
    titulo: "Lâmpada queimada na garagem",
    descricao: "Está escuro à noite.",
    categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
    areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
    areaTipo: "comum" as const,
    localizacaoComplemento: null,
    autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
    ocorreuEm: "2026-08-27T13:02:11.000Z",
  };

  it("sem anexo, a lista é vazia — nunca indefinida", () => {
    expect(Ocorrencia.registrar(base).anexos).toStrictEqual([]);
  });

  it("com anexo, o agregado o carrega inteiro", () => {
    const ocorrencia = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] });

    expect(ocorrencia.anexos).toHaveLength(1);
    expect(ocorrencia.anexos[0]).toMatchObject({
      tipo: "imagem",
      chave: "anx_01JB8Z6K9T2M4N7Q",
      thumbnailChave: "anx_01JB8Z6K9T2M4N7Q_mini",
      tipoConteudo: "image/jpeg",
      tamanhoBytes: 391_244,
    });
  });

  it("a lista é congelada — não se acrescenta anexo por fora do comando", () => {
    const ocorrencia = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] });
    // Mesma invariante 3 da trilha, aplicada à outra filha do agregado.
    expect(() => (ocorrencia.anexos as AnexoDaOcorrencia[]).push(ocorrencia.anexos[0]!)).toThrow();
  });

  it("o anexo em si é imutável", () => {
    const anexo = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] }).anexos[0]!;
    expect(Object.isFrozen(anexo)).toBe(true);
  });

  it("anexar NÃO produz registro de transição — a trilha não conhece anexo", () => {
    const ocorrencia = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] });
    // `contrato-de-api.md` §8.8: "o RegistroDeTransicao não muda, e é bom que continue assim".
    expect(ocorrencia.trilha).toHaveLength(1);
    expect(ocorrencia.trilha[0]!.statusAnterior).toBeNull();
  });
});

/**
 * ============================================================================
 *  O agregado volta do banco, e executa um comando — o item 16
 * ============================================================================
 *
 * **É a primeira transição do produto.** Até aqui o agregado sabia nascer e a máquina de estados sabia
 * responder perguntas; ninguém sabia executar um comando sobre ocorrência que já existe.
 */
describe("Ocorrencia.reconstituir e o comando analisar", () => {
  const GESTOR = "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f";

  const ABERTA = {
    titulo: "Lâmpada queimada na garagem",
    descricao: "Queimada faz três dias, corredor escuro.",
    categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
    areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
    areaTipo: "comum" as const,
    localizacaoComplemento: "ao lado da vaga 34",
    autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
    registradaEm: "2026-08-25T13:02:11.000Z",
    status: "aberta" as const,
    prioridade: "normal" as const,
    trilha: [
      RegistroDeTransicao.reconstituir({
        sequencia: 1,
        statusAnterior: null,
        statusNovo: "aberta",
        ocorreuEm: "2026-08-25T13:02:11.000Z",
        autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
        observacao: null,
        motivoPausa: null,
        motivoCancelamento: null,
      }),
    ],
  };

  const ANALISE = { autorPessoaId: GESTOR, ocorreuEm: "2026-08-27T09:14:00.000Z" };

  it("reconstituir devolve o agregado no estado em que ele foi gravado", () => {
    const ocorrencia = Ocorrencia.reconstituir(ABERTA);

    expect(ocorrencia.status).toBe("aberta");
    expect(ocorrencia.prioridade).toBe("normal");
    expect(ocorrencia.titulo).toBe(ABERTA.titulo);
    expect(ocorrencia.areaTipo).toBe("comum");
    expect(ocorrencia.trilha).toHaveLength(1);
  });

  it("reconstituir sem trilha estoura — a invariante 2 não se conserta lendo", () => {
    expect(() => Ocorrencia.reconstituir({ ...ABERTA, trilha: [] })).toThrow(/invariante 2/u);
  });

  it("o agregado reconstituído NÃO carrega anexos, e dizê-lo é o ponto", () => {
    // A chave do anexo não sai do repositório (modelo §2.8), então o caminho de ESCRITA não os reidrata.
    // Devolver `[]` seria mentira; o getter estoura, no mesmo idioma de `ultimaTransicao`.
    expect(() => Ocorrencia.reconstituir(ABERTA).anexos).toThrow(/sem anexos/u);
  });

  it("analisar sai de aberta e chega a em_analise — o critério 16.1", () => {
    expect(Ocorrencia.reconstituir(ABERTA).analisar(ANALISE).status).toBe("em_analise");
  });

  it("analisar acrescenta UM registro, com os cinco campos — o critério 16.2", () => {
    const analisada = Ocorrencia.reconstituir(ABERTA).analisar({
      ...ANALISE,
      observacao: "Vou ver o estoque.",
    });
    const registro = analisada.ultimaTransicao;

    expect(analisada.trilha).toHaveLength(2);
    expect(registro.sequencia).toBe(2);
    expect(registro.statusAnterior).toBe("aberta");
    expect(registro.statusNovo).toBe("em_analise");
    expect(registro.ocorreuEm).toBe("2026-08-27T09:14:00.000Z");
    expect(registro.autorPessoaId).toBe(GESTOR);
    expect(registro.observacao).toBe("Vou ver o estoque.");
    expect(registro.motivoPausa).toBeNull();
    expect(registro.motivoCancelamento).toBeNull();
  });

  it("a trilha CRESCE — o registro de origem continua lá, na posição 1", () => {
    const trilha = Ocorrencia.reconstituir(ABERTA).analisar(ANALISE).trilha;

    expect(trilha[0]?.sequencia).toBe(1);
    expect(trilha[0]?.statusAnterior).toBeNull();
    expect(trilha[1]?.sequencia).toBe(2);
  });

  it("sem observação, o registro fica com null — nunca string vazia", () => {
    expect(Ocorrencia.reconstituir(ABERTA).analisar(ANALISE).ultimaTransicao.observacao).toBeNull();
  });

  it("o agregado ANTES não muda — o comando devolve instância nova", () => {
    const antes = Ocorrencia.reconstituir(ABERTA);
    const depois = antes.analisar(ANALISE);

    expect(antes.status).toBe("aberta");
    expect(antes.trilha).toHaveLength(1);
    expect(depois).not.toBe(antes);
  });

  it("analisar fora de aberta estoura — a invariante 1 é estrutural", () => {
    const emAnalise = Ocorrencia.reconstituir({ ...ABERTA, status: "em_analise" });
    // `Error`, e não `ErroDeDominio`: alcançar isto significa que a Aplicação esqueceu de conferir.
    expect(() => emAnalise.analisar(ANALISE)).toThrow(/invariante 1/u);
  });

  it("a sequência vem do último registro, não do tamanho da lista", () => {
    const comBuraco = Ocorrencia.reconstituir({
      ...ABERTA,
      trilha: [
        ...ABERTA.trilha,
        RegistroDeTransicao.reconstituir({
          sequencia: 7,
          statusAnterior: "em_analise",
          statusNovo: "aberta",
          ocorreuEm: "2026-08-26T10:00:00.000Z",
          autorPessoaId: GESTOR,
          observacao: null,
          motivoPausa: null,
          motivoCancelamento: null,
        }),
      ],
    });

    expect(comBuraco.analisar(ANALISE).ultimaTransicao.sequencia).toBe(8);
  });
});

describe("RegistroDeTransicao.avanco", () => {
  const BASE = {
    sequencia: 2,
    statusAnterior: "aberta" as const,
    statusNovo: "em_analise" as const,
    ocorreuEm: "2026-08-27T09:14:00.000Z",
    autorPessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f",
    observacao: null,
  };

  it("produz registro sem motivo — avanço rotineiro não tem o que justificar (D23)", () => {
    const registro = RegistroDeTransicao.avanco(BASE);

    expect(registro.motivoPausa).toBeNull();
    expect(registro.motivoCancelamento).toBeNull();
    expect(Object.isFrozen(registro)).toBe(true);
  });

  it("recusa pausada e cancelada — é o CHECK do banco expresso em fábrica", () => {
    // `registros_transicao_motivo_ck` exige motivo E observação nesses dois destinos. Os itens 18 e 23
    // ganham as fábricas próprias; esta porta não os deixa nascer sem motivo.
    for (const destino of ["pausada", "cancelada"] as const) {
      expect(() => RegistroDeTransicao.avanco({ ...BASE, statusNovo: destino })).toThrow(/motivo/u);
    }
  });
});
