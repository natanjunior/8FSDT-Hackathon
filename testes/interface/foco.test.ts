/** @vitest-environment jsdom */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";

import { GraficoDeBarras } from "@/interface/componentes/grafico-de-barras";
import { GraficoDoFluxoMensal } from "@/interface/componentes/grafico-do-fluxo-mensal";
import { GraficoDoTempoDeResolucao } from "@/interface/componentes/grafico-do-tempo-de-resolucao";

/**
 * **O guarda do foco de teclado — item 94.**
 *
 * O catálogo chega do `shadcn add` com `outline-none` e anel de foco a 50%, e isso apaga o contorno que o
 * `@layer base` de `app/globals.css` declara (compromisso A-4: foco visível não removido). O defeito volta
 * em silêncio a cada componente novo, então a regra é de máquina, como a do ponteiro no `tema.test.ts`.
 *
 * `jsdom` porque os gráficos (critério 94.4) são renderizados aqui; as guardas de fonte não dependem dele.
 */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UI = "src/interface/componentes/ui";
const COMPONENTES = "src/interface/componentes";

function ler(relativo: string): string {
  return readFileSync(join(RAIZ, relativo), "utf8");
}

/** Sem comentários de bloco (inclusive `{/* … *\/}`) e sem linhas `//`: prosa não conta como código. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

function arquivos(pasta: string): string[] {
  return readdirSync(join(RAIZ, pasta), { recursive: true, encoding: "utf8" })
    .filter((nome) => /\.tsx?$/u.test(nome))
    .map((nome) => `${pasta}/${nome.replaceAll("\\", "/")}`);
}

/** O anel fracionário sob variante de foco: `focus-visible:ring-ring/50`, `data-[active=true]:ring-marca/40`. */
function aneisFracionariosDeFoco(fonte: string): string[] {
  return semComentarios(fonte)
    .split(/[\s"'`]+/u)
    .filter((classe) => /:ring-[\w-]+\/(?:\d+|\[[\d.]+%\])$/u.test(classe))
    .filter((classe) => /focus|focused|active=true/u.test(classe.slice(0, classe.lastIndexOf(":"))));
}

const AVISO = "um `shadcn add` trouxe o foco do catálogo de volta";

describe("o contorno da base volta a valer — critérios 94.1, 94.2 e 94.3", () => {
  it("nenhum componente de ui/ apaga o contorno", () => {
    const culpados = arquivos(UI).filter((caminho) => /\boutline-(?:none|hidden)\b/u.test(semComentarios(ler(caminho))));
    expect(culpados, AVISO).toEqual([]);
  });

  it("nenhum componente desenha anel de foco em opacidade fracionária", () => {
    const culpados = arquivos(COMPONENTES).flatMap((caminho) =>
      aneisFracionariosDeFoco(ler(caminho)).map((classe) => `${caminho}: ${classe}`),
    );
    expect(culpados, AVISO).toEqual([]);
  });

  it("o halo de erro do 44g fica, porque não é foco (resposta à P3)", () => {
    expect(ler(`${UI}/input.tsx`)).toContain("aria-invalid:ring-destructive/[16%]");
  });

  it("a regra base do tema pinta o contorno em cor cheia", () => {
    const css = ler("app/globals.css");
    expect(css).toMatch(/@apply border-border outline-ring;/u);
    expect(css).not.toContain("outline-ring/50");
  });

  it("a linha clicável continua a exceção legítima, fora de ui/ (D-02)", () => {
    expect(ler(`${COMPONENTES}/linha-clicavel.ts`)).toContain("focus-visible:outline-none");
  });
});

describe("a gaveta do celular — critério 94.7", () => {
  const sheet = semComentarios(ler(`${UI}/sheet.tsx`));
  const sidebar = semComentarios(ler(`${UI}/sidebar.tsx`));

  it("o X padrão é o botão de 44 px da casa, com nome em pt-BR", () => {
    expect(sheet).toMatch(/<SheetPrimitive\.Close asChild>\s*<Button[^>]*size="icon"[^>]*aria-label="Fechar"/su);
    expect(sheet).not.toContain(">Close<");
  });

  it("a gaveta deixa o X aparecer, e devolve o foco ao gatilho", () => {
    expect(sidebar).not.toContain("[&>button]:hidden");
    expect(sidebar).toMatch(
      /onCloseAutoFocus=\{\(evento\) => \{\s*evento\.preventDefault\(\);?\s*document\.querySelector<HTMLElement>\('\[data-sidebar="trigger"\]'\)\?\.focus\(\)/u,
    );
  });

  it("o gatilho diz se a gaveta está aberta, e qual ela é", () => {
    expect(sidebar).toContain("aria-expanded={isMobile ? openMobile : undefined}");
    expect(sidebar).toContain("aria-controls={isMobile ? ID_DA_GAVETA : undefined}");
    expect(sidebar).toMatch(/id=\{ID_DA_GAVETA\}/u);
  });

  it("o compartilhar reserva a faixa do X, que agora tem 44 px", () => {
    expect(semComentarios(ler(`${COMPONENTES}/compartilhamento-da-ocorrencia.tsx`))).toMatch(
      /<SheetHeader className="[^"]*pr-14/u,
    );
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("os sete gráficos não recebem foco — critério 94.4", () => {
  beforeAll(() => {
    // O `jsdom` não tem os dois; o Recharts e o `useIsMobile` pedem.
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
    /**
     * **O `jsdom` não faz leiaute, e devolve 0 × 0 em `getBoundingClientRect`.** O `ResponsiveContainer`
     * do Recharts 3 mede o contêiner no primeiro efeito e guarda o que leu
     * (`recharts/es6/component/ResponsiveContainer.js`); com zero ele **não renderiza o `svg`**, e o
     * teste do critério 94.4 mediria uma árvore vazia. A medida abaixo é a `initialDimension` de
     * `ui/chart.tsx`.
     */
    Element.prototype.getBoundingClientRect = function medida(this: Element): DOMRect {
      const caixa = { x: 0, y: 0, width: 320, height: 200, top: 0, left: 0, right: 320, bottom: 200 };
      return { ...caixa, toJSON: () => caixa } as DOMRect;
    };
  });

  const CASOS = [
    [
      "barras",
      createElement(GraficoDeBarras, {
        barras: [
          { chave: "a", rotulo: "Hidráulica", valor: 3, texto: "3" },
          { chave: "b", rotulo: "Elétrica", valor: 1, texto: "1" },
        ],
        larguraDoRotulo: 120,
      }),
    ],
    [
      "fluxo mensal",
      createElement(GraficoDoFluxoMensal, {
        linhas: [
          { mes: "2026-08", rotulo: "ago", parcial: false, registradas: 4, resolvidas: 2, canceladas: 1, saidas: 3, saldo: 1 },
          { mes: "2026-09", rotulo: "set", parcial: true, registradas: 2, resolvidas: 1, canceladas: 0, saidas: 1, saldo: 1 },
        ],
      }),
    ],
    [
      "tempo de resolução",
      createElement(GraficoDoTempoDeResolucao, {
        pontos: [
          { rotulo: "ago", mediana: 2, p90: 5 },
          { rotulo: "set", mediana: 3, p90: 6 },
        ],
        unidade: { divisor: 1, sufixo: "d" },
        pontas: { mediana: "3 dias", p90: "6 dias" },
      }),
    ],
  ] as const;

  for (const [nome, elemento] of CASOS) {
    it(`${nome}: nada focável dentro, e o contêiner segue aria-hidden`, async () => {
      const conteiner = document.createElement("div");
      document.body.append(conteiner);
      const raiz = createRoot(conteiner);
      await act(async () => raiz.render(elemento));
      expect(conteiner.querySelector("[aria-hidden]"), nome).not.toBeNull();
      expect(conteiner.querySelector("svg"), `${nome}: o Recharts não desenhou`).not.toBeNull();
      expect(conteiner.querySelectorAll('[tabindex="0"], [role="application"]'), nome).toHaveLength(0);
      act(() => raiz.unmount());
      conteiner.remove();
    });
  }

  it("os três desligam a camada à mão, e o comentário diz o padrão do Recharts 3", () => {
    for (const arquivo of ["grafico-de-barras", "grafico-do-fluxo-mensal", "grafico-do-tempo-de-resolucao"]) {
      const fonte = ler(`${COMPONENTES}/${arquivo}.tsx`);
      expect(semComentarios(fonte), arquivo).toContain("accessibilityLayer={false}");
      expect(fonte, arquivo).toMatch(/Recharts 3/u);
    }
  });
});
