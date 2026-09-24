import { Avatar, AvatarFallback } from "@/interface/componentes/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/interface/componentes/ui/hover-card";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * **O sublinhado promete o cartão, e só aparece onde ele existe** (critério 44q.9): quando há `papel` ou
 * `contato`, e atrás da mesma consulta que esconde o cartão em aparelho de toque (guia §9). Hoje nenhuma
 * chamada do produto passa os dois, então ele não pinta em tela nenhuma — é a crítica C1 do plano do
 * 44q. A mesma cadeia de `ficha-de-local.tsx`.
 */
const SUBLINHADO_DO_CARTAO =
  "[@media(hover:hover)_and_(pointer:fine)]:underline [@media(hover:hover)_and_(pointer:fine)]:decoration-linha [@media(hover:hover)_and_(pointer:fine)]:underline-offset-3";

/** As iniciais: a primeira letra do primeiro nome e a do último. */
function siglaDe(nome: string): string {
  const partes = nome.trim().split(/\s+/u).filter(Boolean);
  return (
    (partes[0]?.[0] ?? "?") + (partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
}

/**
 * **O rosto da pessoa, escrito uma vez** — a ficha, a linha do tempo e as mensagens de T-05 (item 44q).
 * Três telas desenhando o avatar cada uma do seu jeito é o que o guia §7 proíbe para as fichas.
 *
 * **Laranja desde o item 64**, pela peça base: o dono quis a cor da marca em todo avatar.
 */
export function AvatarDePessoa({ nome, className }: { nome: string; className?: string }) {
  return (
    <Avatar className={className ?? "size-6"}>
      <AvatarFallback>{siglaDe(nome)}</AvatarFallback>
    </Avatar>
  );
}

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
  tamanho = "interface",
  idDoNome,
}: {
  nome: string;
  papel?: string | null;
  contato?: string | null;
  /** `"linha"` é o tamanho de linha de tabela e de ficha de modal (item 44j): avatar maior, nome no papel de linha. */
  tamanho?: "interface" | "linha";
  /** O `id` do nome, para a ação da linha apontar para ele com `aria-describedby` (item 44j). */
  idDoNome?: string;
}) {
  const temCartao = (papel ?? null) !== null || (contato ?? null) !== null;

  const face = (
    <span className={cn("inline-flex items-center", tamanho === "linha" ? "gap-2.5" : "gap-2")}>
      <AvatarDePessoa nome={nome} className={tamanho === "linha" ? "size-7" : "size-6"} />
      <span
        id={idDoNome}
        className={cn(
          // Um degrau abaixo dentro de uma linha encerrada de T-03 (critério 44q.9); fora dela, nada.
          "text-tinta group-data-[recuada]/linha:text-tinta-suave",
          tamanho === "linha" ? "text-titulo-linha" : "text-interface",
          temCartao && SUBLINHADO_DO_CARTAO,
        )}
      >
        {nome}
      </span>
    </span>
  );

  if (!temCartao) return face;

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
