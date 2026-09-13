import Link from "next/link";

/**
 * **Os itens da barra lateral.**
 *
 * Eles moravam no rodapé de T-03 (`app/ocorrencias/page.tsx:214-255`) e passam a valer em toda tela de
 * dentro — que é o que torna a contagem de pedidos um sinal, em vez de um detalhe do fim de uma lista.
 *
 * **A contagem carrega a palavra, nunca só o número colorido** (compromisso A-5 de acessibilidade).
 */
export function Navegacao({
  podeVerDashboard,
  pendentes,
  podeConfigurar,
}: {
  podeVerDashboard: boolean;
  pendentes: number | null;
  podeConfigurar: boolean;
}) {
  return (
    <nav aria-label="Nesta organização" className="flex flex-col gap-1">
      <ItemDeNavegacao href="/ocorrencias" rotulo="Ocorrências" />
      {podeVerDashboard && <ItemDeNavegacao href="/dashboard" rotulo="Dashboard" />}
      {pendentes !== null && (
        <ItemDeNavegacao
          href="/vinculos"
          rotulo="Quem está na organização"
          apoio={
            pendentes === 0
              ? "nenhum pedido aguardando"
              : pendentes === 1
                ? "1 pedido aguardando"
                : `${pendentes} pedidos aguardando`
          }
        />
      )}
      {podeConfigurar && <ItemDeNavegacao href="/configuracao" rotulo="Categorias e áreas" />}
    </nav>
  );
}

function ItemDeNavegacao({ href, rotulo, apoio }: { href: string; rotulo: string; apoio?: string }) {
  return (
    <Link
      href={href}
      className="text-tinta hover:bg-secondary flex min-h-11 flex-col justify-center gap-0.5 rounded-sm px-3 py-2 transition-colors duration-[--tempo-ponteiro] ease-[--curva-ponteiro]"
    >
      <span className="text-interface">{rotulo}</span>
      {apoio !== undefined && <span className="text-tinta-suave text-meta">{apoio}</span>}
    </Link>
  );
}
