import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/interface/componentes/ui/breadcrumb";

type Nivel = {
  readonly rotulo: string;
  readonly href: string;
  /** O texto inteiro, quando o rótulo vem cortado (item 66: o título da ocorrência em 40 caracteres). */
  readonly titulo?: string;
};

/**
 * O caminho no topo da página (guia §7, *Navegação*): a tela não oferece *Voltar* no conteúdo, e quem
 * quiser subir um nível usa este rastro.
 *
 * **Um nível ou vários.** As páginas de criar e editar participante têm um nível acima; T-05 tem um e T-06
 * tem dois (item 66). `anterior` aceita os dois formatos para as chamadas de um nível continuarem como
 * estão.
 *
 * **Componente de servidor, com o `Link` do Next escrito direto**: o `BreadcrumbLink` do catálogo compõe
 * por `Slot`, e composição fica do lado do cliente.
 */
export function CaminhoDaPagina({
  anterior,
  atual,
  tituloDoAtual,
}: {
  readonly anterior: Nivel | readonly Nivel[];
  readonly atual: string;
  readonly tituloDoAtual?: string;
}) {
  const niveis: readonly Nivel[] = "href" in anterior ? [anterior] : anterior;

  return (
    <Breadcrumb className="-mb-2.5">
      <BreadcrumbList className="text-interface text-tinta-suave">
        {niveis.map((nivel) => (
          <Fragment key={nivel.href}>
            <BreadcrumbItem>
              <Link
                href={nivel.href}
                title={nivel.titulo}
                className="decoration-linha inline-flex min-h-11 items-center underline underline-offset-[3px]"
              >
                {nivel.rotulo}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-tinta-suave" />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage className="text-tinta" title={tituloDoAtual}>
            {atual}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
