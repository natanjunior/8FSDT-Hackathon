import { describe, expect, it } from "vitest";

import {
  DIAS_DA_JANELA,
  atalhosDaJanela,
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

describe("os quatro atalhos do painel — item 71", () => {
  it("as quatro janelas saem do dia de São Paulo, com as duas pontas dentro", () => {
    expect(atalhosDaJanela(AGORA)).toStrictEqual({
      sete: { de: "2026-08-23", ate: "2026-08-29" },
      trinta: { de: "2026-07-31", ate: "2026-08-29" },
      noventa: { de: "2026-06-01", ate: "2026-08-29" },
      mes: { de: "2026-08-01", ate: "2026-08-29" },
    });
  });

  it("sete, trinta e noventa contam as duas pontas, como DIAS_DA_JANELA já significa", () => {
    const dias = ({ de, ate }: { de: string; ate: string }) =>
      (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000 + 1;
    const atalhos = atalhosDaJanela(AGORA);
    expect(dias(atalhos.sete)).toBe(7);
    expect(dias(atalhos.trinta)).toBe(30);
    expect(dias(atalhos.noventa)).toBe(DIAS_DA_JANELA);
  });

  it("este mês começa no dia 01 e termina hoje, nunca no fim do mês", () => {
    expect(atalhosDaJanela(AGORA).mes).toStrictEqual({ de: "2026-08-01", ate: "2026-08-29" });
  });

  it("no dia 01 este mês é um dia só, e não uma janela invertida", () => {
    expect(atalhosDaJanela("2026-09-01T15:00:00.000Z").mes).toStrictEqual({
      de: "2026-09-01",
      ate: "2026-09-01",
    });
  });

  it("o mês é o de São Paulo: 02:00 UTC do dia 01 ainda é o mês anterior", () => {
    expect(atalhosDaJanela("2026-09-01T02:00:00.000Z").mes).toStrictEqual({
      de: "2026-08-01",
      ate: "2026-08-31",
    });
  });

  it("o atalho de 90 dias é a janela padrão — os quatro casos que eram de ehJanelaPadrao", () => {
    const { noventa } = atalhosDaJanela(AGORA);
    expect(noventa).toStrictEqual(resolverJanela({}, AGORA));
    expect(noventa).toStrictEqual({ de: "2026-06-01", ate: "2026-08-29" });
    expect(noventa).not.toStrictEqual({ de: "2026-05-31", ate: "2026-08-28" });
    expect(noventa).not.toStrictEqual({ de: "2026-06-02", ate: "2026-08-29" });
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
  ContagemPorFaixaDeIdade,
  ContagemPorStatus,
  DuplaRecorrente,
  Janela,
  LinhaDeResolucao,
  MaisVelhaEmAberto,
  PontoDeArea,
  PontoDeCategoria,
  PontoMensal,
  RepositorioEscopadoDeDashboard,
} from "@/aplicacao/dashboard";
import { FAIXAS_DE_IDADE, verDashboard } from "@/aplicacao/dashboard";
import { TERMINAIS } from "@/dominio/ocorrencia";

/** As áreas do duplo, na forma do `AreaLida` — cinco campos, como o schema `Area` exige. */
const GARAGEM = { id: "a-1", nome: "Garagem", tipo: "comum" as const, ativa: true, ordem: 1 };
const HALL = { id: "a-2", nome: "Hall", tipo: "comum" as const, ativa: true, ordem: 2 };

type Dados = {
  status?: readonly ContagemPorStatus[];
  categorias?: readonly ContagemPorCategoria[];
  porCategoria?: readonly PontoDeCategoria[];
  porArea?: readonly PontoDeArea[];
  resolucoes?: readonly LinhaDeResolucao[];
  idades?: readonly ContagemPorFaixaDeIdade[];
  duplas?: readonly DuplaRecorrente[];
  canceladas?: readonly PontoMensal[];
  emAbertoNoInicio?: number;
  maisVelhas?: readonly MaisVelhaEmAberto[];
};

/** Uma linha de resolução com zero em tudo que o caso não diz. */
function linhaDeResolucao(parcial: Partial<LinhaDeResolucao> & { mes: string }): LinhaDeResolucao {
  return {
    resolvidas: 0,
    medianaDeHoras: 0,
    p90DeHoras: 0,
    amostraEmHoras: [],
    avaliadas: 0,
    somaDasNotas: 0,
    contagemPorNota: [0, 0, 0, 0, 0],
    ...parcial,
  };
}

/**
 * O duplo em memória — **é o que a ADR-0005 comprou**: substituir o repositório é passar outro argumento.
 *
 * Ele **anota o que recebeu**, e é assim que o critério 33.2 se prova: os três métodos de fotografia não
 * têm parâmetro nenhum na assinatura, então não há como a janela alcançá-los.
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
    abertasPorIdade: () => {
      chamadas.push("abertasPorIdade");
      return Promise.resolve(dados.idades ?? []);
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
    duplasRecorrentes: (janela) => {
      chamadas.push("duplasRecorrentes");
      janelas.push(janela);
      return Promise.resolve(dados.duplas ?? []);
    },
    canceladasPorMes: (janela) => {
      chamadas.push("canceladasPorMes");
      janelas.push(janela);
      return Promise.resolve(dados.canceladas ?? []);
    },
    emAbertoNoInicio: (janela) => {
      chamadas.push("emAbertoNoInicio");
      janelas.push(janela);
      return Promise.resolve(dados.emAbertoNoInicio ?? 0);
    },
    maisVelhasEmAberto: () => {
      chamadas.push("maisVelhasEmAberto");
      return Promise.resolve(dados.maisVelhas ?? []);
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

  it("lê as dez fontes e mais nada — a porta não tem escrita", async () => {
    const { repositorio, chamadas } = repositorioEmMemoria({});
    await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect([...chamadas].sort()).toStrictEqual([
      "abertasPorCategoria",
      "abertasPorIdade",
      "backlogPorStatus",
      "canceladasPorMes",
      "duplasRecorrentes",
      "emAbertoNoInicio",
      "maisVelhasEmAberto",
      "recorrenciaPorArea",
      "recorrenciaPorCategoria",
      "resolucoesPorMes",
    ]);
  });

  /**
   * **Seis leituras com janela, e os quatro de fotografia continuam sem nenhuma** — que é a metade do
   * caso que prova o critério 33.2. As canceladas e o início da janela entraram como a quinta e a sexta
   * com janela, e o **tamanho** deste array é o que percebe um método novo recebendo período sem que
   * ninguém decida isso.
   */
  it("passa a MESMA janela às seis leituras de período, e nenhuma aos quatro de fotografia", async () => {
    const { repositorio, janelas } = repositorioEmMemoria({});
    await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(janelas).toStrictEqual([
      TRES_MESES,
      TRES_MESES,
      TRES_MESES,
      TRES_MESES,
      TRES_MESES,
      TRES_MESES,
    ]);
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
          contagemPorNota: [0, 0, 0, 1, 1],
        },
        {
          mes: "2026-08",
          resolvidas: 9,
          medianaDeHoras: 41.5,
          p90DeHoras: 200,
          amostraEmHoras: [],
          avaliadas: 4,
          somaDasNotas: 18,
          contagemPorNota: [0, 0, 0, 2, 2],
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
          contagemPorNota: [0, 0, 0, 0, 0],
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
          contagemPorNota: [0, 0, 0, 0, 0],
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
   * **Quatro casas, e piso de `0.0001` para o que é maior que zero** — item 62, critério 62.2. Com duas
   * casas, qualquer duração abaixo de ~18 s chegava como `0` exato, **antes** do piso da tela, e a Aurora
   * escreveu `mediana 0 min` com 44 resolvidas. O quantum de quatro casas é de 0,36 s; o piso cobre o que
   * fica abaixo dele, e a regra passa a valer por construção.
   */
  it("a amostra sai com QUATRO casas, e um minuto e quarenta chega inteiro", async () => {
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
          contagemPorNota: [0, 0, 0, 0, 0],
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.tempoDeResolucao.porMes.at(-1)).toStrictEqual({
      mes: "2026-08",
      mediana: 0.0283,
      p90: null,
      amostra: [0.0283],
      resolvidas: 1,
    });
  });

  it("cinco segundos chegam como 0.0014, e não como zero — a pergunta do critério 62.2", async () => {
    const cincoSegundos = 5 / 3600;
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-08",
          resolvidas: 1,
          medianaDeHoras: cincoSegundos,
          p90DeHoras: cincoSegundos,
          amostraEmHoras: [cincoSegundos],
          avaliadas: 0,
          somaDasNotas: 0,
          contagemPorNota: [0, 0, 0, 0, 0],
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.tempoDeResolucao.porMes.at(-1)).toStrictEqual({
      mes: "2026-08",
      mediana: 0.0014,
      p90: null,
      amostra: [0.0014],
      resolvidas: 1,
    });
  });

  it("abaixo do quantum, o valor positivo sobe ao piso de 0.0001 — mediana, p90 e amostra", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        {
          mes: "2026-08",
          resolvidas: 4,
          medianaDeHoras: 0.00001,
          p90DeHoras: 0.00002,
          amostraEmHoras: [],
          avaliadas: 0,
          somaDasNotas: 0,
          contagemPorNota: [0, 0, 0, 0, 0],
        },
        {
          mes: "2026-07",
          resolvidas: 1,
          medianaDeHoras: 0.00001,
          p90DeHoras: 0.00001,
          amostraEmHoras: [0.00001],
          avaliadas: 0,
          somaDasNotas: 0,
          contagemPorNota: [0, 0, 0, 0, 0],
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    const porMes = new Map(lido.tempoDeResolucao.porMes.map((m) => [m.mes, m]));
    expect(porMes.get("2026-08")).toMatchObject({ mediana: 0.0001, p90: 0.0001, amostra: null });
    expect(porMes.get("2026-07")).toMatchObject({ mediana: 0.0001, p90: null, amostra: [0.0001] });
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
          contagemPorNota: [0, 0, 0, 0, 0],
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.mediaDasAvaliacoes).toStrictEqual({
      media: null,
      avaliadas: 0,
      resolvidas: 3,
      distribuicao: [
        { nota: 1, quantidade: 0 },
        { nota: 2, quantidade: 0 },
        { nota: 3, quantidade: 0 },
        { nota: 4, quantidade: 0 },
        { nota: 5, quantidade: 0 },
      ],
    });
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
          contagemPorNota: [0, 0, 0, 1, 1],
        },
        {
          mes: "2026-08",
          resolvidas: 9,
          medianaDeHoras: 41.5,
          p90DeHoras: 200,
          amostraEmHoras: [],
          avaliadas: 4,
          somaDasNotas: 18,
          contagemPorNota: [0, 0, 0, 2, 2],
        },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    const somaDaSerie = lido.tempoDeResolucao.porMes.reduce((t, m) => t + m.resolvidas, 0);
    expect(lido.mediaDasAvaliacoes.resolvidas).toBe(somaDaSerie);
    expect(lido.mediaDasAvaliacoes).toStrictEqual({
      media: 4.5,
      avaliadas: 6,
      resolvidas: 14,
      distribuicao: [
        { nota: 1, quantidade: 0 },
        { nota: 2, quantidade: 0 },
        { nota: 3, quantidade: 0 },
        { nota: 4, quantidade: 3 },
        { nota: 5, quantidade: 3 },
      ],
    });
  });
});

/**
 * ---------------------------------------------------------------------------
 *  As faixas de idade — item 59, critérios 2 e 6
 * ---------------------------------------------------------------------------
 *
 * **A regra de produto mora aqui, e não no SQL**, pela mesma razão do item 58: `npm run verificar` não
 * roda o projeto de integração, então uma regra que só vivesse na consulta seria uma regra que o portão
 * nunca confere. O `group by` do banco não produz grupo sem linha; quem publica as quatro sempre é este
 * módulo.
 */
describe("as quatro faixas de idade — sempre todas, na ordem crescente", () => {
  it("o banco devolve UMA faixa e o envelope publica as quatro, com zero nas outras três", async () => {
    const { repositorio } = repositorioEmMemoria({ idades: [{ faixa: 2, quantidade: 5 }] });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.abertasPorIdade).toStrictEqual([
      { deDias: 0, ateDias: 7, quantidade: 0 },
      { deDias: 8, ateDias: 30, quantidade: 0 },
      { deDias: 31, ateDias: 90, quantidade: 5 },
      { deDias: 91, ateDias: null, quantidade: 0 },
    ]);
  });

  it("a organização recém-criada vê as quatro a zero — é a estrutura ensinando o que vai ser medido", async () => {
    const { repositorio } = repositorioEmMemoria({ idades: [] });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.abertasPorIdade.map((faixa) => faixa.quantidade)).toStrictEqual([0, 0, 0, 0]);
    expect(lido.abertasPorIdade).toHaveLength(FAIXAS_DE_IDADE.length);
  });

  it("a ordem publicada é a das faixas, mesmo com o banco devolvendo fora de ordem", async () => {
    const { repositorio } = repositorioEmMemoria({
      idades: [
        { faixa: 3, quantidade: 1 },
        { faixa: 0, quantidade: 12 },
        { faixa: 2, quantidade: 2 },
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.abertasPorIdade.map((faixa) => faixa.deDias)).toStrictEqual([0, 8, 31, 91]);
    expect(lido.abertasPorIdade.map((faixa) => faixa.quantidade)).toStrictEqual([12, 0, 2, 1]);
  });

  it("a faixa mais velha é a última, e é a única sem teto", async () => {
    const { repositorio } = repositorioEmMemoria({});
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    const semTeto = lido.abertasPorIdade.filter((faixa) => faixa.ateDias === null);

    expect(semTeto).toHaveLength(1);
    expect(lido.abertasPorIdade.at(-1)?.ateDias).toBeNull();
  });
});

/**
 * As duplas do duplo. **Nomes escolhidos pelo desempate**: `Adega` antes de `Água` só se a comparação for
 * a do `localeCompare` em pt-BR — na ordem de código, `Á` vem depois de toda letra sem acento.
 */
const ADEGA = {
  id: "a-3",
  nome: "Adega",
  tipo: "comum" as const,
  ativa: true,
  ordem: 3,
};
const AGUA = {
  id: "a-4",
  nome: "Água",
  tipo: "comum" as const,
  ativa: true,
  ordem: 4,
};

const dupla = (
  area: typeof GARAGEM,
  categoria: string,
  quantidade: number,
): DuplaRecorrente => ({
  area,
  categoria: { id: `c-${categoria}`, nome: categoria },
  quantidade,
});

describe("as duplas recorrentes — o mínimo é dois, e a ordem é da Aplicação", () => {
  /**
   * **O refiltro tem prova própria, e sem este caso o `filter` seria linha morta.** O `having` do SQL já
   * corta, então um duplo que só devolvesse duplas legítimas deixaria a regra sem portão — e
   * `npm run verificar` não roda o projeto de integração.
   */
  it("a dupla com uma ocorrência não sai, mesmo quando o repositório a devolve", async () => {
    const { repositorio } = repositorioEmMemoria({
      duplas: [dupla(GARAGEM, "Vazamentos", 3), dupla(HALL, "Limpeza", 1)],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.duplasRecorrentes.map((d) => d.categoria.nome)).toStrictEqual([
      "Vazamentos",
    ]);
  });

  it("a ordem é por contagem decrescente", async () => {
    const { repositorio } = repositorioEmMemoria({
      duplas: [
        dupla(GARAGEM, "Duas", 2),
        dupla(HALL, "Sete", 7),
        dupla(ADEGA, "Quatro", 4),
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.duplasRecorrentes.map((d) => d.quantidade)).toStrictEqual([
      7, 4, 2,
    ]);
  });

  /**
   * **O empate desempata pelo nome da ÁREA, na colação do `localeCompare` em pt-BR.** A do banco e esta
   * não concordam em acentuação, e duas duplas empatadas trocariam de lugar conforme a resposta viesse do
   * banco ou de um duplo — por isso a ordem publicada é decidida aqui.
   */
  it("o empate desempata pelo nome da área, e Adega vem antes de Água", async () => {
    const { repositorio } = repositorioEmMemoria({
      duplas: [dupla(AGUA, "Vazamentos", 5), dupla(ADEGA, "Vazamentos", 5)],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.duplasRecorrentes.map((d) => d.area.nome)).toStrictEqual([
      "Adega",
      "Água",
    ]);
  });

  it("empate de contagem e de área desempata pelo nome da categoria", async () => {
    const { repositorio } = repositorioEmMemoria({
      duplas: [dupla(GARAGEM, "Zeladoria", 4), dupla(GARAGEM, "Acessos", 4)],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.duplasRecorrentes.map((d) => d.categoria.nome)).toStrictEqual([
      "Acessos",
      "Zeladoria",
    ]);
  });

  /** Sem nenhuma dupla o campo é `[]` e não `undefined` — o envelope não se entrega pela metade. */
  it("sem nenhuma dupla, o campo é uma lista vazia e não um buraco", async () => {
    const { repositorio } = repositorioEmMemoria({});
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });

    expect(lido.duplasRecorrentes).toStrictEqual([]);
  });
});

describe("as canceladas por mês — o eixo inteiro, com zero onde não houve", () => {
  it("preenche todo mês da janela", async () => {
    const { repositorio } = repositorioEmMemoria({
      canceladas: [{ mes: "2026-07", quantidade: 3 }],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.canceladasPorMes).toStrictEqual([
      { mes: "2026-06", quantidade: 0 },
      { mes: "2026-07", quantidade: 3 },
      { mes: "2026-08", quantidade: 0 },
    ]);
  });
});

describe("em aberto no início — medido, e passado adiante sem conta", () => {
  it("devolve o que o repositório mediu, e não agora menos o saldo", async () => {
    const { repositorio } = repositorioEmMemoria({ emAbertoNoInicio: 4 });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.emAbertoNoInicio).toBe(4);
  });
});

describe("as mais velhas em aberto — no máximo cinco, na ordem que chegou", () => {
  const velha = (n: number): MaisVelhaEmAberto => ({
    id: `o-${String(n)}`,
    titulo: `Ocorrência ${String(n)}`,
    status: "pausada",
    idadeEmDias: 40 - n,
  });

  it("corta em QUANTAS_MAIS_VELHAS mesmo que o repositório traga mais", async () => {
    const { repositorio } = repositorioEmMemoria({ maisVelhas: [1, 2, 3, 4, 5, 6, 7].map(velha) });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.maisVelhasEmAberto.map((o) => o.id)).toStrictEqual([
      "o-1",
      "o-2",
      "o-3",
      "o-4",
      "o-5",
    ]);
  });

  it("devolve lista vazia quando nada está em aberto", async () => {
    const { repositorio } = repositorioEmMemoria({});
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.maisVelhasEmAberto).toStrictEqual([]);
  });
});

describe("a distribuição das notas — as cinco sempre, das mesmas linhas da média", () => {
  it("soma as contagens de todos os meses, nota a nota", async () => {
    const { repositorio } = repositorioEmMemoria({
      resolucoes: [
        linhaDeResolucao({
          mes: "2026-07",
          avaliadas: 3,
          somaDasNotas: 12,
          contagemPorNota: [0, 1, 0, 0, 2],
        }),
        linhaDeResolucao({
          mes: "2026-08",
          avaliadas: 2,
          somaDasNotas: 6,
          contagemPorNota: [0, 1, 0, 1, 0],
        }),
      ],
    });
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.mediaDasAvaliacoes.distribuicao).toStrictEqual([
      { nota: 1, quantidade: 0 },
      { nota: 2, quantidade: 2 },
      { nota: 3, quantidade: 0 },
      { nota: 4, quantidade: 1 },
      { nota: 5, quantidade: 2 },
    ]);
  });

  it("vem com as cinco a zero quando ninguém avaliou", async () => {
    const { repositorio } = repositorioEmMemoria({});
    const lido = await verDashboard(repositorio, { agora: AGORA_DE_AGOSTO });
    expect(lido.mediaDasAvaliacoes.distribuicao.map((n) => n.quantidade)).toStrictEqual([
      0, 0, 0, 0, 0,
    ]);
  });
});

/**
 * **As conferências do critério 15, com um mundo pequeno e coerente.** Com duplo, as duas primeiras
 * somas provam que a Aplicação não perde nem inventa linha. Quem prova que os dois `where` do SQL
 * concordam é a integração, que o portão não roda.
 */
describe("as conferências do painel fecham — critério 15", () => {
  const mundo = repositorioEmMemoria({
    status: [
      { status: "aberta", quantidade: 2 },
      { status: "pausada", quantidade: 1 },
      { status: "resolvida", quantidade: 4 },
      { status: "cancelada", quantidade: 1 },
    ],
    categorias: [
      { categoria: { id: "c-1", nome: "Vazamentos" }, quantidade: 2, envelhecidas: 1 },
      { categoria: { id: "c-2", nome: "Limpeza" }, quantidade: 1, envelhecidas: 0 },
    ],
    idades: [
      { faixa: 0, quantidade: 2 },
      { faixa: 1, quantidade: 1 },
    ],
    resolucoes: [
      linhaDeResolucao({
        mes: "2026-07",
        resolvidas: 3,
        avaliadas: 2,
        somaDasNotas: 9,
        contagemPorNota: [0, 0, 0, 1, 1],
      }),
      linhaDeResolucao({
        mes: "2026-08",
        resolvidas: 1,
        avaliadas: 1,
        somaDasNotas: 3,
        contagemPorNota: [0, 0, 1, 0, 0],
      }),
    ],
  });

  it("a soma da idade é a soma da categoria, e é a soma dos quatro não terminais", async () => {
    const lido = await verDashboard(mundo.repositorio, { agora: AGORA_DE_AGOSTO });
    const soma = (xs: readonly { quantidade: number }[]) => xs.reduce((t, x) => t + x.quantidade, 0);
    const naoTerminais = lido.backlogPorStatus.filter((l) => !TERMINAIS.includes(l.status));
    expect(soma(lido.abertasPorIdade)).toBe(soma(lido.abertasPorCategoria));
    expect(soma(lido.abertasPorIdade)).toBe(soma(naoTerminais));
  });

  it("a soma dos n do tempo é o denominador da satisfação, e a da distribuição é avaliadas", async () => {
    const lido = await verDashboard(mundo.repositorio, { agora: AGORA_DE_AGOSTO });
    const n = lido.tempoDeResolucao.porMes.reduce((t, m) => t + m.resolvidas, 0);
    expect(n).toBe(lido.mediaDasAvaliacoes.resolvidas);
    expect(lido.mediaDasAvaliacoes.distribuicao.reduce((t, d) => t + d.quantidade, 0)).toBe(
      lido.mediaDasAvaliacoes.avaliadas,
    );
  });
});
