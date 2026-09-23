import { Avatar, AvatarFallback } from "@/interface/componentes/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/interface/componentes/ui/hover-card";
import { cn } from "@/interface/componentes/utilitarios";

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
  const face = (
    <span className={cn("inline-flex items-center", tamanho === "linha" ? "gap-2.5" : "gap-2")}>
      <AvatarDePessoa nome={nome} className={tamanho === "linha" ? "size-7" : "size-6"} />
      <span
        id={idDoNome}
        className={cn(
          "text-tinta",
          tamanho === "linha" ? "text-titulo-linha" : "text-interface",
        )}
      >
        {nome}
      </span>
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
