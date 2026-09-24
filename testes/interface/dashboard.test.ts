import { describe, expect, it } from "vitest";

import type { DashboardLido } from "@/aplicacao/dashboard";
import { duracaoEmTexto } from "@/interface/componentes/duracao";
import {
  chaveDaDupla,
  rotuloDaDupla,
  SEM_DUPLA_RECORRENTE,
} from "@/interface/componentes/duplas-recorrentes";
import { linhasDoFluxoMensal, textoDoFluxoMensal } from "@/interface/componentes/fluxo-mensal";
import {
  rotuloDaFaixaDeIdade,
  textoDaIdadeEmAberto,
} from "@/interface/componentes/idade-em-aberto";
import {
  itemDoTempoDeResolucao,
  SEM_RESOLUCAO_NO_MES,
  textoDoTempoDeResolucao,
  type MesDoTempoDeResolucao,
} from "@/interface/componentes/tempo-de-resolucao";
import { FormatoInvalido, lerJanelaDoDashboardDaUrl } from "@/interface/http";
import { projetarDashboard } from "@/interface/projecoes";

const consulta = (bruto: string) => new URLSearchParams(bruto);

describe("os dois parâmetros do dashboard, lidos da URL", () => {
  it("sem parâmetro nenhum, não decide nada — quem decide o padrão é a Aplicação", () => {
    expect(lerJanelaDoDashboardDaUrl(consulta(""))).toStrictEqual({});
  });

  it("lê as duas datas quando estão lá", () => {
    expect(lerJanelaDoDashboardDaUrl(consulta("de=2026-06-01&ate=2026-08-29"))).toStrictEqual({
      de: "2026-06-01",
      ate: "2026-08-29",
    });
  });

  it("data fora de formato é 400, nunca uma janela silenciosamente diferente", () => {
    expect(() => lerJanelaDoDashboardDaUrl(consulta("de=01/06/2026"))).toThrow(FormatoInvalido);
  });

  it("data que não existe no calendário é 400 — 30 de fevereiro não vira 2 de março", () => {
    expect(() => lerJanelaDoDashboardDaUrl(consulta("ate=2026-02-30"))).toThrow(FormatoInvalido);
  });

  it("janela invertida é 400, e não uma resposta de zeros", () => {
    expect(() => lerJanelaDoDashboardDaUrl(consulta("de=2026-08-29&ate=2026-06-01"))).toThrow(
      FormatoInvalido,
    );
  });

  it("parâmetro repetido é 400 — a mesma gramática dos filtros de T-03", () => {
    expect(() => lerJanelaDoDashboardDaUrl(consulta("de=2026-06-01&de=2026-07-01"))).toThrow(
      FormatoInvalido,
    );
  });
});

const LIDO: DashboardLido = {
  periodo: { de: "2026-06-01", ate: "2026-08-29" },
  backlogPorStatus: [
    { status: "aberta", quantidade: 8 },
    { status: "em_analise", quantidade: 4 },
    { status: "em_atendimento", quantidade: 3 },
    { status: "pausada", quantidade: 2 },
    { status: "resolvida", quantidade: 14 },
    { status: "cancelada", quantidade: 2 },
  ],
  abertasPorCategoria: [{ categoria: { id: "c-1", nome: "Vazamento" }, quantidade: 7 }],
  abertasPorIdade: [
    { deDias: 0, ateDias: 7, quantidade: 12 },
    { deDias: 8, ateDias: 30, quantidade: 5 },
    { deDias: 31, ateDias: 90, quantidade: 2 },
    { deDias: 91, ateDias: null, quantidade: 1 },
  ],
  mediaDasAvaliacoes: { media: 4.2, avaliadas: 6, resolvidas: 14 },
  recorrenciaPorCategoria: [
    { categoria: { id: "c-1", nome: "Vazamento" }, porMes: [{ mes: "2026-06", quantidade: 6 }] },
  ],
  recorrenciaPorArea: [
    {
      area: { id: "a-1", nome: "Garagem", tipo: "comum", ativa: true, ordem: 1 },
      porMes: [{ mes: "2026-06", quantidade: 2 }],
    },
  ],
  duplasRecorrentes: [
    {
      area: { id: "a-1", nome: "Garagem", tipo: "comum", ativa: true, ordem: 1 },
      categoria: { id: "c-1", nome: "Vazamento" },
      quantidade: 4,
    },
    {
      area: { id: "a-2", nome: "Hall", tipo: "privativa", ativa: false, ordem: 2 },
      categoria: { id: "c-2", nome: "Limpeza" },
      quantidade: 2,
    },
  ],
  tempoDeResolucao: {
    porMes: [{ mes: "2026-06", mediana: 12, p90: 72, amostra: null, resolvidas: 5 }],
  },
};

