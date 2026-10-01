import * as React from "react"
import { cn } from "@/interface/componentes/utilitarios"

/* Divergência do catálogo (item 44g): o anel de `aria-invalid` aparece também sem foco, como a prancheta
   desenha o campo com problema. Um novo `shadcn add` desfaz.
   Item 104: acima de `md` o campo escreve em `text-corpo`, o tamanho em que o texto será lido depois. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-sm border border-input bg-background px-3 py-2 text-base transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/[16%] md:text-corpo",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
