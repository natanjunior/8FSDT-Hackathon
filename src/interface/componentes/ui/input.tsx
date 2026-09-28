import * as React from "react"

import { cn } from "@/interface/componentes/utilitarios"

/* Divergência do catálogo (item 44g): o anel de `aria-invalid` aparece também sem foco, como a prancheta
   desenha o campo com problema. Um novo `shadcn add` desfaz. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-1 text-base transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/[16%]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