describe("a projeção do dashboard — o schema Dashboard do contrato", () => {
  it("acrescenta o statusRotulo do Gestor aos seis status, sem inventar palavra nova", () => {
    const projetado = projetarDashboard(LIDO);
    expect(projetado.backlogPorStatus.map((linha) => linha.statusRotulo)).toStrictEqual([
      "Aberta",
      "Em análise",
      "Em atendimento",
      "Pausada",
      "Resolvida",
      "Cancelada",
    ]);
  });

  it("a área sai com os CINCO campos do schema Area, não com três", () => {
    const [serie] = projetarDashboard(LIDO).recorrenciaPorArea;
    expect(serie?.area).toStrictEqual({
      id: "a-1",
      nome: "Garagem",
      tipo: "comum",
      ativa: true,
      ordem: 1,
    });
  });

  it("o bloco por categoria atravessa com o nome que diz o que ele conta", () => {
    expect(projetarDashboard(LIDO).abertasPorCategoria).toStrictEqual([
      { categoria: { id: "c-1", nome: "Vazamento" }, quantidade: 7 },
    ]);
  });

  it("as quatro faixas atravessam com os limites em número, e sem rótulo", () => {
    expect(projetarDashboard(LIDO).abertasPorIdade).toStrictEqual([
      { deDias: 0, ateDias: 7, quantidade: 12 },
      { deDias: 8, ateDias: 30, quantidade: 5 },
      { deDias: 31, ateDias: 90, quantidade: 2 },
      { deDias: 91, ateDias: null, quantidade: 1 },
    ]);
  });

  it("a categoria sai com dois campos — o contrato a declara inline, sem ícone", () => {
    const [serie] = projetarDashboard(LIDO).recorrenciaPorCategoria;
    expect(serie?.categoria).toStrictEqual({ id: "c-1", nome: "Vazamento" });
  });

  /**
   * **A dupla atravessa com a Área de cinco campos e a Categoria de dois** — é o mesmo `projetarArea`
   * de `recorrenciaPorArea`, e uma segunda forma de Área no mesmo envelope seria a que diverge na
   * primeira alteração.
   */
  it("a dupla sai com a Área de cinco campos e a Categoria de dois", () => {
    const [dupla] = projetarDashboard(LIDO).duplasRecorrentes;
    expect(dupla).toStrictEqual({
      area: { id: "a-1", nome: "Garagem", tipo: "comum", ativa: true, ordem: 1 },
      categoria: { id: "c-1", nome: "Vazamento" },
      quantidade: 4,
    });
  });

  /**
   * **A projeção não reordena e não refiltra.** Quem decide a ordem é a Aplicação; repeti-la aqui
   * seria afirmar a mesma regra em duas camadas, e a segunda envelhece sozinha.
   */
  it("a ordem que a Aplicação deu atravessa intacta", () => {
    expect(
      projetarDashboard(LIDO).duplasRecorrentes.map((dupla) => dupla.quantidade),
    ).toStrictEqual([4, 2]);
  });

  it("o periodo é ecoado, e os três blocos de número atravessam sem alteração", () => {
    const projetado = projetarDashboard(LIDO);
    expect(projetado.periodo).toStrictEqual({ de: "2026-06-01", ate: "2026-08-29" });
    expect(projetado.mediaDasAvaliacoes).toStrictEqual({ media: 4.2, avaliadas: 6, resolvidas: 14 });
    expect(projetado.tempoDeResolucao.porMes).toStrictEqual([
      { mes: "2026-06", mediana: 12, p90: 72, amostra: null, resolvidas: 5 },
    ]);
  });
});

