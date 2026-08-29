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
