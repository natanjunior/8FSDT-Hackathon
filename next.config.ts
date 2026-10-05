import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

/**
 * Os cinco cabeçalhos de segurança, servidos em toda rota (item 127). Nenhum deles bloqueia origem: eles
 * declaram política ao navegador, e por isso não quebram Supabase, Azure Blob nem a documentação.
 *
 * **Não há política de conteúdo (CSP) aqui, nem em modo de relatório, e a ausência é decisão.** Uma CSP
 * escrita sem ninguém olhando o console bloqueia origem em tempo de execução, onde nenhum teste a pega. Se
 * ela entrar, entra como item próprio, em modo de relatório primeiro.
 *
 * O HSTS vale em todo ambiente porque a configuração não distingue ambiente, e não precisa: o navegador
 * ignora `Strict-Transport-Security` recebido por HTTP (RFC 6797, §8.1), que é como `next dev` e a pilha
 * local respondem. Sem `preload`: o domínio `azurecontainerapps.io` não é nosso para inscrever na lista.
 */
const CABECALHOS_DE_SEGURANCA = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // A câmera da foto vem do seletor de arquivo, que não passa por esta política. Área de transferência e
  // compartilhamento, que o produto usa, ficam no padrão do navegador.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Defesa de enquadramento: nenhuma tela do produto é aberta dentro de `iframe`, nem pelo próprio site.
  { key: "X-Frame-Options", value: "DENY" },
];

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

  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_DE_SEGURANCA }];
  },

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
