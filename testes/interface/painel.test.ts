/** @vitest-environment jsdom */
import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";

import { Cartao } from "@/interface/componentes/blocos-do-dashboard";
import { GraficoDoFluxoMensal } from "@/interface/componentes/grafico-do-fluxo-mensal";
import { GraficoDoTempoDeResolucao } from "@/interface/componentes/grafico-do-tempo-de-resolucao";

/**
 * **O painel renderizado — item 110.** O que só o DOM diz: o nome acessível do `h2` com os espaços que
 * o JSX em linhas separadas engolia (critério 7), o papel tipográfico do título (1), e o escopo em selo
 * dentro do título, com a pergunta rebaixada (2).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * **`act` assíncrono**, como o `foco.test.ts:181`: o Recharts 3 mede o contêiner num efeito e só então
 * desenha, e o `act` síncrono devolve a árvore antes disso. Para o `Cartao`, que não tem efeito, dá no
 * mesmo.
 */
async function renderizar(elemento: React.ReactElement): Promise<HTMLElement> {
  const raiz = document.createElement("div");
  document.body.append(raiz);
  await act(async () => createRoot(raiz).render(elemento));
  return raiz;
}

/**
 * As props do quadro 1. **`children: null` só para o tipo**: o `Cartao` o declara obrigatório, o
 * `createElement` o confere no objeto, e o filho de verdade vai no terceiro argumento, que o substitui.
 */
const CABECALHO: ComponentProps<typeof Cartao> = {
  numero: 1,
  titulo: "Entradas e saídas por mês",
  quando: "no período",
  pergunta: "Está melhorando ou piorando?",
  children: null,
};

describe("o cabeçalho do quadro", () => {
  const raiz = (): Promise<HTMLElement> =>
    renderizar(
      createElement(Cartao, CABECALHO, createElement("p", null, "conteúdo")),
    );

  it("o nome acessível sai inteiro, com os espaços", async () => {
    const h2 = (await raiz()).querySelector("h2");
    expect(h2?.textContent?.replace(/\s+/gu, " ").trim()).toBe(
      "1 · Entradas e saídas por mês no período",
    );
    // A emenda que o A-112 achou: sem espaço explícito, `mêsno período`.
    expect(h2?.textContent).not.toMatch(/mêsno/u);
  });

  it("o título é título de bloco em tinta, sem versal nem mono", async () => {
    const titulo = (await raiz()).querySelector("h2 [data-papel='titulo']");
    expect(titulo?.className).toMatch(/\btext-titulo-bloco\b/u);
    expect(titulo?.className).toMatch(/\btext-tinta\b/u);
    expect(titulo?.className).not.toMatch(/\buppercase\b|\bfont-mono\b|\btext-rotulo-coluna\b/u);
  });

  it("o escopo é selo, dentro do título", async () => {
    const selo = (await raiz()).querySelector("h2 [data-slot='badge']");
    expect(selo?.textContent).toBe("no período");
  });

  it("a pergunta é meta", async () => {
    const pergunta = [...(await raiz()).querySelectorAll("p")].find(
      (p) => p.textContent === "Está melhorando ou piorando?",
    );
    expect(pergunta?.className).toMatch(/\btext-meta\b/u);
    expect(pergunta?.className).not.toMatch(/\btext-corpo\b/u);
  });
});

describe("o rótulo de ponta das linhas", () => {
  beforeAll(() => {
    // O `jsdom` não tem os dois; o Recharts e o `useIsMobile` pedem. Copiado de `foco.test.ts`.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((consulta: string) => ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    // Sem leiaute o `ResponsiveContainer` mede 0 × 0 e não desenha o `svg` (ver `foco.test.ts`).
    Element.prototype.getBoundingClientRect = function medida(this: Element): DOMRect {
      const caixa = { x: 0, y: 0, width: 320, height: 200, top: 0, left: 0, right: 320, bottom: 200 };
      return { ...caixa, toJSON: () => caixa } as DOMRect;
    };
  });

  /** Os textos dos `LabelList`, e o rótulo de ponta que começa por `inicio`. */
  function rotulos(raiz: HTMLElement, inicio: string): { rotulo: Element | undefined; pontos: Element[] } {
    const textos = [...raiz.querySelectorAll(".recharts-label-list text, .recharts-label")];
    return {
      rotulo: textos.find((t) => t.textContent?.startsWith(inicio)),
      pontos: textos.filter((t) => t.textContent === "●"),
    };
  }

  it("fluxo mensal: o texto é tinta, e o ponto carrega a cor da série", async () => {
    const raiz = await renderizar(
      createElement(GraficoDoFluxoMensal, {
        linhas: [
          { mes: "2026-08", rotulo: "ago", parcial: false, registradas: 4, resolvidas: 2, canceladas: 1, saidas: 3, saldo: 1 },
          { mes: "2026-09", rotulo: "set", parcial: false, registradas: 2, resolvidas: 1, canceladas: 0, saidas: 1, saldo: 1 },
        ],
      }),
    );
    const { rotulo, pontos } = rotulos(raiz, "Registradas");
    expect(rotulo, "o rótulo de ponta precisa existir no render").toBeDefined();
    // A classe, e não o atributo: sem `fill` explícito o `LabelList` do Recharts 3 copia o `fill` do
    // ponto para o atributo (`recharts/es6/component/LabelList.js`, "fall back to the fill of the
    // entry"), e a classe de CSS vence o atributo de apresentação. É como o `grafico-de-barras.tsx`
    // já pinta o texto de valor.
    expect(rotulo?.getAttribute("class") ?? "").toMatch(/\bfill-tinta\b/u);
    expect(pontos.map((p) => p.getAttribute("fill"))).toEqual(
      expect.arrayContaining(["var(--color-registradas)", "var(--color-saidas)"]),
    );
  });

  it("tempo de resolução: o texto é tinta, e o ponto carrega a cor da série", async () => {
    const raiz = await renderizar(
      createElement(GraficoDoTempoDeResolucao, {
        pontos: [
          { rotulo: "ago", mediana: 2, p90: 5 },
          { rotulo: "set", mediana: 3, p90: 6 },
        ],
        unidade: { divisor: 1, sufixo: "d" },
        pontas: { mediana: "3 dias", p90: "6 dias" },
      }),
    );
    const { rotulo, pontos } = rotulos(raiz, "mediana");
    expect(rotulo, "o rótulo de ponta precisa existir no render").toBeDefined();
    expect(rotulo?.getAttribute("class") ?? "").toMatch(/\bfill-tinta\b/u);
    expect(pontos.map((p) => p.getAttribute("fill"))).toEqual(
      expect.arrayContaining(["var(--color-mediana)", "var(--color-p90)"]),
    );
  });
});
