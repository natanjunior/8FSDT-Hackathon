import { MapPin } from "lucide-react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/interface/componentes/ui/hover-card";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * **O sublinhado promete o cartão, e só aparece onde ele existe** (critério 44q.9): no ramo do
 * `HoverCard`, e atrás da mesma consulta que esconde o cartão em aparelho de toque (guia §9). Hoje
 * nenhuma chamada do produto passa `referencia`, então este ramo não pinta em tela nenhuma — é a
 * crítica C1 do plano do 44q.
 */
const SUBLINHADO_DO_CARTAO =
  "[@media(hover:hover)_and_(pointer:fine)]:underline [@media(hover:hover)_and_(pointer:fine)]:decoration-linha [@media(hover:hover)_and_(pointer:fine)]:underline-offset-3";

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
  /* A tinta desce um degrau dentro de uma linha encerrada de T-03 (critério 44q.9). Fora de uma linha
     com `group/linha`, a variante não casa, e a ficha não muda. */
  const nome = (sublinhado: boolean) => (
    <span
      className={cn(
        "text-tinta text-interface group-data-[recuada]/linha:text-tinta-suave inline-flex items-center gap-1.5",
        sublinhado && SUBLINHADO_DO_CARTAO,
      )}
    >
      {/* **O pino, 15 px, traço 1.9, na tinta fraca, a 6 px do nome** (item 64). O emoji que ele
          substitui já era um alfinete; o que muda é que agora ele segue a tinta e o tema. */}
      <MapPin aria-hidden="true" strokeWidth={1.9} className="text-tinta-fraca size-[15px] shrink-0" />
      {nomeDaArea}
    </span>
  );

  if (referencia === undefined || referencia === null || referencia === "") return nome(false);

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{nome(true)}</HoverCardTrigger>
      <HoverCardContent data-cartao-de-ponteiro className="text-meta w-64">
        {referencia}
      </HoverCardContent>
    </HoverCard>
  );
}
