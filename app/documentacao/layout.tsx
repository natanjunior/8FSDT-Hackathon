import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { source } from "@/interface/documentacao/source";

import "./documentacao.css";

/**
 * O layout da documentação.
 *
 * O `RootProvider` fica **aqui**, e não no layout raiz, pelo mesmo motivo que o CSS: ele traz o contexto
 * de tema e de busca do Fumadocs, e o produto tem os seus próprios. Escopado à rota, os dois convivem.
 */
export default function LayoutDaDocumentacao({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: "Resolve Aí — Documentação", url: "/documentacao" }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
