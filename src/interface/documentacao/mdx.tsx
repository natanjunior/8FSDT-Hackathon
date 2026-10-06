import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import { Diagrama } from "@/interface/documentacao/diagrama";

import "fumadocs-ui/components/image-zoom2.css";

/**
 * O mapeamento de elementos markdown para componentes.
 *
 * São dois desvios do padrão, e os dois existem pela mesma razão: **o markdown continua markdown**. O
 * `.md` que o GitHub renderiza é o mesmo que vira página aqui, e nenhum dos dois desvios pede sintaxe
 * própria no arquivo.
 *
 * O `Mermaid` vem do `source.config.ts`, que troca cada bloco ```` ```mermaid ```` por
 * `<Mermaid chart="…" />` antes do realce de código, e é aqui que esse elemento vira desenho.
 *
 * O `img` embrulha toda imagem no `ImageZoom`. **As capturas da documentação são densas** — uma execução
 * da esteira, uma tabela de cobertura, um painel de sete quadros —, e na largura da página elas ficam
 * ilegíveis. A saída sem zoom seria aumentá-las até estragar o fluxo do texto. No `.md` continua
 * `![descrição](capturas/x.png)`, que no GitHub é imagem comum.
 */
export function componentesMdx(extras?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Mermaid: ({ chart }: { chart: string }) => <Diagrama texto={chart} />,
    img: (props: ComponentProps<"img">) => (
      <ImageZoom {...(props as ComponentProps<typeof ImageZoom>)} />
    ),
    ...extras,
  };
}
