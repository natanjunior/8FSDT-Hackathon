import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/interface/componentes/ui/hover-card";

/**
 * **O lugar de uma ocorrência, escrito uma vez.** Aparece em T-03, T-05 e T-09.
 *
 * A referência do lugar vive no cartão de ponteiro, e **também** em T-05 — o cartão não é o único lugar
 * onde ela existe, que é o que o compromisso de acessibilidade exige. O `data-cartao-de-ponteiro` é o que
 * o `app/globals.css` esconde em aparelho sem ponteiro fino, porque toque dispara passagem do ponteiro no
 * primeiro contato.
 */
export function FichaDeLocal({
  nomeDaArea,
  referencia,
}: {
  nomeDaArea: string;
  referencia?: string | null;
}) {
  const nome = (
    <span className="text-tinta text-interface inline-flex items-center gap-1">
      <span aria-hidden>📍</span>
      {nomeDaArea}
    </span>
  );

  if (referencia === undefined || referencia === null || referencia === "") return nome;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{nome}</HoverCardTrigger>
      <HoverCardContent data-cartao-de-ponteiro className="text-meta w-64">
        {referencia}
      </HoverCardContent>
    </HoverCard>
  );
}
