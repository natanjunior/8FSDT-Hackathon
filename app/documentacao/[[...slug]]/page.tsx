import { createRelativeLink } from "fumadocs-ui/mdx";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { componentesMdx } from "@/interface/documentacao/mdx";
import { source } from "@/interface/documentacao/source";

/**
 * A rota da documentação.
 *
 * Ela é estática: o `app/layout.tsx` não lê `cookies()` nem `headers()`, e não há middleware no projeto,
 * então a rota nasce pública e pré-renderiza sem configuração nova. O conteúdo entra no `.next` em tempo
 * de build, que é o que a faz sobreviver ao `output: "standalone"`.
 */
type Parametros = { params: Promise<{ slug?: string[] }> };

export default async function Pagina({ params }: Parametros) {
  const { slug } = await params;
  const pagina = source.getPage(slug);
  if (!pagina) notFound();

  const Conteudo = pagina.data.body;

  return (
    <DocsPage toc={pagina.data.toc} full={pagina.data.full}>
      <DocsTitle>{pagina.data.title}</DocsTitle>
      <DocsDescription>{pagina.data.description}</DocsDescription>
      <DocsBody>
        {/*
          O `createRelativeLink` é o que faz os 243 links relativos entre documentos continuarem
          resolvendo. Sem ele, `[Escopo](escopo.md)` viraria link para um arquivo `.md` que não existe na
          rota — e a falha seria silenciosa, porque o link continua parecendo um link.
        */}
        <Conteudo components={componentesMdx({ a: createRelativeLink(source, pagina) })} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { slug } = await params;
  const pagina = source.getPage(slug);
  if (!pagina) notFound();

  return { title: pagina.data.title, description: pagina.data.description };
}