/**
 * ---------------------------------------------------------------------------
 *  A unidade do tempo segue a magnitude — item 55, critérios 55.1 e 55.2
 * ---------------------------------------------------------------------------
 *
 * **A função é testada sozinha, e não através da tela.** Ela é o entregável durável do item: o 58 a chama
 * até três vezes por linha, para a mediana, o p90 e cada valor da amostra. Um teste que precisasse montar
 * componente não seria reutilizado por ele.
 *
 * **O defeito que estes casos guardam** é `0 h` para uma ocorrência resolvida em nove minutos, visto em
 * produção. Cada `it` abaixo é uma linha da tabela da spec §3.2.
 */
describe("duracaoEmTexto — a unidade segue a magnitude, e nada maior que zero vira zero", () => {
  it("abaixo de uma hora escreve minutos — `18 min` é o exemplo do critério 55.1", () => {
    expect(duracaoEmTexto(0.3)).toBe("18 min");
  });

  it("três minutos são três minutos, e não zero — o caso literal do critério 55.2", () => {
    expect(duracaoEmTexto(0.05)).toBe("3 min");
  });

  it("os doze minutos que a produção escrevia como `0 h`", () => {
    expect(duracaoEmTexto(0.2)).toBe("12 min");
  });

  it("meio minuto sobe ao piso de um, porque o zero era o defeito", () => {
    expect(duracaoEmTexto(0.008)).toBe("1 min");
  });

  it("zero continua zero — o critério 55.2 fala de valor MAIOR que zero, e uma casa decimal é o que a API dá", () => {
    expect(duracaoEmTexto(0)).toBe("0 min");
  });

  it("`60 min` não se escreve: a costura de baixo promove à faixa de cima", () => {
    expect(duracaoEmTexto(0.999)).toBe("1 h");
  });

  it("uma hora cravada já é hora, e não sessenta minutos", () => {
    expect(duracaoEmTexto(1)).toBe("1 h");
  });

  it("hora e pouco é uma hora, e nunca zero, porque a faixa começa em 1", () => {
    expect(duracaoEmTexto(1.4)).toBe("1 h");
  });

  it("de uma a 48 horas, horas inteiras — `41 h` é o exemplo do critério 55.1", () => {
    expect(duracaoEmTexto(41)).toBe("41 h");
  });

  it("48 h é o limite superior INCLUSIVO da faixa de horas", () => {
    expect(duracaoEmTexto(48)).toBe("48 h");
  });

  it("a costura de cima: o primeiro valor em dias diz a mesma coisa que `48 h`", () => {
    expect(duracaoEmTexto(48.1)).toBe("2,0 dias");
  });

  it("acima de 48 horas, dias com uma casa — `9,2 dias` é o exemplo do critério 55.1", () => {
    expect(duracaoEmTexto(220.8)).toBe("9,2 dias");
  });

  it("dia redondo mantém a casa — `3 dias` e `3,0 dias` não prometem a mesma precisão", () => {
    expect(duracaoEmTexto(72)).toBe("3,0 dias");
  });

  it("a vírgula é da ICU, e não de um `replace` sobre o resultado", () => {
    expect(duracaoEmTexto(100)).toBe("4,2 dias");
  });
});

/**
 * ---------------------------------------------------------------------------
 *  A linha do mês do quadro 4 — item 58, critérios 58.3, 58.4 e 58.5
 * ---------------------------------------------------------------------------
 *
 * **A função é testada sozinha, e não através da tela.** Três formas de linha, um plural, uma junção por
 * vírgula e a decisão de qual forma usar não cabem dentro do `.map` de um Server Component — é o mesmo
 * argumento do item 57: *"derivação dentro de um componente é derivação que nenhum teste do laço curto
 * alcança"*.
 *
 * **A formatação de unidade não é reescrita aqui.** Ela é `duracaoEmTexto`, do item 55, chamada uma, duas
 * ou três vezes conforme a forma.
 */
