import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/interface/componentes/ui/breadcrumb";

/**
 * O caminho no topo da página própria de criar ou editar (guia §7, *Navegação*): a tela não oferece
 * *Voltar* no conteúdo, e quem quiser subir um nível usa este rastro ou o *Cancelar* do rodapé.
 *
 * **Componente de servidor, com o `Link` do Next escrito direto**: o `BreadcrumbLink` do catálogo compõe
 * por `Slot`, e composição fica do lado do cliente.
 */
export function CaminhoDaPagina({
  anterior,
  atual,
}: {
  readonly anterior: { readonly rotulo: string; readonly href: string };
  readonly atual: string;
}) {
  return (
    <Breadcrumb className="-mb-2.5">
      <BreadcrumbList className="text-interface text-tinta-suave">
        <BreadcrumbItem>
          <Link
            href={anterior.href}
            className="decoration-linha inline-flex min-h-11 items-center underline underline-offset-[3px]"
          >
            {anterior.rotulo}
          </Link>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-tinta-fraca" />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-tinta">{atual}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
