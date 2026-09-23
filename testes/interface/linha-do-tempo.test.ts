import { describe, expect, it } from "vitest";

import { dataCurta, dataEHora } from "@/interface/componentes/datas";
import {
  autoria,
  partesDaAutoria,
  fraseDaAtribuicao,
  fraseDaMensagem,
  fraseDaTransicao,
} from "@/interface/componentes/linha-do-tempo";

/**
 * ============================================================================
 *  Unitário de INTERFACE — a forma da linha do tempo (item 29, critério 29.6)
 * ============================================================================
 *
 * **O que este arquivo prova:** que as quatro frases são as do protótipo, e que a data carrega o fuso
 * escrito. O caso da meia-noite é o único que distingue `America/Sao_Paulo` de *"o fuso do contêiner"* —
 * sem ele, um `timeZone` esquecido passa despercebido, porque a esteira roda em UTC.
 */

describe("dataEHora — um formato só, e o fuso é escrito", () => {
  it("escreve `dd/mm/aaaa · hh:mm`, que é a regra do guia §7", () => {
    // 09h40 em São Paulo é 12:40 em UTC.
    expect(dataEHora("2026-08-15T12:40:00.000Z")).toBe("15/08/2026 · 09:40");
  });

  it("vira o dia no fuso de São Paulo, e não no do contêiner", () => {
    expect(dataEHora("2026-08-15T02:30:00.000Z")).toBe("14/08/2026 · 23:30");
  });

  it("`hourCycle: h23` dá 00:00, e não 24:00", () => {
    expect(dataEHora("2026-08-15T03:00:00.000Z")).toBe("15/08/2026 · 00:00");
  });

  it("sem segundos — eles são a exceção da trilha de auditoria, que responde `prove`", () => {
    expect(dataEHora("2026-08-03T12:14:02.000Z")).toBe("03/08/2026 · 09:14");
  });

  it("`dataCurta` continua sendo `dd/mm/aaaa`", () => {
    expect(dataCurta("2026-08-15T12:40:00.000Z")).toBe("15/08/2026");
  });
});

describe("as frases — transcritas do protótipo, não inventadas", () => {
  it("transição sem observação é só o rótulo, com ponto", () => {
    expect(fraseDaTransicao("Recebida — aguardando análise", null)).toBe(
      "Recebida — aguardando análise.",
    );
  });

  it("transição com observação põe o texto entre aspas CURVAS", () => {
    expect(
      fraseDaTransicao("Em análise", "Vou ver se a garagem já teve infiltração nesse ponto."),
    ).toBe("Em análise. “Vou ver se a garagem já teve infiltração nesse ponto.”");
  });

  it("atribuição para quem não é o responsável nomeia a pessoa", () => {
    expect(fraseDaAtribuicao("Antônio Ferreira", false)).toBe("Antônio Ferreira ficou responsável.");
  });

  it("atribuição para o próprio responsável fala na segunda pessoa", () => {
    expect(fraseDaAtribuicao("Antônio Ferreira", true)).toBe("Você ficou responsável.");
  });

  it("a autoria diz Você quando o autor é quem lê — e o nome quando não é", () => {
    expect(autoria("Marina Rocha", true, "15/08/2026, 08h12")).toBe("Você · 15/08/2026, 08h12");
    expect(autoria("Marina Rocha", false, "15/08/2026, 08h12")).toBe(
      "Marina Rocha · 15/08/2026, 08h12",
    );
  });

  it("partesDaAutoria separa quem de quando, e juntas são a autoria (item 44q, critério 7)", () => {
    expect(partesDaAutoria("Marina Rocha", false, "15/08/2026 · 09:40")).toStrictEqual({
      quem: "Marina Rocha",
      quando: "15/08/2026 · 09:40",
    });
    expect(partesDaAutoria("Marina Rocha", true, "x").quem).toBe("Você");
    const { quem, quando } = partesDaAutoria("Marina Rocha", false, "15/08/2026 · 09:40");
    expect(`${quem} · ${quando}`).toBe(autoria("Marina Rocha", false, "15/08/2026 · 09:40"));
  });
});

describe("fraseDaMensagem — a convenção das aspas curvas", () => {
  it("embrulha o texto em aspas CURVAS, como fraseDaTransicao faz com a observação", () => {
    expect(fraseDaMensagem("Continua pingando.")).toBe("“Continua pingando.”");
  });

  it("as aspas são as mesmas dos dois lados, e não as retas do teclado", () => {
    const frase = fraseDaMensagem("x");
    expect(frase.startsWith("“")).toBe(true);
    expect(frase.endsWith("”")).toBe(true);
    expect(frase).not.toContain('"');
  });
});
