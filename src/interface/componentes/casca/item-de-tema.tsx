"use client";

import { Moon, Sun } from "lucide-react";

import { DropdownMenuItem } from "@/interface/componentes/ui/dropdown-menu";
import { Toggle } from "@/interface/componentes/ui/toggle";

/**
 * **O controle de tema do menu da pessoa** (item 72).
 *
 * **É o `Toggle` do catálogo, e entra no menu como item.** O conteúdo do menu do Radix prende o Tab e as
 * setas só percorrem itens, então um `Toggle` solto ali dentro não seria alcançável por teclado. Como
 * filho de `DropdownMenuItem asChild`, ele ganha foco, setas e `Enter`; o `Enter` chega a ele como clique.
 *
 * **O papel é `menuitemcheckbox`, com `aria-checked`**, e o `aria-pressed` do `Toggle` é apagado:
 * `aria-pressed` não é atributo válido em item de menu. O rótulo é fixo e o leitor diz *"Tema escuro,
 * marcado"*, que é **em qual tema se está**, e não para onde o clique leva. O ícone também diz o tema
 * atual: lua no escuro, sol no claro.
 *
 * **O menu não fecha ao trocar** (`preventDefault` no `onSelect`): a pessoa vê a tela mudar e pode
 * desfazer sem reabrir.
 *
 * **O ligado fica sem fundo, e é divergência declarada da spec 4.2** (achado A-7). O `Toggle` pinta o
 * ligado com `data-[state=on]:bg-accent` e o item de menu pinta o foco com `focus:bg-accent`; com o escuro
 * por padrão, o item nasceria ligado e pareceria sempre focado, e quem navega pelas setas perderia onde
 * está. O estado se lê pelo ícone e pelo `aria-checked`; o foco continua com fundo mesmo ligado.
 *
 * **Desabilitado com o alto contraste ligado** (item 85). O `disabled` vai nos dois: no item, para as
 * setas o pularem e o leitor dizer indisponível; no `Toggle`, para o clique não chegar. O `opacity-50` do
 * item desabilitado fica abaixo de 7:1 de propósito: controle inativo não tem piso de contraste, e é o
 * apagado que diz que ele não responde. O estado mora em `itens-de-aparencia.tsx`.
 */
export function ItemDeTema({
  escuro,
  desabilitado,
  aoTrocar,
}: {
  escuro: boolean;
  /** Com o alto contraste ligado: o estado fica, e as setas pulam o item (item 85). */
  desabilitado: boolean;
  aoTrocar: (ligado: boolean) => void;
}) {
  return (
    <DropdownMenuItem asChild disabled={desabilitado} onSelect={(evento) => evento.preventDefault()}>
      <Toggle
        role="menuitemcheckbox"
        aria-checked={escuro}
        aria-pressed={undefined}
        pressed={escuro}
        disabled={desabilitado}
        onPressedChange={aoTrocar}
        className="text-interface h-auto min-h-11 w-full justify-start px-2 py-1.5 font-normal hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-transparent data-[state=on]:text-inherit data-[state=on]:focus:bg-accent data-[state=on]:focus:text-accent-foreground"
      >
        {escuro ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        Tema escuro
      </Toggle>
    </DropdownMenuItem>
  );
}