describe("a linha do mês do quadro 4 — mediana, p90, e o mês pequeno que mostra os valores crus", () => {
  const mes = (parcial: Partial<MesDoTempoDeResolucao>): MesDoTempoDeResolucao => ({
    mediana: null,
    p90: null,
    amostra: null,
    resolvidas: 0,
    ...parcial,
  });

  it("com quatro ou mais, escreve mediana e p90 rotulados — os rótulos são obrigatórios", () => {
    expect(textoDoTempoDeResolucao(mes({ mediana: 0.2, p90: 50.4, resolvidas: 11 }))).toBe(
      "mediana 12 min · p90 2,1 dias · 11 resolvidas",
    );
  });

  it("com quatro cravado, já é a forma de cima — é o primeiro mês acima do teto", () => {
    expect(textoDoTempoDeResolucao(mes({ mediana: 1, p90: 2, resolvidas: 4 }))).toBe(
      "mediana 1 h · p90 2 h · 4 resolvidas",
    );
  });

  it("com três ou menos, escreve as durações uma a uma e NÃO repete a mediana rotulada", () => {
    expect(
      textoDoTempoDeResolucao(mes({ mediana: 0.2, amostra: [0.1, 0.2, 72], resolvidas: 3 })),
    ).toBe("6 min, 12 min, 3,0 dias · 3 resolvidas");
  });

  it("com UMA resolução, o denominador vai no singular e a lista tem um valor", () => {
    expect(textoDoTempoDeResolucao(mes({ mediana: 0.1, amostra: [0.1], resolvidas: 1 }))).toBe(
      "6 min · 1 resolvida",
    );
  });

  it("dois minutos continuam dois minutos — as duas casas do item 58 e o critério 55.2", () => {
    expect(textoDoTempoDeResolucao(mes({ mediana: 0.03, amostra: [0.03], resolvidas: 1 }))).toBe(
      "2 min · 1 resolvida",
    );
  });

  it("mediana e p90 iguais escrevem o mesmo número duas vezes, e isso é correto", () => {
    expect(textoDoTempoDeResolucao(mes({ mediana: 3, p90: 3, resolvidas: 7 }))).toBe(
      "mediana 3 h · p90 3 h · 7 resolvidas",
    );
  });

  it("sem resolução, o travessão e o denominador em zero — critério 36.2, intacto", () => {
    expect(textoDoTempoDeResolucao(mes({}))).toBe("— · 0 resolvidas");
  });
});

/**
 * O item 61 — **a barra do quadro 4 é a mediana, em toda linha que tem barra**, e o caso é o medido no
 * Recanto Azul em 23/09/2026: julho com três resoluções e mediana de 6,1 dias, agosto com uma de 5,2.
 * **Os números vão em HORAS**, que é a unidade de `MesDoTempoDeResolucao`; o texto em dias sai de
 * `duracaoEmTexto`, e a asserção do texto prova que o caso é o mesmo que a tela mostrou.
 *
 * **Este teste passa também com o código de antes do item**, e é de propósito que isso está escrito: a
 * quantidade já era a mediana. O defeito era de desenho, o trilho de julho mais curto que o de agosto, e
 * o projeto `unitario` roda sem DOM. Quem pega o defeito é a medição em pixels de
 * `dashboard-e-paginacao.spec.ts`; este guarda a escolha do critério 61.1 contra regressão.
 */
describe("o item de cada mês do quadro 4 — a barra desenha a mediana (item 61)", () => {
  // Em horas: 125 h, 146 h e 247 h são 5,2, 6,1 e 10,3 dias; 124 h são 5,2 dias.
  const julho: MesDoTempoDeResolucao = {
    mediana: 146,
    p90: null,
    amostra: [125, 146, 247],
    resolvidas: 3,
  };
  const agosto: MesDoTempoDeResolucao = { mediana: 124, p90: null, amostra: [124], resolvidas: 1 };

  it("julho, de mediana maior, desenha mais que agosto — o caso medido do critério 61.2", () => {
    const itemDeJulho = itemDoTempoDeResolucao(julho, "jul");
    const itemDeAgosto = itemDoTempoDeResolucao(agosto, "ago");
    expect(itemDeJulho.texto).toBe("5,2 dias, 6,1 dias, 10,3 dias · 3 resolvidas");
    expect(itemDeAgosto.texto).toBe("5,2 dias · 1 resolvida");
    expect(itemDeJulho.quantidade).toBeGreaterThan(itemDeAgosto.quantidade);
  });

  it("a quantidade é a mediana, e o texto é a linha do mês, sem nada inventado no meio", () => {
    expect(itemDoTempoDeResolucao(julho, "jul")).toEqual({
      rotulo: "jul",
      quantidade: 146,
      texto: textoDoTempoDeResolucao(julho),
    });
  });

  it("com duas resoluções a barra é o ponto médio, que o texto não escreve — o rodapé diz o que ela é", () => {
    const dois: MesDoTempoDeResolucao = { mediana: 144, p90: null, amostra: [120, 168], resolvidas: 2 };
    expect(itemDoTempoDeResolucao(dois, "set").quantidade).toBe(144);
  });

  it("sem resolução, nenhuma barra: a frase no lugar dela, e o travessão no texto — critério 61.3", () => {
    const vazio: MesDoTempoDeResolucao = { mediana: null, p90: null, amostra: null, resolvidas: 0 };
    expect(itemDoTempoDeResolucao(vazio, "jun")).toEqual({
      rotulo: "jun",
      quantidade: 0,
      vazio: SEM_RESOLUCAO_NO_MES,
      texto: "— · 0 resolvidas",
    });
  });
});

