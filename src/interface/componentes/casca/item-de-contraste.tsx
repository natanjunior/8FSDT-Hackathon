"use client";

import { Contrast } from "lucide-react";

import { DropdownMenuItem } from "@/interface/componentes/ui/dropdown-menu";
import { Toggle } from "@/interface/componentes/ui/toggle";

/**
 * **A chave de alto contraste do menu da pessoa** (item 85). Gêmea do *Tema escuro*
 * (`item-de-tema.tsx` diz por que é `Toggle`, por que o papel é `menuitemcheckbox` e por que o ligado
 * fica sem fundo). O leitor diz *"Alto contraste, marcado"*.
 */
export function ItemDeContraste({ alto, aoTrocar }: { alto: boolean; aoTrocar: (ligado: boolean) => void }) {
  return (
    <DropdownMenuItem asChild onSelect={(evento) => evento.preventDefault()}>
      <Toggle
        role="menuitemcheckbox"
        aria-checked={alto}
        aria-pressed={undefined}
        pressed={alto}
        onPressedChange={aoTrocar}
        className="text-interface h-auto min-h-11 w-full justify-start px-2 py-1.5 font-normal hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-transparent data-[state=on]:text-inherit data-[state=on]:focus:bg-accent data-[state=on]:focus:text-accent-foreground"
      >
        <Contrast aria-hidden="true" />
        Alto contraste
      </Toggle>
    </DropdownMenuItem>
  );
}
