"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/interface/componentes/ui/dialog"
import { cn } from "@/interface/componentes/utilitarios"

/*
 * Divergências do catálogo (item 44l). Um novo `shadcn add command` desfaz as cinco.
 *
 * 1. O registro importa `cn` de um módulo homônimo, que o CLI instala como pacote; aqui ele vem do
 *    apelido do projeto.
 * 2. O registro importa o `Dialog` do caminho do próprio registro; aqui ele vem do nosso
 *    `ui/dialog.tsx`, que carrega a guarda `manterAbertoAoTocarNoAviso` do item 44g. **Deixar o CLI
 *    resolver esta dependência apagaria a guarda**, porque ele pergunta se sobrescreve o arquivo.
 * 3. O `CommandInput` do registro é `text-sm`. Aqui ele é `text-base md:text-corpo`, pela mesma razão do
 *    `ui/input.tsx` e do `ui/textarea.tsx`: abaixo de 16 px o navegador do celular amplia a página ao
 *    focar o campo, e este campo vive dentro da gaveta da tela que o RNF6 cronometra. O cabeçalho de
 *    grupo está no papel de rótulo de coluna, e não no `text-xs` do registro (item 104, A-116).
 * 4. O `CommandItem` do registro declara `cursor-default`, e ele **sai**. O item do `command` é
 *    `[role="option"]`, que é um dos quatro alvos da regra de ponteiro do `app/globals.css` — e
 *    `cursor-default` é utilitário, emitido numa camada posterior à `base`, então venceria a regra sem
 *    olhar especificidade. É o mesmo conserto que `select.tsx` e `dropdown-menu.tsx` já receberam, e há
 *    um caso em `testes/interface/tema.test.ts` que o cobra.
 * 5. O `CommandDialog` do registro repassa `showCloseButton` ao `DialogContent`, e **o nosso
 *    `ui/dialog.tsx` não tem essa propriedade**: ele desenha o fechar sempre, com a palavra em
 *    português. A propriedade sai daqui em vez de entrar lá — mexer no `DialogContent` mudaria o
 *    comportamento dos modais de T-15, T-16, T-08, T-09 e T-14, que já foram validados com o fechar
 *    sempre presente.
 *
 * **O `CommandDialog` fica, e não tem consumidor nesta entrega.** É o conteúdo do registro; apagá-lo
 * seria uma edição a mais num arquivo copiado, que o próximo `add` desfaz.
 */

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn("overflow-hidden p-0", className)}>
        <Command className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-11 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "placeholder:text-muted-foreground flex h-11 w-full rounded-md bg-transparent py-3 text-base focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-corpo",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  )
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className="py-6 text-center text-interface"
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "text-foreground [&_[cmdk-group-heading]]:text-tinta-suave overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-rotulo-coluna [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  )
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-interface select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("text-muted-foreground ml-auto text-meta tracking-widest", className)}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
