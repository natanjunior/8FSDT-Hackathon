import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** O código do Swagger UI, lido do pacote em tempo de build. Ver a rota `referencia`. */
export const dynamic = "force-static";

export async function GET() {
  const conteudo = await readFile(
    join(process.cwd(), "node_modules/swagger-ui-dist/swagger-ui-bundle.js"),
    "utf8",
  );

  return new Response(conteudo, {
    headers: { "content-type": "text/javascript; charset=utf-8" },
  });
}
