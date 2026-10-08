import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import type { Heading, Root, RootContent } from "mdast";

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
 */
export const docs = defineDocs({
  dir: "docs",

  /**
   * **O `files` do `meta` existe por causa de um achado.** A coleção de metadados casa `.json` e `.yaml`
   * por padrão, e `docs/api/openapi.yaml` entrou nela: 173 KB de especificação OpenAPI sendo lidos como
   * se fossem a configuração de uma pasta da barra lateral.
   *
   * Restringir ao nome `meta.json` resolve, e documenta a convenção: arquivo de ordenação da barra
   * lateral chama-se `meta.json`, e nada mais em `docs/` é lido como metadado.
   */
  meta: { files: ["**/meta.json"] },
});

/**
 * Tira o `#` de abertura do documento.
 *
 * Todo arquivo de `docs/` abre com um `#`, porque é o que o GitHub mostra como título. Na página, o título
 * vem do `title` do frontmatter, e o `#` repetiria o mesmo título logo abaixo dele. O `#` continua no
 * arquivo: quem some é a cópia dele na página.
 */
function remarkSemTituloRepetido() {
  return (arvore: Root) => {
    const primeiro = arvore.children.findIndex((no) => no.type !== "yaml" && no.type !== "html");
    const no = arvore.children[primeiro];
    if (no?.type === "heading" && (no as Heading).depth === 1) arvore.children.splice(primeiro, 1);
  };
}

/**
 * Devolve a centralização que o `remark-rehype` joga fora.
 *
 * `<div align="center">` é a única forma de centralizar que o GitHub entende, e markdown com HTML dentro
 * é markdown normal. Só que o par de marcadores chega aqui como nó `html` cru, e o `remark-rehype`
 * descarta HTML cru por segurança: o conteúdo de dentro sobrevive, a centralização não, e o bloco
 * aparece solto à esquerda na página enquanto fica centralizado no GitHub. Duas superfícies, dois
 * resultados, a partir do mesmo arquivo.
 *
 * Este plugin reconhece o par, tira os dois marcadores da árvore e envolve o que estava entre eles num
 * nó que o `remark-rehype` sabe transformar: `hName` escolhe a etiqueta e `hProperties` o atributo. Nada
 * de HTML cru passa adiante, e o GitHub continua lendo o arquivo como sempre leu.
 */
function remarkBlocoCentralizado() {
  const ABERTURA = /^<div\s+align="center">$/u;

  return (arvore: Root) => {
    const filhos = arvore.children;

    for (let i = 0; i < filhos.length; i += 1) {
      const no = filhos[i];
      if (no?.type !== "html" || !ABERTURA.test(no.value.trim())) continue;

      const fim = filhos.findIndex(
        (outro, j) => j > i && outro.type === "html" && outro.value.trim() === "</div>",
      );
      if (fim === -1) continue;

      const dentro = filhos.slice(i + 1, fim);
      const bloco = {
        type: "paragraph",
        children: dentro,
        data: { hName: "div", hProperties: { align: "center" } },
      } as unknown as RootContent;

      filhos.splice(i, fim - i + 1, bloco);
    }
  };
}

export default defineConfig({
  mdxOptions: {
    /**
     * **Os dois plugins vêm antes dos padrões, e a ordem é o conserto.**
     *
     * O bloco ```` ```mermaid ```` precisa virar componente antes que o realce de código o alcance. Depois
     * do realce, o `<pre>` que chega à página já não carrega a linguagem, e nenhum mapeamento de
     * componente consegue reconhecer o diagrama. Foi assim que os diagramas apareceram como código.
     *
     * Rodar antes também tira o texto dos diagramas do índice de busca, que é montado pelos plugins
     * padrão.
     */
    remarkPlugins: (padroes) => [
      remarkMdxMermaid,
      remarkSemTituloRepetido,
      remarkBlocoCentralizado,
      ...padroes,
    ],
  },
});
