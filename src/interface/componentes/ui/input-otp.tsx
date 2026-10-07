"use client"

import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { MinusIcon } from "lucide-react"

import { cn } from "@/interface/componentes/utilitarios"

/*
 * Divergências do catálogo (item 65). Um novo `shadcn add input-otp` desfaz as duas.
 *
 * 1. O registro importa `cn` de um módulo homônimo, que o CLI instala como pacote; aqui ele vem do
 *    apelido do projeto, e o pacote `cn` foi desinstalado (R-05 do 44b, pela terceira vez).
 * 2. As duas classes da variante escura do registro saíram — este produto troca token por `data-theme` e
 *    por preferência do sistema, e o guarda é `testes/interface/variante-escura.test.ts`.
 *
 * O resto é do catálogo, e quem veste a peça é `campo-de-codigo.tsx`: a casa deste arquivo traz o
 * tamanho e as cores do registro, e as classes do projeto entram por `className` na chamada.
 */

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number
}) {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      /* **A casa ativa continua com anel, e é a exceção do item 94.** O `input-otp` põe
         `outline: 0 solid transparent` inline na `<input>` real que recebe o foco, e esse estilo vence o
         `:focus-visible` do `@layer base`: sem o anel da casa, o código ficaria sem indicador nenhum.
         O anel passou de `ring-[3px] ring-ring/50` para opacidade cheia (critério 94.2), e a borda
         recolorida saiu (critério 134.2): o anel é a única marca. */
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-interface shadow-xs transition-all first:rounded-l-md first:border-l last:rounded-r-md aria-invalid:border-destructive data-[active=true]:z-10 data-[active=true]:ring-2 data-[active=true]:ring-ring data-[active=true]:aria-invalid:border-destructive data-[active=true]:aria-invalid:ring-destructive",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <MinusIcon />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
