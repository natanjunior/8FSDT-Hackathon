"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/interface/componentes/utilitarios"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * **Gaveta abaixo de `md`, caixa centrada a partir de `md`** — decidido na spec do item 23 (§3.10), e
 * vale para os quatro modais de T-05, não só para `pausar`.
 *
 * A razão não é o comando: a §7.1 do `prototipo-low-fi.md` já manda *"comando com texto"* para gaveta
 * no celular e caixa em tela grande, e o `telas.html` confirma nas duas pontas — `.drawer` só em
 * moldura de celular, `.modal` só em moldura larga, em treze telas. *"Uma caixa centrada põe os botões
 * no meio da tela, onde a mão que segura o aparelho chega mal."*
 *
 * **O limiar é `md` (768 px), não `sm`**: é o que o produto já pratica para *celular contra tela
 * grande* (`lista-de-ocorrencias.tsx`, `lista-de-vinculos.tsx`). Adotar `sm` abriria uma faixa de
 * 128 px em que T-03 mostra cartões de celular e o modal abre como caixa de tela grande.
 *
 * **O componente `Drawer` do catálogo NÃO é adotado** — traria `vaul`, estado de largura no cliente e
 * uma segunda árvore de JSX por modal. `tw-animate-css`, já instalado, dá as animações. **Custo
 * declarado: não há arrastar-para-fechar**, e a alça (`.grab`) do protótipo não é replicada, porque
 * sinalizaria um gesto que esta gaveta não tem. A gaveta fecha pelos quatro caminhos que o `Dialog` já
 * dá — botão, `X`, `Esc` e clique fora.
 */
function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 grid w-full gap-4 rounded-t-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none">
          <XIcon />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
