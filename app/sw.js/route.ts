import { readFileSync } from "node:fs";
import { join } from "node:path";

import { montarCasca } from "@/interface/trabalhador/casca";
import { montarScriptDoTrabalhador } from "@/interface/trabalhador/script";

/**
 * **O trabalhador de serviço do item 98**, servido na raiz para que o escopo `/` valha sem cabeçalho extra.
 *
 * **O ícone é lido de `public/`**, que a imagem copia (`Dockerfile`, estágio de execução). Entra no resumo
 * da versão junto com a casca: trocar o ícone troca o trabalhador.
 *
 * **Sem cache HTTP**, como manda o guia de PWA do Next: o navegador confere o script a cada abertura, e é
 * assim que uma versão nova chega sem ninguém limpar nada (critério 98.4).
 */
export const dynamic = "force-dynamic";

const SCRIPT = montarScriptDoTrabalhador(
  montarCasca({ iconeSvg: readFileSync(join(process.cwd(), "public/marca/icone.svg"), "utf8") }),
);

export function GET(): Response {
  return new Response(SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
