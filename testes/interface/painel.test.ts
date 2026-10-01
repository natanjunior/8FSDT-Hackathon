/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { Cartao } from "@/interface/componentes/blocos-do-dashboard";

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

describe("o cabeçalho do quadro", () => {
  const raiz = (): Promise<HTMLElement> =>
    renderizar(
      createElement(
        Cartao,
        {
          numero: 1,
          titulo: "Entradas e saídas por mês",
          quando: "no período",
          pergunta: "Está melhorando ou piorando?",
        },
        createElement("p", null, "conteúdo"),
      ),
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
