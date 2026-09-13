import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

/**
 * `standalone` é o que permite que o mesmo Dockerfile sirva o desenvolvimento e a produção
 * (ADR-0004): a saída carrega só o necessário para `node server.js`, sem `node_modules` inteiro.
 */
const configuracao: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // A imagem publicada é pública (ADR-0004), e **nada é embutido nela em tempo de build**: não há `env`
  // aqui e não há variável `NEXT_PUBLIC_*` no projeto, porque nada do provedor chega ao navegador. As
  // quatro variáveis chegam como ambiente do container, em tempo de execução.
  poweredByHeader: false,

  /**
   * `/documentacao` sozinho não é página: os documentos moram em `docs/`, e nenhum deles se chama
   * `index.md` — o índice da pasta é o `README.md`, que é assim para o GitHub renderizá-lo ao abrir o
   * diretório. Sem esta linha, quem clicasse no título da barra de navegação cairia em `404`.
   *
   * Não dá para resolver com um `page.tsx` em `app/documentacao/`: ele teria a mesma especificidade que o
   * catch-all opcional ao lado, e o Next recusa as duas rotas juntas.
   */
  async redirects() {
    return [{ source: "/documentacao", destination: "/documentacao/README", permanent: false }];
  },
};

/**
 * O `createMDX` compila os `.md` de `docs/` em componentes React, em tempo de build. Ele não lê arquivo
 * em tempo de execução, e é por isso que a rota de documentação sobrevive ao `output: "standalone"`: o
 * conteúdo entra no `.next`, e o `node server.js` o serve como página pré-renderizada.
 *
 * Onde ele lê está em `source.config.ts`, na raiz.
 */
export default createMDX()(configuracao);
