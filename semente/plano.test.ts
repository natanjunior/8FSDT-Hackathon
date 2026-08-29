import { describe, expect, it } from "vitest";

import { baldesDaDemonstracao } from "./plano";

/**
 * ============================================================================
 *  Os critérios do item 43, como asserção sobre o plano — e SEM banco
 * ============================================================================
 *
 * **O que só a semente pode errar é a forma do plano**, e é o que este arquivo prova. A máquina de
 * estados não é reprovada aqui: ela já tem os testes dos itens 16 a 27, e cada transição do roteiro passa
 * pelos mesmos comandos. Se o roteiro pedir transição ilegal, o programa estoura na execução — que é o
 * comportamento certo para um script.
 */

const HOJE = new Date("2026-08-29T12:00:00.000Z");

describe("baldesDaDemonstracao", () => {
  it("dá cinco baldes mensais, do mais antigo para o mês corrente", () => {
    expect(baldesDaDemonstracao(HOJE).map((balde) => balde.rotulo)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("o mês corrente vai até ONTEM, nunca até hoje", () => {
    const baldes = baldesDaDemonstracao(HOJE);
    const corrente = baldes.at(-1);

    expect(corrente?.ultimoDia.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(corrente?.dias).toBe(28);
  });

  it("os meses fechados vão até o último dia deles", () => {
    const baldes = baldesDaDemonstracao(HOJE);

    // Abril tem 30 dias; junho, 30; julho, 31.
    expect(baldes.map((balde) => balde.dias)).toEqual([30, 31, 30, 31, 28]);
  });

  it("atravessa a virada do ano", () => {
    expect(baldesDaDemonstracao(new Date("2026-02-10T08:00:00.000Z")).map((b) => b.rotulo)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("no dia 1 o mês corrente some, e sobram quatro baldes — ainda acima do mínimo de três", () => {
    expect(baldesDaDemonstracao(new Date("2026-08-01T09:00:00.000Z")).map((b) => b.rotulo)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
  });
});
