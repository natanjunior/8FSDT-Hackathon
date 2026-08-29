import { describe, expect, it } from "vitest";

import type { DashboardLido } from "@/aplicacao/dashboard";
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
  backlogPorCategoria: [{ categoria: { id: "c-1", nome: "Vazamento" }, quantidade: 7 }],
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
