import { defineDocs } from "fumadocs-mdx/config";

/**
 * ============================================================================
 *  A coleção de documentação, apontando para `docs/`
 * ============================================================================
 *
 * O `dir` aponta para `docs/`, e não para o `content/docs` que é o padrão do Fumadocs. Essa linha é a
 * decisão inteira: os arquivos ficam onde estão, continuam `.md`, e o GitHub continua renderizando.
 *
 * **Por que isso importa.** A entrega tem duas superfícies, o repositório e a aplicação publicada. Um
 * avaliador que abra o GitHub precisa conseguir ler; se a documentação virasse `.mdx` ou `.tsx`, ela só
 * existiria enquanto o container estivesse de pé. O `fumadocs-mdx` compila `.md` e `.mdx` na mesma
 * coleção, então uma fonte serve as duas superfícies sem cópia que possa divergir.
 *
 * Efeito colateral bom: os cinco verificadores continuam olhando os mesmos arquivos, sem uma linha de
 * mudança.
 */
export const docs = defineDocs({
  dir: "docs",

  /**
   * **O `files` do `meta` existe por causa de um achado, não por gosto.** A coleção de metadados casa
   * `.json` e `.yaml` por padrão, e `docs/api/openapi.yaml` entrou nela: 173 KB de especificação OpenAPI
   * sendo lidos como se fossem a configuração de uma pasta da barra lateral.
   *
   * Restringir ao nome `meta.json` resolve, e de quebra documenta a convenção: **arquivo de ordenação da
   * barra lateral chama-se `meta.json`, e nada mais em `docs/` é lido como metadado.**
   */
  meta: { files: ["**/meta.json"] },
});
