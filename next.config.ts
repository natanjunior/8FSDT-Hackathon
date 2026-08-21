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
};

export default configuracao;
