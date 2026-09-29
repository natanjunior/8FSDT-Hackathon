import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ID_DO_CONTEUDO } from "@/interface/componentes/pular-para-o-conteudo";
import { ligacaoDaPagina } from "@/interface/documentacao/ligacao";
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
      {/* O destino do salto (critério 94.6). O `<main>` do Fumadocs não aceita `id` nosso; este envolve o
          título, e o Tab seguinte cai no primeiro link do artigo. */}
      <div id={ID_DO_CONTEUDO} tabIndex={-1} className="outline-none">
        <DocsTitle>{pagina.data.title}</DocsTitle>
      </div>
      <DocsDescription>{pagina.data.description}</DocsDescription>
      <DocsBody>
        <Conteudo components={componentesMdx({ a: ligacaoDaPagina(pagina) })} />
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
