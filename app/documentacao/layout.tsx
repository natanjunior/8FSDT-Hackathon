import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

import { PularParaOConteudo } from "@/interface/componentes/pular-para-o-conteudo";
import { source } from "@/interface/documentacao/source";
import { traducoes } from "@/interface/documentacao/traducoes";

import "./documentacao.css";

/**
 * O layout da documentação.
 *
 * O `RootProvider` fica **aqui**, e não no layout raiz, pelo mesmo motivo que o CSS: ele traz o contexto
 * de tema e de busca do Fumadocs, e o produto tem os seus próprios. Escopado à rota, os dois convivem.
 *
 * **O tema daqui é independente do produto, e o padrão é o mesmo: escuro** (item 72). A documentação
 * guarda a escolha dela, com o interruptor da barra lateral; o produto guarda a dele, no cookie `tema`.
 *
 * A busca aponta para `/documentacao/api/busca`, e não para o `/api/search` padrão. O prefixo `/api/` é
 * da superfície HTTP do produto, que o `openapi.yaml` descreve inteira.
 *
 * **O *Pular para o conteúdo* é o primeiro elemento focável daqui** (item 94, critério 6): a moldura da
 * documentação custava dezessete paradas de Tab antes do artigo. O destino é o âncora que
 * `[[...slug]]/page.tsx` põe em volta do título.
 */
export default function LayoutDaDocumentacao({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      i18n={{ locale: "pt-BR", translations: traducoes }}
      search={{ options: { api: "/documentacao/api/busca" } }}
      theme={{ defaultTheme: "dark" }}
    >
      <PularParaOConteudo />
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
