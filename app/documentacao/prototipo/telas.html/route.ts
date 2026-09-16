import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * As telas do protótipo, servidas pela rota de documentação.
 *
 * O `prototipo-low-fi.md` e o `inventario-de-telas.md` linkam `prototipo/telas.html`, e o arquivo não é
 * documento: sem esta rota, os links caem em 404. Ela sai junto com o protótipo, quando as páginas que o
 * citam forem substituídas.
 *
 * O `force-static` lê o arquivo em tempo de build, como a rota do `openapi.yaml`.
 */
export const dynamic = "force-static";

export async function GET() {
  const conteudo = await readFile(join(process.cwd(), "docs/prototipo/telas.html"), "utf8");

  return new Response(conteudo, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
