"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

import { ehAFaixaAplicada, type Faixa } from "@/interface/componentes/faixa-de-periodo";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  O período em voo — a transição que o seletor começa e o painel inteiro lê
 * ============================================================================
 *
 * **Dois consumidores, um estado** (item 103, critério 2). O seletor de período escreve a URL e mostra o
 * envio no botão apertado; o conteúdo do painel recua enquanto os números novos não chegam. Até o 103 o
 * seletor descartava o sinalizador, e a spec do 71 recusou um contexto *"para um consumidor"*. Com dois, a
 * razão se inverte. É o mesmo desenho de `navegacao-da-lista.tsx`, e pela mesma razão:
 *
 * **O provedor fica acima do que é trocado.** `pendente` muda de forma urgente, e a árvore antiga — que
 * continua pintada porque a transição ainda não concluiu — recebe o valor novo pelo contexto e recua. Se
 * ele nascesse dentro do que a navegação troca, o recuo só apareceria depois de não haver o que esperar.
 *
 * **Recebe `children` do servidor e não os torna cliente.** Os quadros continuam renderizados no servidor.
 */
type PeriodoEmVooValor = { pendente: boolean; comecar: TransitionStartFunction };

const Contexto = createContext<PeriodoEmVooValor | null>(null);

export function usePeriodoEmVoo(): PeriodoEmVooValor {
  const valor = useContext(Contexto);
  if (valor === null) throw new Error("usePeriodoEmVoo fora de <PeriodoEmVoo>.");
  return valor;
}

export function PeriodoEmVoo({ children }: { children: ReactNode }) {
  const [pendente, comecar] = useTransition();
  return <Contexto.Provider value={{ pendente, comecar }}>{children}</Contexto.Provider>;
}

/**
 * **Aplicar o recorte que já está aplicado não navega.** A navegação para a mesma URL pode terminar sem
 * que a transição chegue a ficar pendente, e o seletor, que fecha quando ela termina, ficaria esperando
 * para sempre. Nesse caso ele só fecha.
 */
export function deveNavegar(periodo: Faixa, faixa: Faixa): boolean {
  return !ehAFaixaAplicada(periodo, faixa);
}

/**
 * **O conteúdo do painel, recuado enquanto o período troca** — a regra do guia de manter a lista anterior
 * recuada com barra fina no topo ao atualizar, com as mesmas classes de `cartao-da-lista.tsx`, inclusive a
 * barra inteira e parada sob movimento reduzido (critério 102.8). O filtro fica fora: é nele que está o
 * recibo.
 */
export function ConteudoDoPainel({ children }: { children: ReactNode }) {
  const { pendente } = usePeriodoEmVoo();

  return (
    <div aria-busy={pendente} className="relative">
      {pendente && (
        <span aria-hidden className="bg-muted absolute inset-x-0 -top-3 h-0.5 overflow-hidden">
          <span className="bg-marca animate-barra-de-progresso block h-full w-1/3 motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-50" />
        </span>
      )}
      <div
        className={cn(
          "flex flex-col gap-6 transition-opacity",
          pendente && "pointer-events-none opacity-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}
