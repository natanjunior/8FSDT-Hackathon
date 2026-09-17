import type { ReactNode } from "react";

/**
 * ============================================================================
 *  O cabeçalho das telas da família Organização — item 44i
 * ============================================================================
 *
 * **A nota do canvas *"ORGANIZAÇÃO — O QUE VALE PARA AS CINCO"*:** cabeçalho igual ao de T-03, com o
 * título, uma linha com um fato e a ação principal à direita; sem a marca repetida no conteúdo e sem o
 * nome da organização como subtítulo. A barra superior já carrega a marca e a organização ativa.
 *
 * **O fato não é região viva**: ele não se atualiza, e região viva que nunca muda é ruído para quem usa
 * leitor de tela (o argumento do critério 44c.9). **A ação**, quando houver, fica à direita a partir de
 * `md` e embaixo no celular; T-15 e T-16 não têm.
 *
 * **Componente de servidor.**
 */
export function CabecalhoDaPagina({
  titulo,
  fato,
  acao,
}: {
  titulo: string;
  fato: string;
  acao?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-8">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-titulo-pagina text-tinta leading-snug font-semibold">{titulo}</h1>
        <p className="text-interface text-tinta-suave">{fato}</p>
      </div>
      {acao !== undefined && <div className="shrink-0">{acao}</div>}
    </header>
  );
}
