/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lerOCiclo } from "@/interface/componentes/ciclo";
import { ReguaDoCiclo } from "@/interface/componentes/regua-do-ciclo";

/**
 * ============================================================================
 *  Item 107 — a ocorrência e a trilha
 * ============================================================================
 *
 * **A régua é renderizada de verdade**, no idioma de `titulo-e-fronteira.test.ts`: `jsdom` por arquivo e
 * `react-dom/client`, sem `@testing-library`. Ela é componente de servidor, mas síncrona e sem dado de
 * servidor, então monta igual no cliente. O resto do item é forma, e vira guarda sobre o código-fonte.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A raiz sai de `dirname`, e não de `new URL(…)`: o Vite reescreve aquele idioma sob `jsdom`. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ler(relativo: string): string {
  return readFileSync(join(RAIZ, relativo), "utf8");
}

const NOMES: Readonly<Record<string, string>> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  em_atendimento: "Em atendimento",
  resolvida: "Resolvida",
  pausada: "Pausada",
  cancelada: "Cancelada",
};

let conteiner: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  conteiner = document.createElement("div");
  document.body.append(conteiner);
  raiz = createRoot(conteiner);
});

afterEach(() => {
  act(() => raiz.unmount());
  conteiner.remove();
});

function renderizarRegua(
  transicoes: Parameters<typeof ReguaDoCiclo>[0]["transicoes"],
  statusAtual: string,
): void {
  act(() => {
    raiz.render(
      createElement(ReguaDoCiclo, {
        transicoes,
        statusAtual,
        nomeDoStatus: (status: string) => NOMES[status] ?? status,
        rotuloDaSaida: NOMES[statusAtual] ?? statusAtual,
      }),
    );
  });
}

function passo(nome: string): HTMLLIElement {
  const item = [...conteiner.querySelectorAll("li")].find((li) => li.textContent?.startsWith(nome));
  if (item === undefined) throw new Error(`passo ${nome} não renderizado`);
  return item;
}

describe("item 107 · a régua mostra o tempo decorrido (critério 107.2)", () => {
  it("lerOCiclo carrega o decorrido da primeira passagem, junto da data", () => {
    const leitura = lerOCiclo(
      [
        { status: "aberta", em: "01/09/2026 · 09:15", decorrido: "há 30 dias" },
        { status: "em_analise", em: "02/09/2026 · 10:00", decorrido: "há 29 dias" },
        { status: "em_atendimento", em: "03/09/2026 · 08:00", decorrido: "há 28 dias" },
        { status: "pausada", em: "04/09/2026 · 08:00", decorrido: "há 27 dias" },
        // A retomada volta a `em_atendimento`: a data e o decorrido continuam os da primeira vez.
        { status: "em_atendimento", em: "20/09/2026 · 08:00", decorrido: "há 11 dias" },
      ],
      "em_atendimento",
    );
    expect(leitura.passos[2]).toEqual({
      status: "em_atendimento",
      em: "03/09/2026 · 08:00",
      decorrido: "há 28 dias",
      estado: "atual",
    });
    expect(leitura.passos[3]).toEqual({
      status: "resolvida",
      em: null,
      decorrido: null,
      estado: "por-alcancar",
    });
  });

  it("sem decorrido na entrada, o passo sai com null", () => {
    const leitura = lerOCiclo([{ status: "aberta", em: "01/09/2026 · 09:15" }], "aberta");
    expect(leitura.passos[0]?.decorrido).toBeNull();
  });

  it("o passo atual mostra o carimbo e o tempo decorrido, e não mostra agora", () => {
    renderizarRegua([{ status: "aberta", em: "01/09/2026 · 09:15", decorrido: "há 30 dias" }], "aberta");
    const atual = passo("Aberta");
    expect(atual.getAttribute("aria-current")).toBe("step");
    expect(atual.textContent).toContain("01/09/2026 · 09:15");
    expect(atual.textContent).toContain("há 30 dias");
    expect(atual.textContent).not.toMatch(/\bagora\b/u);
    // O carimbo continua num elemento só dele: o ponta a ponta o acha por texto exato (`CARIMBO`).
    const carimbo = [...atual.querySelectorAll("span")].find((s) => s.textContent === "01/09/2026 · 09:15");
    expect(carimbo).toBeDefined();
  });

  it("o passo alcançado mostra só o carimbo", () => {
    renderizarRegua(
      [
        { status: "aberta", em: "01/09/2026 · 09:15", decorrido: "há 30 dias" },
        { status: "em_analise", em: "02/09/2026 · 10:00", decorrido: "há 29 dias" },
      ],
      "em_analise",
    );
    expect(passo("Aberta").textContent).not.toContain("há");
    expect(passo("Em análise").textContent).toContain("há 29 dias");
  });

  it("em pausada e em cancelada não há tempo decorrido em lugar nenhum", () => {
    for (const status of ["pausada", "cancelada"]) {
      renderizarRegua(
        [
          { status: "aberta", em: "01/09/2026 · 09:15", decorrido: "há 30 dias" },
          { status, em: "02/09/2026 · 10:00", decorrido: "há 29 dias" },
        ],
        status,
      );
      expect(conteiner.textContent, status).not.toContain("há ");
    }
  });

  it("sem decorrido, o passo atual mostra o carimbo sozinho, sem separador órfão", () => {
    renderizarRegua([{ status: "aberta", em: "01/09/2026 · 09:15" }], "aberta");
    expect(passo("Aberta").textContent?.trim().endsWith("09:15")).toBe(true);
  });
});
