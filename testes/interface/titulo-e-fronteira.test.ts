/** @vitest-environment jsdom */
import { act, createElement, Suspense, use } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FalhaDoCartao } from "@/interface/componentes/falha-do-cartao";
import { FRASES_DE_FALHA } from "@/interface/componentes/frases-de-falha";

/**
 * ============================================================================
 *  Item 90 — título de aba, 404 e fronteira de erro
 * ============================================================================
 *
 * **O primeiro teste do projeto que renderiza um componente React.** Não há `@testing-library`; o
 * `jsdom` já está instalado e o `react-dom/client` basta. O que se prova é a forma da degradação: o bloco
 * principal fica, a frase aparece no cartão, e a ação tem nome.
 *
 * **O arquivo inteiro roda em `jsdom`**, pela diretiva da primeira linha — o primeiro do projeto a pedir
 * o ambiente por arquivo, sobre o `environment: "node"` do projeto `unitario`. As guardas de código-fonte
 * das seções seguintes usam `node:fs`, que continua disponível lá.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("a falha de uma leitura secundária fica no cartão — critério 90.6", () => {
  let conteiner: HTMLDivElement;
  let raiz: Root;

  beforeEach(() => {
    // O React escreve no console todo erro que uma fronteira pega; aqui ele é o cenário, não defeito.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    conteiner = document.createElement("div");
    document.body.append(conteiner);
    raiz = createRoot(conteiner);
  });

  afterEach(() => {
    act(() => raiz.unmount());
    conteiner.remove();
    vi.restoreAllMocks();
  });

  function renderizarComFalha(propriedades: { frase: string | null; antes?: unknown }) {
    const rejeitada = Promise.reject(new Error("a leitura caiu"));
    rejeitada.catch(() => undefined);
    function LeituraSecundaria() {
      use(rejeitada);
      return null;
    }
    return act(async () => {
      raiz.render(
        createElement(
          "div",
          null,
          createElement("p", null, "O relato da ocorrência"),
          createElement(
            FalhaDoCartao,
            propriedades as { frase: string | null },
            createElement(Suspense, { fallback: "carregando" }, createElement(LeituraSecundaria)),
          ),
        ),
      );
    });
  }

  it("o bloco principal continua, e a frase aparece no lugar do cartão", async () => {
    await renderizarComFalha({ frase: FRASES_DE_FALHA.linhaDoTempo });
    expect(conteiner.textContent).toContain("O relato da ocorrência");
    expect(conteiner.textContent).toContain("A linha do tempo não carregou.");
    expect(conteiner.textContent).not.toContain("a leitura caiu");
  });

  it("a ação é um botão chamado Tentar de novo", async () => {
    await renderizarComFalha({ frase: FRASES_DE_FALHA.conversa });
    const botoes = [...conteiner.querySelectorAll("button")].map((botao) => botao.textContent);
    expect(botoes).toStrictEqual(["Tentar de novo"]);
  });

  it("sem frase, só o recuo: o título estático, sem botão", async () => {
    await renderizarComFalha({
      frase: null,
      antes: createElement("h2", { id: "bloco-linha-do-tempo" }, "Linha do tempo"),
    });
    expect(conteiner.querySelector("h2#bloco-linha-do-tempo")?.textContent).toBe("Linha do tempo");
    expect(conteiner.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("as frases do item 90 — a voz de tela do guia", () => {
  it("nenhuma frase carrega palavra em inglês nem código", () => {
    for (const frase of Object.values(FRASES_DE_FALHA)) {
      expect(frase).not.toMatch(/error|not found|digest|\d{3}/iu);
    }
  });
});
