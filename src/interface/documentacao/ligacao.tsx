import { posix } from "node:path";

import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ComponentProps } from "react";

import { source } from "@/interface/documentacao/source";

type Pagina = NonNullable<ReturnType<typeof source.getPage>>;

/** Endereço que já sabe para onde vai: outro esquema, outro host, a raiz do site ou só uma âncora. */
const JA_RESOLVIDO = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu;

/**
 * O endereço, na página, de um link escrito no arquivo.
 *
 * Os documentos linkam como o GitHub lê: `escopo.md`, `adr/0003-….md`, `adr/`. O `resolveHref` do
 * Fumadocs só resolve caminho que começa com `./` ou `../`, e devolve o resto intocado. Intocado, um
 * `escopo.md` vira `/documentacao/escopo.md`, que não existe: foi assim que o corpo das páginas ficou
 * com os links quebrados enquanto a barra lateral funcionava.
 *
 * Três casos, e nenhum exige mudar os arquivos:
 *
 * - **caminho de documento** vira o endereço da página, âncora incluída;
 * - **pasta** (`adr/`) vira a página do `README.md` dela, que é como o GitHub a abre;
 * - **arquivo que não é página** (`api/openapi.yaml`) vira endereço absoluto em `/documentacao`, onde
 *   uma rota o serve.
 */
export function resolverLigacao(href: string, pagina: Pagina): string {
  if (href === "" || JA_RESOLVIDO.test(href)) return href;

  const [caminho = "", ancora] = href.split("#", 2);
  const alvo = caminho.endsWith("/") ? `${caminho}README.md` : caminho;
  const relativo = alvo.startsWith(".") ? alvo : `./${alvo}`;
  const pedido = ancora ? `${relativo}#${ancora}` : relativo;

  const resolvido = source.resolveHref(pedido, pagina);
  if (resolvido !== pedido) return resolvido;

  const noSite = posix.normalize(posix.join(posix.dirname(pagina.path), alvo));
  return `/documentacao/${noSite}${ancora ? `#${ancora}` : ""}`;
}

const Link = defaultMdxComponents.a as React.ComponentType<ComponentProps<"a">>;

/** O `<a>` das páginas de documentação, com o endereço resolvido pela regra acima. */
export function ligacaoDaPagina(pagina: Pagina) {
  return function Ligacao({ href, ...resto }: ComponentProps<"a">) {
    return <Link href={href === undefined ? href : resolverLigacao(href, pagina)} {...resto} />;
  };
}
