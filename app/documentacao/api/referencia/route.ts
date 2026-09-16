/**
 * A referência da API, em Swagger UI, lida do `openapi.yaml` original.
 *
 * É uma página HTML própria, fora do layout da documentação: o CSS do Swagger UI é global, e dentro do
 * layout ele competiria com o do Fumadocs. Os dois arquivos do Swagger UI vêm de rotas irmãs, que os leem
 * do pacote em tempo de build, sem depender de CDN.
 *
 * **"Try it out" fica desligado.** A referência descreve a API; executar chamadas contra a aplicação
 * publicada, com a sessão de quem lê, não é papel desta página.
 */
export const dynamic = "force-static";

const PAGINA = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Referência da API — Resolve Aí</title>
    <link rel="stylesheet" href="/documentacao/api/referencia/swagger-ui.css" />
    <style>
      body { margin: 0; }
      .topo { display: flex; gap: 1.5rem; padding: 0.75rem 1.25rem; border-bottom: 1px solid #e5e7eb;
              font: 14px system-ui, sans-serif; }
      .topo a { color: #1f2937; text-decoration: none; }
      .topo a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <nav class="topo">
      <a href="/documentacao">Documentação</a>
      <a href="/documentacao/api/openapi.yaml">openapi.yaml</a>
      <a href="/">Abrir a aplicação</a>
    </nav>
    <div id="swagger-ui"></div>
    <script src="/documentacao/api/referencia/swagger-ui-bundle.js"></script>
    <script>
      window.addEventListener("load", function () {
        window.SwaggerUIBundle({
          url: "/documentacao/api/openapi.yaml",
          dom_id: "#swagger-ui",
          deepLinking: true,
          supportedSubmitMethods: [],
        });
      });
    </script>
  </body>
</html>
`;

export function GET() {
  return new Response(PAGINA, { headers: { "content-type": "text/html; charset=utf-8" } });
}
