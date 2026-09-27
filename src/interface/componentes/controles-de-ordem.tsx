"use client";

import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useEffect, useRef } from "react";

import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { cn } from "@/interface/componentes/utilitarios";
import type { PropsDaAlca, PropsDaVaga } from "@/interface/ganchos/use-arrasto-de-linha";

/**
 * ============================================================================
 *  Subir, descer, arrastar — as peças da ordem manual (item 44j, e o 44k)
 * ============================================================================
 *
 * **As setas são o caminho acessível**, e servem ao toque e ao teclado; a alça só aparece onde há
 * ponteiro fino. O arrastar recusado no protótipo por ser hostil ao toque continua recusado para o
 * toque.
 *
 * **Depois de mover, o foco fica no mesmo botão da linha movida** — o React devolve o foco ao elemento
 * que o tinha, mesmo quando a linha troca de lugar. **Quando o botão fica inerte** porque a linha chegou
 * à ponta, o foco vai para a outra seta da mesma linha, que é o que o efeito abaixo faz.
 *
 * **Os rótulos vêm de fora**: aqui são *"Subir o contato 2"*, e no 44k, *"Subir uma posição"*.
 */

export const CLASSE_DA_VAGA = "border-marca bg-marca/[7%] h-10 rounded-md border border-dashed";

export function ControlesDeOrdem({
  posicao,
  total,
  rotulos,
  inerte,
  aoMover,
}: {
  /** A posição na lista, a partir de zero. */
  readonly posicao: number;
  readonly total: number;
  readonly rotulos: { readonly subir: string; readonly descer: string };
  readonly inerte: boolean;
  readonly aoMover: (de: number, para: number) => void;
}) {
  const subir = useRef<HTMLButtonElement>(null);
  const descer = useRef<HTMLButtonElement>(null);
  const focarDepois = useRef<"subir" | "descer" | null>(null);

  useEffect(() => {
    const alvo = focarDepois.current;
    focarDepois.current = null;
    if (alvo === "subir") subir.current?.focus();
    if (alvo === "descer") descer.current?.focus();
  }, [posicao]);

  return (
    <>
      <BotaoDeIcone
        ref={subir}
        rotulo={rotulos.subir}
        icone={<ArrowUp aria-hidden="true" />}
        disabled={inerte || posicao === 0}
        onClick={() => {
          focarDepois.current = posicao - 1 === 0 ? "descer" : null;
          aoMover(posicao, posicao - 1);
        }}
      />
      <BotaoDeIcone
        ref={descer}
        rotulo={rotulos.descer}
        icone={<ArrowDown aria-hidden="true" />}
        disabled={inerte || posicao >= total - 1}
        onClick={() => {
          focarDepois.current = posicao + 1 === total - 1 ? "subir" : null;
          aoMover(posicao, posicao + 1);
        }}
      />
    </>
  );
}

/**
 * A alça. **Só existe onde há ponteiro fino**, pela mesma consulta de mídia que guarda o cartão de
 * ponteiro — escrita aqui como variante de classe, sem tocar a folha de estilo global. `aria-hidden`
 * porque quem não tem ponteiro tem as setas.
 */
export function AlcaDeArrasto({ className, ...props }: PropsDaAlca & { readonly className?: string }) {
  return (
    <span
      {...props}
      className={cn(
        "text-tinta-suave hidden cursor-grab items-center justify-center active:cursor-grabbing",
        "[@media(hover:hover)_and_(pointer:fine)]:inline-flex",
        className,
      )}
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </span>
  );
}

/** A vaga tracejada, onde a linha vai cair. Em lista de blocos; numa tabela, o 44k a põe numa célula. */
export function VagaDeArrasto({ className, ...eventos }: PropsDaVaga & { readonly className?: string }) {
  return (
    <div aria-hidden="true" {...eventos} className={cn("px-4 py-1", className)}>
      <div className={CLASSE_DA_VAGA} />
    </div>
  );
}

/** O anúncio de cada movimento, só para leitor de tela. */
export function AnuncioDeOrdem({ texto }: { readonly texto: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {texto}
    </p>
  );
}