/**
 * ---------------------------------------------------------------------------
 *  O cruzamento mensal do bloco 1 — item 57, critérios 57.1 e 57.7
 * ---------------------------------------------------------------------------
 *
 * **A função é testada sozinha, e é o critério 1 na letra:** *"a derivação mora onde o teste alcança, não
 * dentro do componente de cliente"*. O projeto `unitario` roda em `environment: "node"`, e um teste que
 * precisasse montar componente não alcançaria nada.
 *
 * **Ela não ordena e não preenche mês.** As duas coisas já aconteceram na Aplicação, e
 * `testes/aplicacao/dashboard.test.ts` as afirma lá. Aqui só se afirma o cruzamento.
 */
describe("o cruzamento mensal do bloco 1 — quanto entrou e quanto saiu", () => {
  const serie = (...quantidades: number[]) => ({
    porMes: quantidades.map((quantidade) => ({ quantidade })),
  });
  const resolucoes = (...quantidades: number[]) =>
    quantidades.map((resolvidas) => ({ resolvidas }));

  const MESES = ["jun", "jul"] as const;

  it("três registradas e cinco resolvidas em junho — o critério 57.7, literal", () => {
    const linhas = linhasDoFluxoMensal(
      [serie(2, 4), serie(1, 3)],
      resolucoes(5, 2),
      ["jun", "jul"],
    );

    expect(linhas[0]).toStrictEqual({ mes: "jun", registradas: 3, resolvidas: 5 });
  });

  it("a soma é por mês, e nunca do período — cada mês fecha com as séries daquele mês", () => {
    const linhas = linhasDoFluxoMensal(
      [serie(2, 4), serie(1, 3), serie(0, 1)],
      resolucoes(5, 2),
      MESES,
    );

    expect(linhas).toStrictEqual([
      { mes: "jun", registradas: 3, resolvidas: 5 },
      { mes: "jul", registradas: 8, resolvidas: 2 },
    ]);
  });

  it("série de categoria mais curta que o eixo lê zero no mês que falta, e nunca `undefined`", () => {
    // Uma `<Line>` com `undefined` num ponto desenha um buraco onde há um zero medido.
    const linhas = linhasDoFluxoMensal([serie(6)], resolucoes(1, 1), MESES);

    expect(linhas).toStrictEqual([
      { mes: "jun", registradas: 6, resolvidas: 1 },
      { mes: "jul", registradas: 0, resolvidas: 1 },
    ]);
  });

  it("sem categoria e sem resolução, uma linha por mês, todas a zero — a estrutura ensina o que vai ser medido", () => {
    expect(linhasDoFluxoMensal([], [], MESES)).toStrictEqual([
      { mes: "jun", registradas: 0, resolvidas: 0 },
      { mes: "jul", registradas: 0, resolvidas: 0 },
    ]);
  });

  it("o eixo manda: resolução a mais que os rótulos não vira mês", () => {
    const linhas = linhasDoFluxoMensal([serie(1)], resolucoes(1, 9), ["jun"]);

    expect(linhas).toStrictEqual([{ mes: "jun", registradas: 1, resolvidas: 1 }]);
  });

  it("a janela de um mês só tem uma linha — é o que `De` e `Até` no mesmo mês produzem", () => {
    expect(linhasDoFluxoMensal([serie(4)], resolucoes(2), ["jun"])).toStrictEqual([
      { mes: "jun", registradas: 4, resolvidas: 2 },
    ]);
  });

  it("a virada do ano chega pronta nos rótulos, e as chaves da lista continuam distintas", () => {
    // `rotulosDosMeses` acrescenta o ano ao eixo inteiro quando a janela atravessa dezembro, e o rótulo
    // é a chave de cada `<li>` da lista de meses.
    const linhas = linhasDoFluxoMensal([serie(1, 2)], resolucoes(0, 3), ["dez/25", "jan/26"]);

    expect(linhas.map((linha) => linha.mes)).toStrictEqual(["dez/25", "jan/26"]);
    expect(new Set(linhas.map((linha) => linha.mes)).size).toBe(2);
  });

  it("o singular vale dos dois lados — `1 registrada · 1 resolvida`", () => {
    expect(textoDoFluxoMensal({ mes: "jun", registradas: 1, resolvidas: 1 })).toBe(
      "1 registrada · 1 resolvida",
    );
  });

  it("o plural e o zero — `0 registradas · 5 resolvidas`", () => {
    expect(textoDoFluxoMensal({ mes: "jun", registradas: 0, resolvidas: 5 })).toBe(
      "0 registradas · 5 resolvidas",
    );
  });
});

