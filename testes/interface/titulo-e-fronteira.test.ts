/** @vitest-environment jsdom */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * **A raiz sai de `dirname`, e não do `new URL("../../", import.meta.url)` dos outros testes.** Aquele
 * idioma é reescrito pelo Vite, que reconhece o padrão e o troca por um endereço de ativo —
 * `http://localhost:3000/@fs/…` — quando o ambiente do arquivo é `jsdom`. O `fileURLToPath` recusa o
 * esquema, e o arquivo nem chega a rodar. Recebendo a `string` direto, a reescrita não acontece.
 */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function ler(relativo: string): string {
  return readFileSync(join(RAIZ, relativo), "utf8");
}

/** Sem comentários de bloco (inclusive `{/* … *\/}`) e sem linhas `//`: prosa não conta como código. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

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

  /**
   * **O caminho feliz da fronteira, e é o que protege o desenho de T-05.** A documentação do `catchError`
   * avisa que o recuo passado por propriedade é **renderizado no servidor a cada pintura**, mesmo sem erro
   * nenhum. Se ele também **aparecesse** no documento, os três cartões de T-05 nasceriam com o título e o
   * trilho duplicados — e as guardas de estrutura que leem o DOM não pegam isso, porque leem o
   * código-fonte. Sem erro, a fronteira entrega só os filhos.
   */
  it("sem erro, a fronteira entrega os filhos e o recuo não aparece", async () => {
    await act(async () => {
      raiz.render(
        createElement(
          "div",
          null,
          createElement("p", null, "O relato da ocorrência"),
          createElement(
            FalhaDoCartao,
            {
              frase: FRASES_DE_FALHA.linhaDoTempo,
              antes: createElement("h2", { id: "bloco-linha-do-tempo" }, "Linha do tempo"),
            },
            createElement("p", null, "A linha do tempo de verdade"),
          ),
        ),
      );
    });
    expect(conteiner.textContent).toContain("A linha do tempo de verdade");
    expect(conteiner.textContent).not.toContain("A linha do tempo não carregou.");
    expect(conteiner.querySelector("h2#bloco-linha-do-tempo")).toBeNull();
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

describe("todo <Suspense> que espera promessa secundária está dentro de uma fronteira — critério 90.5", () => {
  const ARQUIVOS = [
    "app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx",
    "src/interface/componentes/conversa-da-ocorrencia.tsx",
  ];

  it.each(ARQUIVOS)("%s", (arquivo) => {
    const fonte = semComentarios(ler(arquivo));
    const posicoes = [...fonte.matchAll(/<Suspense\b/gu)].map((achado) => achado.index);
    expect(posicoes.length).toBeGreaterThan(0);
    for (const posicao of posicoes) {
      const abertura = fonte.lastIndexOf("<FalhaDoCartao", posicao);
      const fechamento = fonte.lastIndexOf("</FalhaDoCartao>", posicao);
      expect(
        abertura,
        `o <Suspense> na posição ${String(posicao)} está fora de fronteira`,
      ).toBeGreaterThan(fechamento);
    }
  });
});

/** Toda `page.tsx` de `app/`, com separador `/`. */
function paginas(): string[] {
  return readdirSync(join(RAIZ, "app"), { recursive: true, encoding: "utf8" })
    .map((caminho) => `app/${caminho.replaceAll("\\", "/")}`)
    .filter((caminho) => caminho.endsWith("/page.tsx"))
    .sort();
}

/**
 * **As exceções, com o motivo.** Nasce vazia: todas as páginas renderizam alguma coisa, inclusive o
 * despachante de `/`, que desde o item 86 também redireciona `?e=` para o convite. Página que **só**
 * redireciona entraria aqui.
 */
const SEM_TITULO_PROPRIO: Readonly<Record<string, string>> = {};

describe("toda página tem título de aba — critérios 90.1 e 90.2", () => {
  it("são 24 páginas, e a contagem é a do backlog", () => {
    // **21 até o item 86**, que acrescentou `/convite/{codigo}` e `/convidar`. **24 desde o item 111**, com
    // o QR da área. **23 desde o item 120**, que apagou `/convidar`. **24 desde o item 121**, com
    // `/convite-pessoal/{token}`.
    expect(paginas()).toHaveLength(24);
  });

  it.each(paginas())("%s exporta metadata com title, ou generateMetadata", (pagina) => {
    if (pagina in SEM_TITULO_PROPRIO) return;
    const fonte = semComentarios(ler(pagina));
    const estatico = /export const metadata: Metadata = \{[^}]*\btitle:/u.test(fonte);
    const dinamico = /export (?:async )?function generateMetadata\b/u.test(fonte);
    expect(estatico || dinamico).toBe(true);
  });

  it.each(paginas())("%s não repete o nome do produto no próprio título", (pagina) => {
    const fonte = semComentarios(ler(pagina));
    expect(fonte).not.toMatch(/title:\s*["`][^"`]*Resolve Aí/u);
  });

  it("o layout raiz põe o sufixo, uma vez", () => {
    const fonte = ler("app/layout.tsx");
    expect(fonte).toContain('template: "%s · Resolve Aí"');
    expect(fonte).toContain('default: "Resolve Aí"');
  });
});

describe("o título de T-05 e T-06 vem da mesma leitura da página — spec 90.1 §4.3", () => {
  const TELAS = [
    ["app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx", '"Ocorrência"'],
    ["app/(casca)/ocorrencias/[ocorrenciaId]/auditoria/page.tsx", '"Trilha de auditoria"'],
  ] as const;

  it.each(TELAS)("%s lê por lerOcorrenciaDaTela, e nunca por verOcorrencia", (arquivo, recuo) => {
    const fonte = semComentarios(ler(arquivo));
    expect(fonte).toContain("lerOcorrenciaDaTela(");
    expect(fonte).toContain(`tituloDeAbaDaOcorrencia(ocorrenciaId, ${recuo})`);
    expect(fonte).not.toMatch(/\bverOcorrencia\(/u);
  });

  it("a função do título engole o erro, e a de leitura aplica a regra de visibilidade", () => {
    const fonte = semComentarios(ler("src/interface/http/ocorrencia-da-tela.ts"));
    expect(fonte).toContain("cache(");
    expect(fonte).toContain("podeLerOcorrencia(lida, quem)");
    expect(fonte).toMatch(/catch \{\s*return recuo;/u);
  });
});

describe("404 e erro em pt-BR — critérios 90.3 e 90.4", () => {
  it("o 404 tem título de aba, a moldura com a marca e os dois caminhos", () => {
    const fonte = ler("app/not-found.tsx");
    expect(fonte).toContain("FRASES_DE_FALHA.inexistenteTitulo");
    expect(fonte).toContain("MolduraDeConta");
    expect(fonte).toContain('href="/"');
    expect(fonte).toContain('href="/documentacao"');
  });

  it.each(["app/error.tsx", "app/(casca)/error.tsx"])("%s chama retry, nunca reset", (arquivo) => {
    const fonte = semComentarios(ler(arquivo));
    expect(fonte.startsWith('"use client"')).toBe(true);
    expect(fonte).toContain("retry()");
    expect(fonte).not.toMatch(/\breset\b/u);
    expect(fonte).not.toMatch(/error\.(?:message|digest)/u);
  });
});
