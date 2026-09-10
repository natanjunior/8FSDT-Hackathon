import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import { Diagrama } from "@/interface/documentacao/diagrama";

/**
 * O mapeamento de elementos markdown para componentes.
 *
 * O único desvio do padrão é o bloco `mermaid`: o markdown do pacote tem dez deles, e sem este
 * mapeamento eles apareceriam como bloco de código cru, que é o mesmo defeito silencioso que o
 * `verificar:mermaid` existe para pegar do outro lado.
 */
export function componentesMdx(extras?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: (props: { children?: unknown }) => {
      const filho = props.children as
        | { props?: { className?: string; children?: unknown } }
        | undefined;
      const classe = filho?.props?.className ?? "";

      if (classe.includes("language-mermaid")) {
        return <Diagrama texto={String(filho?.props?.children ?? "")} />;
      }

      const Pre = defaultMdxComponents.pre as React.ComponentType<Record<string, unknown>>;
      return <Pre {...props} />;
    },
    ...extras,
  };
}
