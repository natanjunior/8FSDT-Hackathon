import { Avatar, AvatarFallback } from "@/interface/componentes/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/interface/componentes/ui/hover-card";

/**
 * **Uma pessoa, escrita uma vez.** Aparece em T-03, T-05, T-06 e T-08.
 *
 * Escrever uma vez é o que impede que a mesma pessoa apareça de três formas diferentes em três telas.
 * **O papel vem em palavra** — nada é comunicado só por cor ou por forma. O que o cartão de ponteiro
 * mostra existe em outro lugar: o contato está em T-08.
 */
export function FichaDePessoa({
  nome,
  papel,
  contato,
}: {
  nome: string;
  papel?: string | null;
  contato?: string | null;
}) {
  const partes = nome.trim().split(/\s+/u).filter(Boolean);
  const sigla = (
    (partes[0]?.[0] ?? "?") + (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();

  const face = (
    <span className="inline-flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="text-rotulo-coluna font-mono">{sigla}</AvatarFallback>
      </Avatar>
      <span className="text-tinta text-interface">{nome}</span>
    </span>
  );

  if ((papel ?? null) === null && (contato ?? null) === null) return face;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{face}</HoverCardTrigger>
      <HoverCardContent data-cartao-de-ponteiro className="text-meta w-64">
        {papel !== undefined && papel !== null && <p className="text-tinta">{papel}</p>}
        {contato !== undefined && contato !== null && <p className="text-tinta-suave">{contato}</p>}
      </HoverCardContent>
    </HoverCard>
  );
}