/**
 * ---------------------------------------------------------------------------
 *  A idade do que está em aberto — item 59, critérios 4, 5 e 6
 * ---------------------------------------------------------------------------
 *
 * **O módulo é testado sozinho, e não através da tela**, pela razão dos itens 57 e 58: derivação dentro
 * de um componente é derivação que nenhum teste do laço curto alcança.
 *
 * **Ele não importa a constante dos limites.** O `90` já chega na faixa, em `deDias`, e ler o mesmo
 * número de duas fontes numa frase só é estar errado justamente quando elas discordam — o caso normal
 * durante um deploy, com uma resposta servida pela versão anterior.
 */
describe("rotuloDaFaixaDeIdade — os dois números escritos em português", () => {
  it("a primeira faixa se escreve com `Até`, porque começar em zero não se diz", () => {
    expect(rotuloDaFaixaDeIdade({ deDias: 0, ateDias: 7, quantidade: 0 })).toBe("Até 7 dias");
  });

  it("as do meio levam os dois números", () => {
    expect(rotuloDaFaixaDeIdade({ deDias: 8, ateDias: 30, quantidade: 0 })).toBe("8 a 30 dias");
    expect(rotuloDaFaixaDeIdade({ deDias: 31, ateDias: 90, quantidade: 0 })).toBe("31 a 90 dias");
  });

  it("a faixa sem teto diz `Mais de`, e o número é o limite dela, não o começo", () => {
    expect(rotuloDaFaixaDeIdade({ deDias: 91, ateDias: null, quantidade: 0 })).toBe(
      "Mais de 90 dias",
    );
  });

  it("um dia é um dia — o singular vale, porque os limites são de quem opera", () => {
    // Se o dono trocar `LIMITES_DAS_FAIXAS_DE_IDADE` para `[1, 7, 30]`, estas são as duas primeiras
    // linhas da tela — `{0, 1}` e `{2, 7}`, que é o que a derivação de `FAIXAS_DE_IDADE` produz.
    expect(rotuloDaFaixaDeIdade({ deDias: 0, ateDias: 1, quantidade: 0 })).toBe("Até 1 dia");
    expect(rotuloDaFaixaDeIdade({ deDias: 2, ateDias: 7, quantidade: 0 })).toBe("2 a 7 dias");
  });
});

/** As quatro faixas do corte de hoje, com a quantidade da faixa mais velha por parâmetro. */
const faixasCom = (naMaisVelha: number) => [
  { deDias: 0, ateDias: 7, quantidade: 12 },
  { deDias: 8, ateDias: 30, quantidade: 5 },
  { deDias: 31, ateDias: 90, quantidade: 2 },
  { deDias: 91, ateDias: null, quantidade: naMaisVelha },
];

