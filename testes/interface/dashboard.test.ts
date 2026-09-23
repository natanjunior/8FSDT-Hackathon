import { describe, expect, it } from "vitest";

import type { DashboardLido } from "@/aplicacao/dashboard";
import { duracaoEmTexto } from "@/interface/componentes/duracao";
import { linhasDoFluxoMensal, textoDoFluxoMensal } from "@/interface/componentes/fluxo-mensal";
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
  tempoMedioDeResolucao: { porMes: [{ mes: "2026-06", horas: 72, resolvidas: 5 }] },
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

  it("a categoria sai com dois campos — o contrato a declara inline, sem ícone", () => {
    const [serie] = projetarDashboard(LIDO).recorrenciaPorCategoria;
    expect(serie?.categoria).toStrictEqual({ id: "c-1", nome: "Vazamento" });
  });

  it("o periodo é ecoado, e os três blocos de número atravessam sem alteração", () => {
    const projetado = projetarDashboard(LIDO);
    expect(projetado.periodo).toStrictEqual({ de: "2026-06-01", ate: "2026-08-29" });
    expect(projetado.mediaDasAvaliacoes).toStrictEqual({ media: 4.2, avaliadas: 6, resolvidas: 14 });
    expect(projetado.tempoMedioDeResolucao.porMes).toStrictEqual([
      { mes: "2026-06", horas: 72, resolvidas: 5 },
    ]);
  });
});

/**
 * ---------------------------------------------------------------------------
 *  A unidade do tempo segue a magnitude — item 55, critérios 55.1 e 55.2
 * ---------------------------------------------------------------------------
 *
 * **A função é testada sozinha, e não através da tela.** Ela é o entregável durável do item: o 58 a chama
 * três vezes por linha, para média, mediana e p90. Um teste que precisasse montar componente não seria
 * reutilizado por ele.
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
