import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { source } from "@/interface/documentacao/source";
import { traducoes } from "@/interface/documentacao/traducoes";

import "./documentacao.css";

/**
 * O layout da documentação.
 *
 * O `RootProvider` fica **aqui**, e não no layout raiz, pelo mesmo motivo que o CSS: ele traz o contexto
 * de tema e de busca do Fumadocs, e o produto tem os seus próprios. Escopado à rota, os dois convivem.
 *
 * A busca aponta para `/documentacao/api/busca`, e não para o `/api/search` padrão. O prefixo `/api/` é
 * da superfície HTTP do produto, que o `openapi.yaml` descreve inteira.
 */
export default function LayoutDaDocumentacao({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      i18n={{ locale: "pt-BR", translations: traducoes }}
      search={{ options: { api: "/documentacao/api/busca" } }}
    >
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: "Resolve Aí — Documentação", url: "/documentacao" }}
        githubUrl="https://github.com/natanjunior/8FSDT-Hackathon"
        links={[
          { text: "Abrir a aplicação", url: "/", external: true },
          { text: "Referência da API", url: "/documentacao/api/referencia", external: true },
        ]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
