"use client";

import { Moon, Sun } from "lucide-react";
import { useId } from "react";

import { DropdownMenuCheckboxItem } from "@/interface/componentes/ui/dropdown-menu";
import { cn } from "@/interface/componentes/utilitarios";

/** A segunda linha do item com o alto contraste ligado (critério 114.4). */
export const RAZAO_DO_TEMA_INERTE = "O alto contraste define as cores.";

/**
 * **O controle de tema do menu de aparência** (itens 72, 85 e 114).
 *
 * **É o `DropdownMenuCheckboxItem` do catálogo** (critério 114.1). O Radix dá o papel
 * `menuitemcheckbox` e o `aria-checked`, e o catálogo reserva a coluna da esquerda (`pl-8`) para o visto.
 * O leitor diz *"Tema escuro, marcado"*, que é **em qual tema se está**, e não para onde o clique leva.
 *
 * **O menu não fecha ao trocar** (`preventDefault` no `onSelect`): a pessoa vê a tela mudar e pode
 * desfazer sem reabrir.
 *
 * **O ligado fica sem fundo, e é divergência declarada da spec 72 §4.2** (achado A-7). O item de menu
 * pinta o foco com `focus:bg-accent`; se o ligado também pintasse fundo, com o escuro por padrão o item
 * nasceria ligado e pareceria sempre focado, e quem navega pelas setas perderia onde está. Até o item 114
 * o estado se lia só pelo ícone e pelo `aria-checked`; desde ele, **o visto separa marcado de focado**, e
 * o fundo continua sendo só do foco.
 *
 * **O ícone e o visto dizem o que a tela pinta** (critério 114.3): lua no escuro, sol no claro, e com o
 * alto contraste ligado, lua e marcado, porque a paleta de contraste é escura. Quem calcula é
 * `temaExibido`, em `tema.ts`; a escolha guardada no cookie não muda.
 *
 * **Inerte com o alto contraste ligado, e não desabilitado** (critério 114.4, `respostas.md` P1 da spec
 * 114). `disabled` tiraria o item do foco móvel e da busca por digitação do Radix, e o leitor nunca
 * chegaria nele. Vai `aria-disabled`: o item continua alcançável, o leitor diz *"indisponível"* e lê a
 * razão pelo `aria-describedby`. **A trava mora no `onCheckedChange`**, porque o Radix o chama mesmo com o
 * `preventDefault` do `onSelect`. O visto, o ícone e o rótulo se apagam; a razão não, porque quem a lê
 * ligou o contraste para enxergar melhor. `textValue` fixa a busca por digitação no rótulo.
 */
export function ItemDeTema({
  escuro,
  inerte,
  aoTrocar,
}: {
  /** O tema exibido, e não o guardado: com o alto contraste ligado, é `true`. */
  escuro: boolean;
  /** Com o alto contraste ligado: focável, anunciado como indisponível, e sem efeito. */
  inerte: boolean;
  aoTrocar: (ligado: boolean) => void;
}) {
  const idDoRotulo = useId();
  const idDaRazao = useId();

  return (
    <DropdownMenuCheckboxItem
      checked={escuro}
      textValue="Tema escuro"
      aria-labelledby={idDoRotulo}
      aria-disabled={inerte || undefined}
      aria-describedby={inerte ? idDaRazao : undefined}
      onSelect={(evento) => evento.preventDefault()}
      onCheckedChange={(ligado) => {
        if (!inerte) aoTrocar(ligado);
      }}
      // O primeiro `span` do item é a coluna do visto (`ui/dropdown-menu.tsx:111`).
      className={cn("text-interface min-h-11", inerte && "[&>span:first-child]:opacity-50")}
    >
      <span className="flex flex-col gap-0.5">
        <span className={cn("flex items-center gap-2", inerte && "opacity-50")}>
          {escuro ? (
            <Moon aria-hidden="true" className="text-muted-foreground" />
          ) : (
            <Sun aria-hidden="true" className="text-muted-foreground" />
          )}
          <span id={idDoRotulo}>Tema escuro</span>
        </span>
        {inerte && (
          <span id={idDaRazao} className="text-meta text-tinta-suave">
            {RAZAO_DO_TEMA_INERTE}
          </span>
        )}
      </span>
    </DropdownMenuCheckboxItem>
  );
}
