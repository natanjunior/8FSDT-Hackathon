"use client";

import { Contrast } from "lucide-react";

import { DropdownMenuCheckboxItem } from "@/interface/componentes/ui/dropdown-menu";

/**
 * **A chave de alto contraste do menu de aparência** (itens 85 e 114). Gêmea do *Tema escuro*
 * (`item-de-tema.tsx` diz por que é o item marcável do catálogo, por que o menu não fecha e por que o
 * ligado fica sem fundo). O leitor diz *"Alto contraste, marcado"*. Ela nunca fica inerte.
 */
export function ItemDeContraste({ alto, aoTrocar }: { alto: boolean; aoTrocar: (ligado: boolean) => void }) {
  return (
    <DropdownMenuCheckboxItem
      checked={alto}
      onSelect={(evento) => evento.preventDefault()}
      onCheckedChange={aoTrocar}
      className="text-interface min-h-11"
    >
      <Contrast aria-hidden="true" className="text-muted-foreground" />
      Alto contraste
    </DropdownMenuCheckboxItem>
  );
}
