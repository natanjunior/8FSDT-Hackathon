import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * **O guarda da variante escura.**
 *
 * O catálogo shadcn assume estratégia de classe `.dark`; nós escolhemos troca de token por `data-theme` e
 * por `prefers-color-scheme`. As declarações `dark:` que vêm com cada componente são a estratégia errada
 * para este produto — e não são inofensivas: o `RootProvider` do Fumadocs põe `.dark` no elemento raiz nas
 * páginas de documentação, que dividem esse elemento com o produto.
 *
 * Este teste existe para o problema não voltar no próximo `shadcn add`, que é como ele entrou.
 */
const PASTA = fileURLToPath(new URL("../../src/interface/componentes/ui/", import.meta.url));

describe("src/interface/componentes/ui — a variante escura do catálogo", () => {
  it("nenhum componente declara `dark:`", () => {
    const comDeclaracao = readdirSync(PASTA)
      .filter((arquivo) => arquivo.endsWith(".tsx"))
      .filter((arquivo) => readFileSync(PASTA + arquivo, "utf8").includes("dark:"))
      .sort();

    expect(comDeclaracao).toEqual([]);
  });
});
