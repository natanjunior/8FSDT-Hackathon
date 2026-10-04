"use client"

import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { cn } from "@/interface/componentes/utilitarios"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

/*
 * Divergências do catálogo (item 122): o `cn` vem do apelido do projeto, e as classes da variante escura
 * do registro saíram, pela mesma razão do `switch.tsx` e do `radio-group.tsx`. O anel de foco do registro
 * também saiu (`outline-none` e o anel fracionário): o contorno da base vale aqui, como no resto (item 94). O estado marcado veste a
 * marca, como o `switch`. O estado intermediário mostra o traço, para a caixa do cabeçalho que marca a
 * página. **A área de toque de 44 px é de quem usa**, e não do primitivo. Um novo `shadcn add checkbox`
 * desfaz as divergências.
 */

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-marca data-[state=checked]:bg-marca data-[state=checked]:text-marca-foreground data-[state=indeterminate]:border-marca data-[state=indeterminate]:bg-marca data-[state=indeterminate]:text-marca-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {props.checked === "indeterminate" ? <MinusIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
