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

/**
 * **Endereço fora da lista é 404, e não página renderizada com status 200.**
 *
 * Medido em 01/10/2026, quando o `verificar:site` acusou o controle negativo:
 * `/documentacao/pagina-que-nao-existe` devolvia **200** com o corpo da tela *"Página não encontrada"*.
 * O `notFound()` acima rodava e a tela certa aparecia — o que não vinha era o status, porque com
 * `dynamicParams` no padrão (`true`) a rota aceita qualquer slug e renderiza sob demanda, e nessa rota o
 * resultado era servido como 200.
 *
 * O estrago não é de tela: **um link quebrado para dentro da documentação deixaria de ser detectável**.
 * Rastreador, leitor de tela e o nosso próprio verificador leem o status, não o texto — e foi exatamente
 * esse o controle que o `site.mjs` existe para exercer.
 *
 * Com `false`, só os endereços de `generateStaticParams` existem; qualquer outro cai no 404 do Next,
 * antes de a rota rodar. É o que a documentação permite afirmar, porque ela é inteira conhecida em tempo
 * de build — é a mesma razão que faz esta rota sobreviver ao `output: "standalone"`.
 */
export const dynamicParams = false;

/**
 * O título da aba é o `title` do frontmatter, sob o modelo `"%s · Resolve Aí"` do layout raiz (item 90).
 *
 * **A porta de entrada é a exceção.** O `title` dela é o próprio nome do produto (item 109), e o modelo
 * faria a aba dizer *"Resolve Aí · Resolve Aí"*. O `absolute` ignora o modelo, e a aba diz em que
 * superfície a pessoa está.
 */
export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
  const { slug } = await params;
  const pagina = source.getPage(slug);
  if (!pagina) notFound();

  const portaDeEntrada = slug?.length === 1 && slug[0] === "README";
  return {
    title: portaDeEntrada ? { absolute: "Documentação · Resolve Aí" } : pagina.data.title,
    description: pagina.data.description,
  };
}