describe("textoDaIdadeEmAberto — uma oração sempre, duas quando há o que apontar", () => {
  const SEMPRE = "Há quanto tempo o que está em aberto espera, contando do registro.";

  it("com a faixa mais velha em zero, só a oração que diz o que o quadro mede — critério 6", () => {
    expect(textoDaIdadeEmAberto(faixasCom(0))).toBe(SEMPRE);
  });

  it("a organização recém-criada, com tudo a zero, lê a mesma oração", () => {
    const zeradas = faixasCom(0).map((faixa) => ({ ...faixa, quantidade: 0 }));
    expect(textoDaIdadeEmAberto(zeradas)).toBe(SEMPRE);
  });

  it("uma na faixa mais velha: a palavra que distingue, no singular — critério 5", () => {
    expect(textoDaIdadeEmAberto(faixasCom(1))).toBe(`${SEMPRE} 1 espera há mais de 90 dias.`);
  });

  it("quatro na faixa mais velha: o plural sai do número", () => {
    expect(textoDaIdadeEmAberto(faixasCom(4))).toBe(`${SEMPRE} 4 esperam há mais de 90 dias.`);
  });

  it("a faixa mais velha é a ÚLTIMA do array, e não a que alguém procurar por `ateDias`", () => {
    // O array vem ordenado por construção da Aplicação. Uma segunda regra de *qual é a mais velha* seria
    // a segunda que envelhece — então a função lê a última, e esta linha é o que fixa isso.
    const fora = [
      { deDias: 91, ateDias: null, quantidade: 0 },
      { deDias: 0, ateDias: 7, quantidade: 9 },
    ];
    expect(textoDaIdadeEmAberto(fora)).toBe(`${SEMPRE} 9 esperam há até 7 dias.`);
  });

  it("sem faixa nenhuma, a oração continua — a tela nunca fica sem a linha que explica", () => {
    expect(textoDaIdadeEmAberto([])).toBe(SEMPRE);
  });
});

/**
 * ---------------------------------------------------------------------------
 *  A dupla na tela — item 60, critérios 60.3 e 60.4
 * ---------------------------------------------------------------------------
 *
 * **As três funções são testadas sozinhas, e não através da tela**, pela razão dos itens 57, 58 e 59:
 * derivação dentro de um componente é derivação que nenhum teste do laço curto alcança.
 */
describe("a dupla na tela — o rótulo, a chave e a frase de vazio", () => {
  const VAZAMENTO_NA_GARAGEM = {
    area: { id: "a-1", nome: "Garagem — Subsolo 1" },
    categoria: { id: "c-1", nome: "Vazamentos" },
    quantidade: 8,
  };

  /** **Área primeiro**, como o critério 60.4 escreve a dupla — e a frase do cartão é prosa, não alvo. */
  it("escreve área e categoria nessa ordem, com o separador do vocabulário da tela", () => {
    expect(rotuloDaDupla(VAZAMENTO_NA_GARAGEM)).toBe("Garagem — Subsolo 1 · Vazamentos");
  });

  /**
   * **A chave sai dos identificadores, e nunca do rótulo.** Uma Área e uma Categoria homônimas na mesma
   * organização produziriam a mesma chave pelo nome, e `key` duplicada em React é defeito silencioso.
   */
  it("a chave usa os identificadores, então nomes iguais com ids diferentes não colidem", () => {
    const outra = {
      area: { id: "a-2", nome: "Garagem — Subsolo 1" },
      categoria: { id: "c-2", nome: "Vazamentos" },
      quantidade: 3,
    };

    expect(chaveDaDupla(VAZAMENTO_NA_GARAGEM)).toBe("a-1:c-1");
    expect(chaveDaDupla(outra)).not.toBe(chaveDaDupla(VAZAMENTO_NA_GARAGEM));
  });

  /** O critério 60.3: a frase diz o que aconteceu e o que vai aparecer ali, e não avisa defeito nenhum. */
  it("a frase de vazio diz o que vai aparecer na seção", () => {
    expect(SEM_DUPLA_RECORRENTE).toBe(
      "Nenhuma dupla se repetiu no período. Aqui aparece a mesma categoria voltando na mesma área, " +
        "a partir da segunda vez.",
    );
  });
});
