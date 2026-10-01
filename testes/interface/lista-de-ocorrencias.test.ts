/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ============================================================================
 *  Item 102 — a lista de T-03, renderizada
 * ============================================================================
 *
 * **O segundo arquivo do projeto que renderiza componente React**, no idioma do primeiro
 * (`titulo-e-fronteira.test.ts`): `jsdom` por diretiva, `react-dom/client`, sem `@testing-library`.
 *
 * **Dois módulos são substituídos, e só eles.** `next/link` precisa do roteador do App Router, que não
 * existe aqui; vira uma âncora. `navegacao-da-lista` dá o `pendente` e o `navegar`; vira um valor que o
 * teste controla. O resto — projeção, rótulos, tempos — é o código de verdade.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navegacao = vi.hoisted(() => ({ pendente: false }));

vi.mock("next/link", async () => {
  const { createElement: criar } = await import("react");
  return {
    default: ({ href, children, ...resto }: { href: string; children?: unknown } & Record<string, unknown>) =>
      criar("a", { href, ...resto }, children as never),
  };
});

vi.mock("@/interface/componentes/navegacao-da-lista", () => ({
  useNavegacaoDaLista: () => ({ navegar: () => undefined, pendente: navegacao.pendente }),
}));

/** A raiz sai de `dirname`, e não de `new URL`: o motivo está em `titulo-e-fronteira.test.ts:27-32`. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ler(relativo: string): string {
  return readFileSync(join(RAIZ, relativo), "utf8").replace(/\r\n/gu, "\n");
}

let conteiner: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  navegacao.pendente = false;
  conteiner = document.createElement("div");
  document.body.appendChild(conteiner);
  raiz = createRoot(conteiner);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  conteiner.remove();
});

function desenhar(elemento: ReactElement): void {
  act(() => {
    raiz.render(elemento);
  });
}

/** O instante de referência dos casos: 30/09/2026, 12h UTC. */
const AGORA = Date.parse("2026-09-30T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const antes = (dias: number) => new Date(AGORA - dias * DIA).toISOString();

describe("o par de datas nomeia os dois valores — critérios 102.1 e 102.12", () => {
  it("empilhado (a tabela): cada valor com a palavra, sem ↻ e sem sr-only", async () => {
    const { ParDeDatas } = await import("@/interface/componentes/lista-de-ocorrencias");
    desenhar(createElement(ParDeDatas, { registradaEm: antes(27), atualizadaEm: antes(2), agora: AGORA, empilhado: true }));

    expect(conteiner.textContent).toBe("27 dregistrada2 datualizada");
    expect(conteiner.textContent).not.toContain("↻");
    expect(conteiner.querySelector(".sr-only")).toBeNull();
  });

  it("em fileira (o celular): a mesma palavra, e o separador da linha de meta", async () => {
    const { ParDeDatas } = await import("@/interface/componentes/lista-de-ocorrencias");
    desenhar(createElement(ParDeDatas, { registradaEm: antes(25), atualizadaEm: antes(0.55), agora: AGORA }));

    expect(conteiner.textContent).toBe("25 d registrada · 13 h atualizada");
    expect(conteiner.querySelector(".sr-only")).toBeNull();
  });

  it("instantes iguais: só registrada, nas duas formas, sem célula vazia na grade", async () => {
    const { ParDeDatas } = await import("@/interface/componentes/lista-de-ocorrencias");
    const mesmo = antes(89);

    desenhar(createElement(ParDeDatas, { registradaEm: mesmo, atualizadaEm: mesmo, agora: AGORA, empilhado: true }));
    expect(conteiner.textContent).toBe("89 dregistrada");
    expect(conteiner.firstElementChild?.children).toHaveLength(2);

    desenhar(createElement(ParDeDatas, { registradaEm: mesmo, atualizadaEm: mesmo, agora: AGORA }));
    expect(conteiner.textContent).toBe("89 d registrada");
  });
});
