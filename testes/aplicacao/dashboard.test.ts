import { describe, expect, it } from "vitest";

import {
  DIAS_DA_JANELA,
  diaEmSaoPaulo,
  mesEmSaoPaulo,
  mesesDaJanela,
  resolverJanela,
} from "@/aplicacao/dashboard";

/**
 * O instante de referência de todos os casos: **02:00 UTC do dia 30**, que em UTC−3 ainda é o dia **29**.
 * Ele existe para que o teste prove o fuso, e não a coincidência de rodar de manhã.
 */
const AGORA = "2026-08-30T02:00:00.000Z";

describe("a janela do dashboard — os quatro casos do contrato", () => {
  it("sem parâmetro nenhum: até hoje em America/Sao_Paulo, e de é 89 dias antes", () => {
    expect(resolverJanela({}, AGORA)).toStrictEqual({ de: "2026-06-01", ate: "2026-08-29" });
  });

  it("só `de`: o fim continua sendo hoje", () => {
    expect(resolverJanela({ de: "2026-08-01" }, AGORA)).toStrictEqual({
      de: "2026-08-01",
      ate: "2026-08-29",
    });
  });

  it("só `ate`: o começo é 89 dias antes do que se pediu, não de hoje", () => {
    expect(resolverJanela({ ate: "2026-07-31" }, AGORA)).toStrictEqual({
      de: "2026-05-03",
      ate: "2026-07-31",
    });
  });

  it("os dois: devolve os dois, sem tocar em nenhum", () => {
    expect(resolverJanela({ de: "2026-01-01", ate: "2026-01-31" }, AGORA)).toStrictEqual({
      de: "2026-01-01",
      ate: "2026-01-31",
    });
  });

  it("noventa dias são 90 contando as duas pontas — o número que o protótipo desenha", () => {
    const { de, ate } = resolverJanela({}, AGORA);
    const dias = (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000 + 1;
    expect(dias).toBe(DIAS_DA_JANELA);
  });

  it("o dia é o de São Paulo, não o de UTC", () => {
    expect(diaEmSaoPaulo(new Date(AGORA))).toBe("2026-08-29");
    expect(mesEmSaoPaulo(new Date("2026-09-01T02:00:00.000Z"))).toBe("2026-08");
  });
});

describe("o eixo dos meses — do envelope, e um só para as duas séries", () => {
  it("traz todo mês que a janela toca, do mais antigo para o mais novo", () => {
    expect(mesesDaJanela({ de: "2026-06-01", ate: "2026-08-29" })).toStrictEqual([
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("mês parcial continua sendo um mês, e não se arredonda nem se descarta", () => {
    expect(mesesDaJanela({ de: "2026-06-15", ate: "2026-06-20" })).toStrictEqual(["2026-06"]);
  });

  it("atravessa a virada do ano sem buraco", () => {
    expect(mesesDaJanela({ de: "2025-11-20", ate: "2026-02-03" })).toStrictEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

import type {
  ContagemPorCategoria,
  ContagemPorStatus,
  Janela,
  LinhaDeResolucao,
  PontoDeArea,
  PontoDeCategoria,
  RepositorioEscopadoDeDashboard,
} from "@/aplicacao/dashboard";
import { verDashboard } from "@/aplicacao/dashboard";

/** As áreas do duplo, na forma do `AreaLida` — cinco campos, como o schema `Area` exige. */
const GARAGEM = { id: "a-1", nome: "Garagem", tipo: "comum" as const, ativa: true, ordem: 1 };
const HALL = { id: "a-2", nome: "Hall", tipo: "comum" as const, ativa: true, ordem: 2 };

type Dados = {
  status?: readonly ContagemPorStatus[];
  categorias?: readonly ContagemPorCategoria[];
  porCategoria?: readonly PontoDeCategoria[];
  porArea?: readonly PontoDeArea[];
  resolucoes?: readonly LinhaDeResolucao[];
};

/**
 * O duplo em memória — **é o que a ADR-0005 comprou**: substituir o repositório é passar outro argumento.
 *
 * Ele **anota o que recebeu**, e é assim que o critério 33.2 se prova: os dois métodos de fotografia não têm
 * parâmetro nenhum na assinatura, então não há como a janela alcançá-los.
 */
function repositorioEmMemoria(dados: Dados) {
  const chamadas: string[] = [];
  const janelas: Janela[] = [];

  const repositorio: RepositorioEscopadoDeDashboard = {
    backlogPorStatus: () => {
      chamadas.push("backlogPorStatus");
      return Promise.resolve(dados.status ?? []);
    },
    abertasPorCategoria: () => {
      chamadas.push("abertasPorCategoria");
      return Promise.resolve(dados.categorias ?? []);
    },
    recorrenciaPorCategoria: (janela) => {
      chamadas.push("recorrenciaPorCategoria");
      janelas.push(janela);
      return Promise.resolve(dados.porCategoria ?? []);
    },
    recorrenciaPorArea: (janela) => {
      chamadas.push("recorrenciaPorArea");
      janelas.push(janela);
      return Promise.resolve(dados.porArea ?? []);
    },
    resolucoesPorMes: (janela) => {
      chamadas.push("resolucoesPorMes");
      janelas.push(janela);
      return Promise.resolve(dados.resolucoes ?? []);
    },
  };

  return { repositorio, chamadas, janelas };
}

const AGORA_DE_AGOSTO = "2026-08-30T02:00:00.000Z";
const TRES_MESES: Janela = { de: "2026-06-01", ate: "2026-08-29" };

describe("verDashboard — o envelope, e ele não se entrega pela metade", () => {
  it("devolve o periodo preenchido mesmo quando ninguém pediu nada", async () => {
    const { repositorio } = repositorioEmMemoria({});
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.periodo).toStrictEqual(TRES_MESES);
  });

  it("lê as cinco fontes e mais nada — a porta não tem escrita", async () => {
    const { repositorio, chamadas } = repositorioEmMemoria({});
    await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect([...chamadas].sort()).toStrictEqual([
      "abertasPorCategoria",
      "backlogPorStatus",
      "recorrenciaPorArea",
      "recorrenciaPorCategoria",
      "resolucoesPorMes",
    ]);
  });

  it("passa a MESMA janela às três séries, e nenhuma aos dois de fotografia", async () => {
    const { repositorio, janelas } = repositorioEmMemoria({});
    await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(janelas).toStrictEqual([TRES_MESES, TRES_MESES, TRES_MESES]);
  });

  it("devolve os SEIS status, na ordem do ciclo, com zero onde o banco não trouxe nada", async () => {
    const { repositorio } = repositorioEmMemoria({
      status: [
        { status: "resolvida", quantidade: 14 },
        { status: "aberta", quantidade: 8 },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.backlogPorStatus).toStrictEqual([
      { status: "aberta", quantidade: 8 },
      { status: "em_analise", quantidade: 0 },
      { status: "em_atendimento", quantidade: 0 },
      { status: "pausada", quantidade: 0 },
      { status: "resolvida", quantidade: 14 },
      { status: "cancelada", quantidade: 0 },
    ]);
  });
});

describe("as duas séries mensais — um eixo só, e nenhum mês omitido", () => {
  it("a recorrência traz todos os meses da janela, mesmo os que o banco não trouxe", async () => {
    const { repositorio } = repositorioEmMemoria({
      porCategoria: [
        { categoria: { id: "c-1", nome: "Vazamento" }, mes: "2026-06", quantidade: 6 },
        { categoria: { id: "c-1", nome: "Vazamento" }, mes: "2026-08", quantidade: 4 },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.recorrenciaPorCategoria).toStrictEqual([
      {
        categoria: { id: "c-1", nome: "Vazamento" },
        porMes: [
          { mes: "2026-06", quantidade: 6 },
          { mes: "2026-07", quantidade: 0 },
          { mes: "2026-08", quantidade: 4 },
        ],
      },
    ]);
  });

  it("ordena as séries pelo total do período, decrescente — é o corte que a tela vai fazer", async () => {
    const { repositorio } = repositorioEmMemoria({
      porArea: [
        { area: HALL, mes: "2026-06", quantidade: 2 },
        { area: GARAGEM, mes: "2026-07", quantidade: 9 },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.recorrenciaPorArea.map((serie) => serie.area.nome)).toStrictEqual([
      "Garagem",
      "Hall",
    ]);
  });

  it("sem nenhuma ocorrência na janela, a recorrência é lista VAZIA — não uma série de zeros", async () => {
    const { repositorio } = repositorioEmMemoria({});
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.recorrenciaPorCategoria).toStrictEqual([]);
    expect(lido.recorrenciaPorArea).toStrictEqual([]);
  });

  it("mês sem resolução fica na série, com os três nulos e o denominador em zero", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-06",
          resolvidas: 5,
          medianaDeHoras: 12,
          p90DeHoras: 72,
          amostraEmHoras: [],
          avaliadas: 2,
          somaDasNotas: 9,
        },
        {
          mes: "2026-08",
          resolvidas: 9,
          medianaDeHoras: 41.5,
          p90DeHoras: 200,
          amostraEmHoras: [],
          avaliadas: 4,
          somaDasNotas: 18,
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.tempoDeResolucao.porMes).toStrictEqual([
      { mes: "2026-06", mediana: 12, p90: 72, amostra: null, resolvidas: 5 },
      { mes: "2026-07", mediana: null, p90: null, amostra: null, resolvidas: 0 },
      { mes: "2026-08", mediana: 41.5, p90: 200, amostra: null, resolvidas: 9 },
    ]);
  });

  /**
   * **A regra do critério 58.4 mora aqui, e é por isso que ela tem teste no laço curto.** O projeto de
   * integração não está no `npm run verificar`; se a regra vivesse só no SQL, o portão nunca a conferiria.
   */
  it("mês com TRÊS resoluções publica as durações cruas e recusa o p90", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-08",
          resolvidas: 3,
          medianaDeHoras: 1,
          p90DeHoras: 1.8,
          amostraEmHoras: [0.5, 1, 2],
          avaliadas: 0,
          somaDasNotas: 0,
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.tempoDeResolucao.porMes.at(-1)).toStrictEqual({
      mes: "2026-08",
      mediana: 1,
      p90: null,
      amostra: [0.5, 1, 2],
      resolvidas: 3,
    });
  });

  /** O primeiro mês ACIMA do teto — um `<=` escrito como `<` passa despercebido em todo outro caso. */
  it("mês com QUATRO resoluções publica o p90 e descarta a amostra", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-08",
          resolvidas: 4,
          medianaDeHoras: 1,
          p90DeHoras: 1.9,
          amostraEmHoras: [],
          avaliadas: 0,
          somaDasNotas: 0,
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.tempoDeResolucao.porMes.at(-1)).toStrictEqual({
      mes: "2026-08",
      mediana: 1,
      p90: 1.9,
      amostra: null,
      resolvidas: 4,
    });
  });

  /**
   * **Duas casas, e o critério 55.2 é quem obriga.** Com uma casa, `0.028` h viraria `0.0` e a tela
   * escreveria `0 min` — o zero que o item 55 acabou de tirar da tela. Com duas, o quantum é de 36
   * segundos, abaixo do menor texto que a tela sabe escrever.
   */
  it("a amostra sai com DUAS casas, e um minuto e quarenta não vira zero", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-08",
          resolvidas: 1,
          medianaDeHoras: 0.0283,
          p90DeHoras: 0.0283,
          amostraEmHoras: [0.0283],
          avaliadas: 0,
          somaDasNotas: 0,
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.tempoDeResolucao.porMes.at(-1)).toStrictEqual({
      mes: "2026-08",
      mediana: 0.03,
      p90: null,
      amostra: [0.03],
      resolvidas: 1,
    });
  });
});

describe("a média das avaliações — derivada das MESMAS linhas do tempo de resolução", () => {
  it("sem nenhuma avaliação, a média é null e o denominador continua contando", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-08",
          resolvidas: 3,
          medianaDeHoras: 10,
          p90DeHoras: 10,
          amostraEmHoras: [5, 10, 15],
          avaliadas: 0,
          somaDasNotas: 0,
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.mediaDasAvaliacoes).toStrictEqual({ media: null, avaliadas: 0, resolvidas: 3 });
  });

  it("critério 34.5: resolvidas é IGUAL à soma de tempoDeResolucao.porMes[].resolvidas", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-06",
          resolvidas: 5,
          medianaDeHoras: 12,
          p90DeHoras: 72,
          amostraEmHoras: [],
          avaliadas: 2,
          somaDasNotas: 9,
        },
        {
          mes: "2026-08",
          resolvidas: 9,
          medianaDeHoras: 41.5,
          p90DeHoras: 200,
          amostraEmHoras: [],
          avaliadas: 4,
          somaDasNotas: 18,
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    const somaDaSerie = lido.tempoDeResolucao.porMes.reduce((t, m) => t + m.resolvidas, 0);
    expect(lido.mediaDasAvaliacoes.resolvidas).toBe(somaDaSerie);
    expect(lido.mediaDasAvaliacoes).toStrictEqual({ media: 4.5, avaliadas: 6, resolvidas: 14 });
  });
});
