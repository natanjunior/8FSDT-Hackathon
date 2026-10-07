import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { atalhosDaJanela } from "@/aplicacao/dashboard";
import {
  CHAVES_DE_ATALHO,
  deDia,
  diaEmTexto,
  ehAFaixaAplicada,
  limitesDoCalendario,
  nomeDaFaixa,
  paraDia,
  rotuloDaFaixa,
} from "@/interface/componentes/faixa-de-periodo";
import type { DashboardLido } from "@/aplicacao/dashboard";
import { STATUS, type StatusOcorrencia } from "@/dominio/ocorrencia";
import { COR_PADRAO_DA_BARRA, corDoStatusNaBarra, degrauDaEscala } from "@/interface/componentes/cor-das-barras";
import { duracaoEmTexto, SEM_DURACAO } from "@/interface/componentes/duracao";
import {
  chaveDaDupla,
  corteDeTopo,
  fraseDoDenominadorDasDuplas,
  fraseDoResto,
  rotuloDaDupla,
  SEM_DUPLA_RECORRENTE,
} from "@/interface/componentes/duplas-recorrentes";
import { tetoDoEixo } from "@/interface/componentes/teto-do-eixo";
import {
  linhasDoFluxoMensal,
  mesParcial,
  nomeCompletoDoMes,
  saldoDoPeriodo,
  trechoDoMes,
  vereditoDoFluxo,
  type LinhaDoFluxoMensal,
} from "@/interface/componentes/fluxo-mensal";
import {
  dias,
  parteDoTotal,
  rodapeDaIdade,
  rotuloDaFaixaDeIdade,
  totalEmAberto,
  vereditoDaIdade,
} from "@/interface/componentes/idade-em-aberto";
import {
  denominadorDaSatisfacao,
  rotuloDaNota,
  segundoTermoDoEmAberto,
  segundoTermoDoSaldo,
  textoDoSaldo,
  textoDoValorDaCategoria,
} from "@/interface/componentes/indicadores-do-painel";
import {
  celulasDoTempo,
  SEM_RESOLUCAO_NO_MES,
  unidadeDoEixo,
  vereditoDoTempo,
  type MesDoTempoDeResolucao,
} from "@/interface/componentes/tempo-de-resolucao";
import { FormatoInvalido, lerJanelaDoDashboardDaUrl, trocarJanelaInvertida } from "@/interface/http";
import { cn } from "@/interface/componentes/utilitarios";
import { nomeDoStatus, projetarDashboard } from "@/interface/projecoes";

const consulta = (bruto: string) => new URLSearchParams(bruto);

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const ler = (relativo: string): string => readFileSync(RAIZ + relativo, "utf8");

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

describe("a troca da janela invertida — gesto da tela, e a API continua recusando", () => {
  it("de depois de ate troca os dois e avisa — critério 69.3", () => {
    const { consulta: trocada, trocada: avisa } = trocarJanelaInvertida(
      consulta("de=2026-09-29&ate=2026-07-01"),
    );
    expect(avisa).toBe(true);
    expect(lerJanelaDoDashboardDaUrl(trocada)).toStrictEqual({ de: "2026-07-01", ate: "2026-09-29" });
  });

  it("não altera a consulta recebida", () => {
    const original = consulta("de=2026-09-29&ate=2026-07-01");
    trocarJanelaInvertida(original);
    expect(original.toString()).toBe("de=2026-09-29&ate=2026-07-01");
  });

  it("os outros parâmetros atravessam intactos", () => {
    const { consulta: trocada } = trocarJanelaInvertida(
      consulta("de=2026-09-29&ate=2026-07-01&organizacao=x"),
    );
    expect(trocada.get("organizacao")).toBe("x");
  });

  it("na ordem certa, não troca nem avisa", () => {
    const { consulta: mesma, trocada } = trocarJanelaInvertida(consulta("de=2026-07-01&ate=2026-09-29"));
    expect(trocada).toBe(false);
    expect(mesma.toString()).toBe("de=2026-07-01&ate=2026-09-29");
  });

  it("datas iguais são uma janela de um dia, e não uma inversão", () => {
    expect(trocarJanelaInvertida(consulta("de=2026-07-01&ate=2026-07-01")).trocada).toBe(false);
  });

  it("com uma data só não há o que inverter", () => {
    expect(trocarJanelaInvertida(consulta("de=2026-09-29")).trocada).toBe(false);
    expect(trocarJanelaInvertida(consulta("ate=2026-07-01")).trocada).toBe(false);
  });

  it("data mal formada não é trocada, e a recusa de formato continua valendo", () => {
    for (const bruto of ["de=2026-09-31&ate=2026-07-01", "de=29/09/2026&ate=2026-07-01"]) {
      const { consulta: mesma, trocada } = trocarJanelaInvertida(consulta(bruto));
      expect(trocada).toBe(false);
      expect(() => lerJanelaDoDashboardDaUrl(mesma)).toThrow(FormatoInvalido);
    }
  });

  it("parâmetro repetido não é trocado, e continua 400", () => {
    const { consulta: mesma, trocada } = trocarJanelaInvertida(
      consulta("de=2026-09-29&de=2026-08-01&ate=2026-07-01"),
    );
    expect(trocada).toBe(false);
    expect(() => lerJanelaDoDashboardDaUrl(mesma)).toThrow(FormatoInvalido);
  });
});

