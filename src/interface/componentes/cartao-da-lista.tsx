"use client";

import type { ReactNode } from "react";

import { useNavegacaoDaLista } from "./navegacao-da-lista";

/**
 * ============================================================================
 *  O cartão da lista, e o estado *atualizando* do guia §8
 * ============================================================================
 *
 * *"A lista anterior permanece, recuada e sem receber clique, com barra fina no topo do cartão."*
 *
 * **O recuo é da LISTA, e nunca da barra de filtros.** Quem está esperando filtrou, e pode ter
 * filtrado errado; desligar o caminho de volta durante a espera prende a pessoa no recorte que ela quer
 * desfazer. Por isso o provedor envolve a tela inteira e só esta peça consome o `pendente`. Desde o item
 * 44q a barra mora dentro do cartão, como primeira faixa, e fica fora do invólucro que recua.
 *
 * **`aria-busy` e não só opacidade**, porque a mudança precisa existir para quem não vê a tela.
 *
 * **A barra fina anima `transform`**, nunca `width`: as duas produzem a mesma imagem e só uma roda fora
 * da linha principal. É o guia §6.
 */
export function CartaoDaLista({ faixa, children }: { faixa?: ReactNode; children: ReactNode }) {
  const { pendente } = useNavegacaoDaLista();

  return (
    <section
      aria-busy={pendente}
      className="border-linha bg-superficie relative overflow-hidden rounded-lg border shadow-sm"
    >
      {pendente && (
        <span aria-hidden className="bg-muted absolute inset-x-0 top-0 h-0.5 overflow-hidden">
          <span className="bg-marca animate-barra-de-progresso block h-full w-1/3" />
        </span>
      )}

      {/* **A barra de filtros é a primeira faixa do cartão** (critério 44q.9), e fica FORA do invólucro
          que recua durante a espera: filtrar de novo enquanto a lista troca tem de continuar possível. A
          régua embaixo dela já é da própria barra (`barra-de-filtros.tsx`, `border-b`). */}
      {faixa}
      <div
        className={
          pendente ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"
        }
      >
        {children}
      </div>
    </section>
  );
}
