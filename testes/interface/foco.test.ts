/** @vitest-environment jsdom */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