describe("a tradução entre o dia do endereço e o dia do calendário — item 71", () => {
  it("a ida e a volta devolvem o mesmo dia, inclusive em ano bissexto", () => {
    for (const dia of ["2026-07-01", "2026-12-31", "2026-01-01", "2024-02-29"]) {
      expect(paraDia(deDia(dia))).toBe(dia);
    }
  });

  it("o instante montado é o meio-dia local, e não a meia-noite universal", () => {
    // Meia-noite em tempo universal cai no dia anterior em todo fuso a oeste, que é o do produto inteiro.
    const data = deDia("2026-07-01");
    expect(data.getHours()).toBe(12);
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(6);
    expect(data.getDate()).toBe(1);
  });

  it("a leitura é pelas partes locais, e a hora do dia não muda o dia", () => {
    // `toISOString().slice(0, 10)` devolveria 02/07 para quem escolhesse às 21h no horário de Brasília.
    for (const hora of [0, 8, 12, 21, 23]) {
      expect(paraDia(new Date(2026, 6, 1, hora, 30))).toBe("2026-07-01");
    }
    expect(paraDia(new Date(2025, 11, 31, 23, 0))).toBe("2025-12-31");
    expect(paraDia(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
  });

  it("o texto do dia reordena os três pedaços, sem tocar em fuso nenhum", () => {
    expect(diaEmTexto("2026-07-01")).toBe("01/07/2026");
    expect(diaEmTexto("2026-07-01")).not.toBe("30/06/2026");
  });

  it("o rótulo do gatilho é o intervalo com travessão curto", () => {
    expect(rotuloDaFaixa({ de: "2026-07-01", ate: "2026-09-29" })).toBe("01/07/2026 – 29/09/2026");
  });

  it("o nome acessível contém o rótulo visível inteiro — a regra de rótulo no nome", () => {
    const periodo = { de: "2026-07-01", ate: "2026-09-29" };
    expect(nomeDaFaixa(periodo)).toContain(rotuloDaFaixa(periodo));
    expect(nomeDaFaixa(periodo)).toBe("Período: 01/07/2026 – 29/09/2026");
  });
});

describe("qual atalho é o recorte aplicado — item 71, critério 2", () => {
  const AGORA_DA_TELA = "2026-08-30T02:00:00.000Z";
  const ATALHOS = atalhosDaJanela(AGORA_DA_TELA);

  it("as quatro chaves da Interface são as quatro janelas da Aplicação", () => {
    expect([...CHAVES_DE_ATALHO].sort()).toStrictEqual(Object.keys(ATALHOS).sort());
  });

  it("cada um dos quatro se reconhece quando é o recorte", () => {
    for (const chave of CHAVES_DE_ATALHO) {
      expect(ehAFaixaAplicada(ATALHOS[chave], ATALHOS[chave]), chave).toBe(true);
    }
  });

  it("recorte que não é nenhum dos quatro não acende nenhum", () => {
    const outro = { de: "2026-01-01", ate: "2026-01-31" };
    for (const chave of CHAVES_DE_ATALHO) {
      expect(ehAFaixaAplicada(outro, ATALHOS[chave]), chave).toBe(false);
    }
  });

  it("basta uma ponta diferente para não ser o atalho", () => {
    expect(ehAFaixaAplicada({ de: "2026-06-02", ate: "2026-08-29" }, ATALHOS.noventa)).toBe(false);
  });

  it("no dia 7 e no dia 30 dois atalhos são a mesma janela, e os dois apagam", () => {
    // O defeito que a pergunta por atalho evita: uma função que devolvesse "qual dos quatro" apagaria o
    // primeiro da lista e deixaria o outro aceso oferecendo um toque que não faz nada.
    const dia7 = atalhosDaJanela("2026-09-07T15:00:00.000Z");
    expect(dia7.sete).toStrictEqual(dia7.mes);
    expect(ehAFaixaAplicada(dia7.mes, dia7.sete)).toBe(true);
    expect(ehAFaixaAplicada(dia7.mes, dia7.mes)).toBe(true);

    const dia30 = atalhosDaJanela("2026-09-30T15:00:00.000Z");
    expect(dia30.trinta).toStrictEqual(dia30.mes);
    expect(ehAFaixaAplicada(dia30.mes, dia30.trinta)).toBe(true);

    // E a janela de 90 dias nunca empata com as outras três, que é o que o critério 2 nomeia.
    for (const atalhos of [dia7, dia30]) {
      for (const chave of ["sete", "trinta", "mes"] as const) {
        expect(ehAFaixaAplicada(atalhos.noventa, atalhos[chave]), chave).toBe(false);
      }
    }
  });
});

describe("o alcance dos menus de mês e de ano — item 71", () => {
  it("o menu oferece cinco anos para trás e o ano que vem inteiro", () => {
    const { inicio, fim } = limitesDoCalendario({ de: "2026-07-01", ate: "2026-09-29" });
    expect(paraDia(inicio)).toBe("2021-01-01");
    expect(paraDia(fim)).toBe("2027-12-31");
  });

  it("o recorte aplicado sempre cabe no alcance, mesmo vindo de um endereço antigo", () => {
    const { inicio, fim } = limitesDoCalendario({ de: "1900-01-01", ate: "2026-09-29" });
    expect(paraDia(inicio)).toBe("1900-01-01");
    expect(deDia("1900-01-01").getTime()).toBeGreaterThanOrEqual(inicio.getTime());
    expect(deDia("2026-09-29").getTime()).toBeLessThanOrEqual(fim.getTime());
  });
});

describe("o tamanho da casa do calendário — desvio D1 do plano do 71", () => {
  it("a classe da chamada vence a do registro, que é do que o alvo de 44 px depende", () => {
    // O registro do `calendar` escreve `[--cell-size:--spacing(8)]`, que é 32 px. O alvo de toque do lote
    // é 44 px, e quem o impõe é a chamada. Se esta fusão deixar as duas classes de pé, a ordem no CSS
    // decide, e o tamanho da casa passa a depender de sorte.
    expect(cn("[--cell-size:--spacing(8)]", "[--cell-size:--spacing(11)]")).toBe(
      "[--cell-size:--spacing(11)]",
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
  abertasPorCategoria: [
    { categoria: { id: "c-1", nome: "Vazamento" }, quantidade: 7, envelhecidas: 3 },
  ],
  abertasPorIdade: [
    { deDias: 0, ateDias: 7, quantidade: 12 },
    { deDias: 8, ateDias: 30, quantidade: 5 },
    { deDias: 31, ateDias: 90, quantidade: 2 },
    { deDias: 91, ateDias: null, quantidade: 1 },
  ],
  mediaDasAvaliacoes: {
    media: 4.2,
    avaliadas: 6,
    resolvidas: 14,
    distribuicao: [
      { nota: 1, quantidade: 0 },
      { nota: 2, quantidade: 0 },
      { nota: 3, quantidade: 1 },
      { nota: 4, quantidade: 3 },
      { nota: 5, quantidade: 2 },
    ],
  },
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
  canceladasPorMes: [{ mes: "2026-06", quantidade: 2 }],
  emAbertoNoInicio: 11,
  maisVelhasEmAberto: [
    { id: "o-1", titulo: "Portão travado", status: "pausada", idadeEmDias: 120 },
    { id: "o-2", titulo: "Lâmpada do hall", status: "em_atendimento", idadeEmDias: 45 },
  ],
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

  it("o painel fala a coluna do Gestor, e não tem como ler rótulo de organização — item 100, critério 4", () => {
    // `LENTE_DO_DASHBOARD` é `LENTE_DO_GESTOR`, que é o ramo SEM rótulos: não é escolha do corpo da
    // função, é o tipo que não carrega o campo.
    for (const linha of projetarDashboard(LIDO).backlogPorStatus) {
      expect(linha.statusRotulo).toBe(nomeDoStatus(linha.status as StatusOcorrencia));
    }
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
      { categoria: { id: "c-1", nome: "Vazamento" }, quantidade: 7, envelhecidas: 3 },
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
    expect(projetado.mediaDasAvaliacoes).toStrictEqual({
      media: 4.2,
      avaliadas: 6,
      resolvidas: 14,
      distribuicao: LIDO.mediaDasAvaliacoes.distribuicao,
    });
    expect(projetado.tempoDeResolucao.porMes).toStrictEqual([
      { mes: "2026-06", mediana: 12, p90: 72, amostra: null, resolvidas: 5 },
    ]);
  });

  /** O rótulo depende de quem lê, e a lente do painel é a do Gestor — como no backlog por status. */
  it("as mais velhas ganham o statusRotulo do Gestor", () => {
    expect(
      projetarDashboard(LIDO).maisVelhasEmAberto.map((o) => [o.status, o.statusRotulo]),
    ).toStrictEqual([
      ["pausada", "Pausada"],
      ["em_atendimento", "Em atendimento"],
    ]);
  });

  it("a distribuição, as envelhecidas, as canceladas e o início atravessam sem alteração", () => {
    const projetado = projetarDashboard(LIDO);
    expect(projetado.mediaDasAvaliacoes.distribuicao).toStrictEqual(
      LIDO.mediaDasAvaliacoes.distribuicao,
    );
    expect(projetado.abertasPorCategoria[0]?.envelhecidas).toBe(3);
    expect(projetado.canceladasPorMes).toStrictEqual([{ mes: "2026-06", quantidade: 2 }]);
    expect(projetado.emAbertoNoInicio).toBe(11);
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
 *
 * Desde o item 62, o piso é `menos de 1 min` e o zero é o travessão; as duas asserções do 55 que diziam
 * outra coisa trocaram de valor por critério.
 */
describe("duracaoEmTexto — a unidade segue a magnitude, e nada maior que zero vira zero", () => {
  it("abaixo de uma hora escreve minutos — `18 min` é o exemplo do critério 55.1", () => {
    expect(duracaoEmTexto(0.3)).toBe("18 min");
  });

  it("três minutos são três minutos, e não zero — o caso literal do critério 55.2, e o terceiro caso do 62.4", () => {
    expect(duracaoEmTexto(0.05)).toBe("3 min");
  });

  it("os doze minutos que a produção escrevia como `0 h`", () => {
    expect(duracaoEmTexto(0.2)).toBe("12 min");
  });

  it("zero é o travessão — critério 62.3, e o primeiro dos três casos do 62.4", () => {
    expect(duracaoEmTexto(0)).toBe("—");
    expect(duracaoEmTexto(0)).toBe(SEM_DURACAO);
  });

  it("catorze segundos são `menos de 1 min` — o segundo caso do 62.4, e o que a Aurora escrevia como zero", () => {
    expect(duracaoEmTexto(0.004)).toBe("menos de 1 min");
  });

  it("meio minuto também é `menos de 1 min`: o piso novo substitui o `1 min` do item 55 (critério 62.1)", () => {
    expect(duracaoEmTexto(0.008)).toBe("menos de 1 min");
  });

  it("o menor valor que a API publica ainda é `menos de 1 min`, e nunca o travessão", () => {
    expect(duracaoEmTexto(0.0001)).toBe("menos de 1 min");
  });

  it("a costura do minuto cheio: 59,8 s ainda é menos de um minuto, 60,1 s já é `1 min`", () => {
    expect(duracaoEmTexto(0.0166)).toBe("menos de 1 min");
    expect(duracaoEmTexto(0.0167)).toBe("1 min");
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
 *  O quadro 3 — o eixo, o veredito e a tabela do tempo de resolução (item 73)
 * ---------------------------------------------------------------------------
 *
 * **As funções são testadas sozinhas, e não através da tela**, pelo argumento do item 57: derivação
 * dentro de um componente é derivação que nenhum teste do laço curto alcança. A unidade continua sendo
 * `duracaoEmTexto`, do item 55, chamada.
 */
const mesDoTempo = (
  parcial: Partial<MesDoTempoDeResolucao> & { mes: string },
): MesDoTempoDeResolucao => ({
  mediana: null,
  p90: null,
  amostra: null,
  resolvidas: 0,
  ...parcial,
});

describe("unidadeDoEixo — segue a magnitude do maior valor desenhado", () => {
  it.each([
    [0.5, { divisor: 1 / 60, sufixo: "min" }],
    [12, { divisor: 1, sufixo: "h" }],
    [604, { divisor: 24, sufixo: "d" }],
  ])("%f h → %o", (maior, esperado) => {
    expect(unidadeDoEixo(maior)).toStrictEqual(esperado);
  });
});

describe("vereditoDoTempo — o mês mais recente que teve resolução", () => {
  it("com p90", () => {
    expect(
      vereditoDoTempo(
        [
          mesDoTempo({ mes: "2026-08", mediana: 137, p90: 326, resolvidas: 14 }),
          mesDoTempo({ mes: "2026-09", mediana: 76.8, p90: 237.6, resolvidas: 5 }),
        ],
        false,
      ),
    ).toBe(
      "Em setembro, metade das resoluções levou até 3,2 dias, e uma em cada dez levou mais de 9,9 dias.",
    );
  });

  it("com amostra pequena", () => {
    expect(
      vereditoDoTempo(
        [mesDoTempo({ mes: "2026-09", mediana: 25.5, p90: null, amostra: [3, 48], resolvidas: 2 })],
        false,
      ),
    ).toBe("Em setembro houve 2 resoluções: 3 h e 48 h.");
  });

  it("pula o mês vazio no fim", () => {
    const meses = [
      mesDoTempo({ mes: "2026-08", mediana: 3, p90: null, amostra: [3], resolvidas: 1 }),
      mesDoTempo({ mes: "2026-09" }),
    ];
    expect(vereditoDoTempo(meses, false)).toBe("Em agosto houve 1 resolução: 3 h.");
  });

  it("nenhuma resolução no período", () => {
    expect(vereditoDoTempo([mesDoTempo({ mes: "2026-09" })], false)).toBe(
      "Nenhuma resolução no período.",
    );
  });

  it("leva o ano quando o eixo atravessa a virada", () => {
    expect(
      vereditoDoTempo(
        [mesDoTempo({ mes: "2025-12", mediana: 3, p90: null, amostra: [3], resolvidas: 1 })],
        true,
      ),
    ).toBe("Em dezembro de 2025 houve 1 resolução: 3 h.");
  });
});

describe("celulasDoTempo — as colunas da tabela do Ver dados", () => {
  it("o mês vazio escreve a frase do contrato", () => {
    expect(celulasDoTempo(mesDoTempo({ mes: "2026-06" })).mediana).toBe(SEM_RESOLUCAO_NO_MES);
  });

  it("o mês pequeno escreve as durações no lugar do p90", () => {
    expect(
      celulasDoTempo(
        mesDoTempo({ mes: "2026-09", mediana: 25.5, p90: null, amostra: [3, 48], resolvidas: 2 }),
      ).p90,
    ).toBe("durações: 3 h e 48 h");
  });

  it("o mês grande escreve mediana e p90 pela mesma função de duração", () => {
    expect(
      celulasDoTempo(mesDoTempo({ mes: "2026-08", mediana: 0.2, p90: 50.4, resolvidas: 11 })),
    ).toStrictEqual({ mediana: "12 min", p90: "2,1 dias", resolvidas: "11" });
  });

  it("o mês vazio tem o travessão no p90 e zero resoluções", () => {
    expect(celulasDoTempo(mesDoTempo({ mes: "2026-06" }))).toStrictEqual({
      mediana: SEM_RESOLUCAO_NO_MES,
      p90: SEM_DURACAO,
      resolvidas: "0",
    });
  });
});

/**
 * ---------------------------------------------------------------------------
 *  O quadro 1 — entradas, saídas, saldo e mês parcial (item 73)
 * ---------------------------------------------------------------------------
 *
 * **A função é testada sozinha**, e é o critério 57.1 na letra: *"a derivação mora onde o teste alcança,
 * não dentro do componente de cliente"*. Ela não ordena e não preenche mês; as duas coisas já aconteceram
 * na Aplicação.
 */
const NOVENTA = { de: "2026-06-27", ate: "2026-09-24" };

const linhaDoFluxo = (
  parcial: Partial<LinhaDoFluxoMensal> & { mes: string },
): LinhaDoFluxoMensal => ({
  rotulo: parcial.mes,
  parcial: false,
  registradas: 0,
  resolvidas: 0,
  canceladas: 0,
  saidas: 0,
  saldo: 0,
  ...parcial,
});

describe("nomeCompletoDoMes — o nome inteiro, com o ano na virada", () => {
  it("agosto, sem ano", () => {
    expect(nomeCompletoDoMes("2026-08", false)).toBe("agosto");
  });

  it("dezembro de 2025, com ano", () => {
    expect(nomeCompletoDoMes("2025-12", true)).toBe("dezembro de 2025");
  });
});

describe("mesParcial — a janela corta o mês", () => {
  it.each([
    ["2026-06", NOVENTA, true], // começa no dia 27
    ["2026-07", NOVENTA, false],
    ["2026-09", NOVENTA, true], // termina no dia 24
    ["2026-02", { de: "2026-02-01", ate: "2026-02-28" }, false], // fevereiro inteiro, sem bissexto
    ["2024-02", { de: "2024-02-01", ate: "2024-02-28" }, true], // bissexto: falta o 29
  ] as const)("%s em %o é parcial: %s", (mes, periodo, esperado) => {
    expect(mesParcial(mes, periodo)).toBe(esperado);
  });
});

describe("as linhas do fluxo — entradas, saídas e saldo por mês", () => {
  const series = [
    {
      porMes: [
        { mes: "2026-06", quantidade: 2 },
        { mes: "2026-07", quantidade: 19 },
      ],
    },
    {
      porMes: [
        { mes: "2026-06", quantidade: 0 },
        { mes: "2026-07", quantidade: 3 },
      ],
    },
  ];
  const resolucoes = [
    { mes: "2026-06", resolvidas: 0 },
    { mes: "2026-07", resolvidas: 18 },
  ];
  const canceladas = [
    { mes: "2026-06", quantidade: 1 },
    { mes: "2026-07", quantidade: 2 },
  ];
  const periodo = { de: "2026-06-27", ate: "2026-07-31" };

  it("soma as séries no que entrou, e resolvidas mais canceladas no que saiu", () => {
    expect(linhasDoFluxoMensal(series, resolucoes, canceladas, periodo)).toStrictEqual([
      {
        mes: "2026-06",
        rotulo: "jun*",
        parcial: true,
        registradas: 2,
        resolvidas: 0,
        canceladas: 1,
        saidas: 1,
        saldo: 1,
      },
      {
        mes: "2026-07",
        rotulo: "jul",
        parcial: false,
        registradas: 22,
        resolvidas: 18,
        canceladas: 2,
        saidas: 20,
        saldo: 2,
      },
    ]);
  });

  it("o mês com cancelamento e nenhuma resolução tem saída", () => {
    const [junho] = linhasDoFluxoMensal(series, resolucoes, canceladas, periodo);
    expect(junho?.saidas).toBe(1);
  });

  it("a soma da coluna saldo é o saldo do período", () => {
    const linhas = linhasDoFluxoMensal(series, resolucoes, canceladas, periodo);
    expect(saldoDoPeriodo(linhas)).toStrictEqual({ entraram: 24, sairam: 21, saldo: 3 });
    expect(linhas.reduce((t, l) => t + l.saldo, 0)).toBe(saldoDoPeriodo(linhas).saldo);
  });

  it("o eixo que atravessa a virada leva o ano no rótulo", () => {
    const virada = linhasDoFluxoMensal(
      [
        {
          porMes: [
            { mes: "2025-12", quantidade: 1 },
            { mes: "2026-01", quantidade: 1 },
          ],
        },
      ],
      [
        { mes: "2025-12", resolvidas: 0 },
        { mes: "2026-01", resolvidas: 0 },
      ],
      [
        { mes: "2025-12", quantidade: 0 },
        { mes: "2026-01", quantidade: 0 },
      ],
      { de: "2025-12-15", ate: "2026-01-31" },
    );
    expect(virada.map((l) => l.rotulo)).toStrictEqual(["dez/25*", "jan/26"]);
  });

  it("sem categoria e sem cancelamento, uma linha por mês, todas a zero", () => {
    expect(
      linhasDoFluxoMensal([], resolucoes, [], periodo).map((l) => [l.registradas, l.saidas]),
    ).toStrictEqual([
      [0, 0],
      [0, 18],
    ]);
  });
});

describe("trechoDoMes — o pedaço do mês que o período alcança", () => {
  it("o mês cortado no começo e o cortado no fim", () => {
    expect(trechoDoMes("2026-06", NOVENTA)).toBe("de 27 a 30/06");
    expect(trechoDoMes("2026-09", NOVENTA)).toBe("de 01 a 24/09");
  });
});

describe("vereditoDoFluxo — o último mês completo", () => {
  it("fala do último mês inteiro, e não do parcial", () => {
    const linhas = [
      linhaDoFluxo({ mes: "2026-07", parcial: false, registradas: 19, saidas: 18 }),
      linhaDoFluxo({ mes: "2026-08", parcial: false, registradas: 22, saidas: 18 }),
      linhaDoFluxo({ mes: "2026-09", parcial: true, registradas: 74, saidas: 9 }),
    ];
    expect(vereditoDoFluxo(linhas)).toBe("Em agosto, o último mês completo, entraram 22 e saíram 18.");
  });

  it("sem mês completo, diz isso", () => {
    expect(vereditoDoFluxo([linhaDoFluxo({ mes: "2026-09", parcial: true })])).toBe(
      "O período não tem mês completo.",
    );
  });

  it("leva o ano quando o eixo atravessa a virada", () => {
    const linhas = [
      linhaDoFluxo({ mes: "2025-12", parcial: false, registradas: 3, saidas: 1 }),
      linhaDoFluxo({ mes: "2026-01", parcial: true }),
    ];
    expect(vereditoDoFluxo(linhas)).toBe(
      "Em dezembro de 2025, o último mês completo, entraram 3 e saiu 1.",
    );
  });

  it("concorda em número: 1 entrou e 1 saiu", () => {
    expect(
      vereditoDoFluxo([linhaDoFluxo({ mes: "2026-08", parcial: false, registradas: 1, saidas: 1 })]),
    ).toBe("Em agosto, o último mês completo, entrou 1 e saiu 1.");
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

/** As quatro faixas do corte de hoje, com a quantidade de cada uma por parâmetro. */
const faixas = (q0: number, q1: number, q2: number, q3: number) => [
  { deDias: 0, ateDias: 7, quantidade: q0 },
  { deDias: 8, ateDias: 30, quantidade: q1 },
  { deDias: 31, ateDias: 90, quantidade: q2 },
  { deDias: 91, ateDias: null, quantidade: q3 },
];

/**
 * **O veredito conta acima de 30, e a oração dos 90 é o 59.5**: a faixa mais velha, quando maior que
 * zero, se distingue por palavra. Os dois números saem das faixas, e nenhum é escrito no módulo.
 */
describe("vereditoDaIdade — acima de 30, e a oração dos 90 quando há alguém", () => {
  it.each([
    [faixas(56, 18, 1, 0), "1 em aberto há mais de 30 dias."],
    [faixas(56, 18, 2, 1), "3 em aberto há mais de 30 dias, e 1 delas há mais de 90."],
    [faixas(5, 2, 0, 0), "Nenhuma em aberto há mais de 30 dias."],
    [faixas(0, 0, 0, 0), "Nada em aberto agora."],
  ])("%o → %s", (entrada, esperado) => {
    expect(vereditoDaIdade(entrada)).toBe(esperado);
  });
});

describe("rodapeDaIdade — o que o quadro mede, sempre (59.6)", () => {
  it("escreve a primeira oração do 59 e o total", () => {
    expect(rodapeDaIdade(faixas(56, 18, 1, 0))).toBe(
      "Há quanto tempo o que está em aberto espera, contando do registro: 75 ao todo, entre Aberta, Em análise, Em atendimento e Pausada.",
    );
  });

  it("escreve a mesma frase com zero", () => {
    expect(rodapeDaIdade(faixas(0, 0, 0, 0))).toContain(": 0 ao todo");
  });
});

describe("parteDoTotal — uma casa, e nada de divisão por zero", () => {
  it.each([
    [56, 75, "74,7%"],
    [0, 75, "0,0%"],
    [0, 0, "—"],
  ])("%i de %i → %s", (q, total, esperado) => {
    expect(parteDoTotal(q, total)).toBe(esperado);
  });
});

describe("totalEmAberto e dias", () => {
  it("o total é a soma das faixas — o número do cartão Em aberto agora", () => {
    expect(totalEmAberto(faixas(56, 18, 1, 0))).toBe(75);
  });

  it("um dia é um dia", () => {
    expect(dias(1)).toBe("1 dia");
    expect(dias(31)).toBe("31 dias");
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

describe("corteDeTopo — as cinco, mais as empatadas com a quinta", () => {
  const d = (...qs: number[]) => qs.map((quantidade, i) => ({ chave: String(i), quantidade }));

  it("com os dados da validação: seis, e o resto com 5 ou menos", () => {
    const { mostradas, restantes, maiorDasRestantes } = corteDeTopo(d(12, 10, 6, 6, 6, 6, 5, 4, 4, 3));
    expect(mostradas).toHaveLength(6);
    expect(restantes).toBe(4);
    expect(maiorDasRestantes).toBe(5);
  });

  it("não corta o que cabe", () => {
    expect(corteDeTopo(d(3, 2)).restantes).toBe(0);
  });

  it("empate que atravessa tudo mostra tudo", () => {
    expect(corteDeTopo(d(2, 2, 2, 2, 2, 2, 2)).mostradas).toHaveLength(7);
  });
});

describe("fraseDoResto", () => {
  it.each([
    [23, 5, "Mais 23 duplas com 5 ocorrências ou menos"],
    [1, 2, "Mais 1 dupla com 2 ocorrências ou menos"],
  ])("%i, %i → %s", (restantes, maior, esperado) => {
    expect(fraseDoResto(restantes, maior)).toBe(esperado);
  });
});

/**
 * ---------------------------------------------------------------------------
 *  Os três cartões, a categoria e a satisfação — item 73
 * ---------------------------------------------------------------------------
 */
describe("os três cartões", () => {
  it.each([
    [71, "+71"],
    [-3, "−3"], // U+2212, o sinal de menos da tipografia, e não o hífen
    [0, "0"],
  ])("textoDoSaldo(%i) → %s", (saldo, esperado) => {
    expect(textoDoSaldo(saldo)).toBe(esperado);
  });

  it("segundo termo do saldo, e a concordância", () => {
    expect(segundoTermoDoSaldo({ entraram: 117, sairam: 46, saldo: 71 })).toBe(
      "117 entraram, 46 saíram",
    );
    expect(segundoTermoDoSaldo({ entraram: 1, sairam: 0, saldo: 1 })).toBe("1 entrou, 0 saíram");
  });

  it("segundo termo do em aberto", () => {
    expect(segundoTermoDoEmAberto(4)).toBe("eram 4 no início do período");
    expect(segundoTermoDoEmAberto(1)).toBe("era 1 no início do período");
    expect(segundoTermoDoEmAberto(0)).toBe("nenhuma no início do período");
  });
});

describe("o valor da categoria — o segundo número em texto", () => {
  it.each([
    [7, 4, 7, "7 · 4 há mais de 7 dias"],
    [9, 0, 7, "9 · nenhuma há mais de 7 dias"],
    [0, 0, 7, "0"],
  ])("%i, %i, %i → %s", (q, env, limite, esperado) => {
    expect(textoDoValorDaCategoria(q, env, limite)).toBe(esperado);
  });
});

describe("a satisfação", () => {
  it("com avaliação: o denominador e a taxa arredondada", () => {
    expect(denominadorDaSatisfacao({ media: 3.8, avaliadas: 26, resolvidas: 37 })).toBe(
      "26 de 37 resolvidas avaliadas · 70% responderam",
    );
  });

  // **O caso de baixo é a trava de regressão, não o caso novo.** Com nenhuma resolvida a saída tem de ser
  // idêntica à de antes do item 81, caractere por caractere, porque é a frase que a organização
  // recém-criada lê e ela já estava certa.
  it("sem avaliação e sem resolvida: a frase de sempre, caractere por caractere", () => {
    expect(denominadorDaSatisfacao({ media: null, avaliadas: 0, resolvidas: 0 })).toBe(
      "Nenhuma ocorrência avaliada ainda — 0 de 0 resolvidas.",
    );
  });

  // **Havendo resolvidas, o denominador é o verdadeiro** (item 81, que reabriu a largura do critério 34.2).
  // O singular de *resolvida* é a casa do arquivo: `segundoTermoDoSaldo` e `segundoTermoDoEmAberto` fazem o
  // mesmo.
  it.each([
    [1, "Nenhuma ocorrência avaliada ainda — 0 de 1 resolvida."],
    [5, "Nenhuma ocorrência avaliada ainda — 0 de 5 resolvidas."],
  ])("sem avaliação, com %i resolvida(s): o denominador é o verdadeiro", (resolvidas, esperado) => {
    expect(denominadorDaSatisfacao({ media: null, avaliadas: 0, resolvidas })).toBe(esperado);
  });

  it("o rótulo da nota não é estrela", () => {
    expect(rotuloDaNota(5)).toBe("Nota 5");
  });
});

describe("o período do painel", () => {
  it("o período é linha sobre pauta, e não cartão (critério 104.6)", () => {
    const pagina = ler("app/(casca)/dashboard/page.tsx");
    // O fim é a chave sozinha na linha: a assinatura desestruturada também abre linha com `}`.
    const periodo = /function Periodo\([\s\S]*?\n\}\r?\n/u.exec(pagina)?.[0] ?? "";
    expect(periodo).not.toMatch(/\bbg-superficie\b|\bshadow-sm\b|\brounded-lg\b/u);
    expect(periodo).toContain("border-linha-suave");
    expect(periodo).toContain("border-b");

    // O esqueleto acompanha: sem a caixa de 74 px, para o conteúdo não saltar ao chegar.
    expect(ler("app/(casca)/dashboard/loading.tsx")).not.toContain("h-[74px]");
  });
});

/**
 * ---------------------------------------------------------------------------
 *  O eixo das barras — item 110, critério 6
 * ---------------------------------------------------------------------------
 * Só os quadros 4 e 7 passam denominador; os quadros 2, 5 e 6 seguem com o domínio automático do
 * Recharts, que nem passa por esta função. O teto nunca fica abaixo de uma barra nem em zero.
 */
describe("tetoDoEixo — o comprimento como parte de um todo", () => {
  it("com denominador, o denominador: três votos de um, de dez resolvidas", () => {
    expect(tetoDoEixo([1, 1, 1, 0, 0], 10)).toBe(10);
  });

  it("nunca abaixo da maior barra", () => {
    expect(tetoDoEixo([5, 2], 3)).toBe(5);
  });

  it("nunca zero: nenhuma resolvida, as cinco barras a zero", () => {
    expect(tetoDoEixo([0, 0, 0, 0, 0], 0)).toBe(1);
    expect(tetoDoEixo([], 0)).toBe(1);
  });
});

describe("fraseDoDenominadorDasDuplas — o todo do quadro 4, impresso", () => {
  it("as registradas do período", () => {
    expect(fraseDoDenominadorDasDuplas(117)).toBe("Parte das 117 registradas no período.");
  });
});

describe("degrauDaEscala — a escala dos quadros 2 e 7 (critério 134.8)", () => {
  it("a primeira barra é o --chart-1 cheio, e cada seguinte desce um degrau", () => {
    expect([0, 1, 2, 3, 4].map((i) => degrauDaEscala(i).cor)).toStrictEqual([
      "var(--chart-1)",
      "var(--chart-1-2)",
      "var(--chart-1-3)",
      "var(--chart-1-4)",
      "var(--chart-1-5)",
    ]);
  });

  it("com mais barras que degraus, o último se repete, e nunca sai cor vazia", () => {
    expect(degrauDaEscala(5).cor).toBe("var(--chart-1-5)");
    expect(degrauDaEscala(12).cor).toBe("var(--chart-1-5)");
  });

  it("índice negativo é o primeiro degrau", () => {
    expect(degrauDaEscala(-1).cor).toBe("var(--chart-1)");
  });

  it("a escala não tem contorno", () => {
    expect(degrauDaEscala(0).contorno).toBeUndefined();
  });
});

describe("corDoStatusNaBarra — o quadro 6 veste o selo (critério 134.9)", () => {
  it("o mapa do critério, status a status", () => {
    expect(corDoStatusNaBarra("aberta")).toStrictEqual({ cor: "var(--accent)" });
    expect(corDoStatusNaBarra("pausada")).toStrictEqual({ cor: "var(--atencao)", contorno: "var(--ink-soft)" });
    expect(corDoStatusNaBarra("em_analise")).toStrictEqual({ cor: "var(--ink-soft)" });
    expect(corDoStatusNaBarra("em_atendimento")).toStrictEqual({ cor: "var(--info)" });
    expect(corDoStatusNaBarra("resolvida")).toStrictEqual({ cor: "var(--ok)" });
    expect(corDoStatusNaBarra("cancelada")).toStrictEqual({ cor: "var(--ink-soft)" });
  });

  it("todo status do domínio tem cor própria no mapa", () => {
    for (const status of STATUS) {
      expect(corDoStatusNaBarra(status).cor, status).not.toBe(COR_PADRAO_DA_BARRA);
    }
  });

  it("status que o mapa não conhece cai na cor padrão, e a barra continua aparecendo", () => {
    expect(corDoStatusNaBarra("arquivada")).toStrictEqual({ cor: COR_PADRAO_DA_BARRA });
  });
});

describe("os gráficos de T-07 respondem ao ponteiro (critério 134.6)", () => {
  it("com o tooltip do catálogo, como o quadro 1", () => {
    for (const arquivo of ["grafico-de-barras", "grafico-do-fluxo-mensal", "grafico-do-tempo-de-resolucao"]) {
      expect(ler(`src/interface/componentes/${arquivo}.tsx`), arquivo).toContain(
        "<ChartTooltip content={<ChartTooltipContent />} />",
      );
    }
  });
});
