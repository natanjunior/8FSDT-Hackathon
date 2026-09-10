import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * A especificação executável, servida pela rota de documentação.
 *
 * **Por que existe uma rota para um arquivo.** O `docs/README.md` aponta para `api/openapi.yaml`, e o
 * arquivo não é documento: ele não vira página, e o link cairia em `/documentacao/api/openapi.yaml`, que
 * não existiria. Servir o arquivo original por uma rota resolve sem criar uma segunda cópia em `public/`
 * — e cópia é o que diverge na primeira alteração.
 *
 * O `force-static` faz a leitura acontecer em tempo de build, que é o que mantém o `output: "standalone"`
 * funcionando: o conteúdo entra no `.next`, e o arquivo não precisa existir no container.
 *
 * Quem confere que este arquivo continua correspondendo às rotas é o `npm run verificar:openapi`, que lê
 * `docs/api/openapi.yaml` — o mesmo que esta rota serve, e não outro.
 */
export const dynamic = "force-static";

export async function GET() {
  const conteudo = await readFile(join(process.cwd(), "docs/api/openapi.yaml"), "utf8");

  return new Response(conteudo, {
    headers: { "content-type": "text/yaml; charset=utf-8" },
  });
}
