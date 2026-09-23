"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/interface/componentes/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/interface/componentes/ui/tooltip";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  A ação de linha — botão só com ícone, sempre visível (guia §7, item 44j)
 * ============================================================================
 *
 * *"Ação sobre uma linha de lista é botão só com ícone, sempre visível. Ele leva `aria-label` com o nome
 * da ação e dica na passagem do ponteiro com o mesmo texto."* A dica repete o rótulo e não carrega
 * informação nova, então não fere o sexto compromisso de acessibilidade.
 *
 * **O contexto da linha vem por `descritoPor`**, que aponta para o nome da pessoa na mesma linha: vinte
 * botões *"Editar participante"* iguais seriam indistinguíveis para quem navega por botões, e pôr o nome
 * no rótulo faria a dica diferir dele.
 *
 * **44 px** (compromisso A-3), e não os 34 da prancheta — a mesma decisão que o 44i tomou para *Editar*.
 *
 * **O provedor de dica já está montado**: a casca o traz com a barra lateral.
 *
 * **Duas formas, porque uma delas navega:** `BotaoDeIcone` é botão (abre modal, move linha, remove);
 * `LinkDeIcone` é endereço (*Editar participante*), e link não vira botão só para caber num padrão.
 */

/** O contorno das ações de linha: régua suave, tinta suave, e o fundo da casca ao passar o ponteiro. */
export const CONTORNO_DE_ACAO =
  "border-linha-suave bg-transparent text-tinta-suave shadow-none hover:bg-sidebar-accent hover:text-tinta";

type Comum = {
  readonly rotulo: string;
  readonly icone: ReactNode;
  /** O `id` do nome da pessoa na linha, para o `aria-describedby`. */
  readonly descritoPor?: string | undefined;
};

export function BotaoDeIcone({
  rotulo,
  icone,
  descritoPor,
  className,
  ...props
}: Comum & Omit<ComponentProps<typeof Button>, "children" | "aria-label" | "aria-describedby">) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={rotulo}
          aria-describedby={descritoPor}
          className={cn(CONTORNO_DE_ACAO, "rounded-sm", className)}
          {...props}
        >
          {icone}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="text-meta">
        {rotulo}
      </TooltipContent>
    </Tooltip>
  );
}

export function LinkDeIcone({ href, rotulo, icone, descritoPor }: Comum & { readonly href: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon" className={cn(CONTORNO_DE_ACAO, "rounded-sm")}>
          <Link href={href} aria-label={rotulo} aria-describedby={descritoPor}>
            {icone}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6} className="text-meta">
        {rotulo}
      </TooltipContent>
    </Tooltip>
  );
}
