import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { Diagrama } from "@/interface/documentacao/diagrama";

/**
 * O mapeamento de elementos markdown para componentes.
 *
 * O único desvio do padrão é o `Mermaid`. O `source.config.ts` troca cada bloco ```` ```mermaid ```` por
 * `<Mermaid chart="…" />` antes do realce de código, e é aqui que esse elemento vira desenho.
 */
export function componentesMdx(extras?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Mermaid: ({ chart }: { chart: string }) => <Diagrama texto={chart} />,
    ...extras,
  };
}
