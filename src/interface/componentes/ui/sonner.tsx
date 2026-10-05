"use client"

import { useSyncExternalStore, type CSSProperties } from "react"
import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/*
 * Divergências do catálogo (item 44g, ADR-0011). Um novo `shadcn add sonner` desfaz todas.
 *
 * 1. O registro traz `next-themes` para descobrir o tema, e o produto não tem seletor de tema: a variante
 *    escura é a preferência do sistema. `theme="system"` fixo faz o pacote ler essa preferência sozinho.
 * 2. A folha de estilo do pacote é injetada sem camada e vence as classes utilitárias. O que o produto
 *    muda no aviso passa por variável no `style`, por `style` em `toastOptions` e por classe com `!`.
 * 3. A posição acompanha a largura: embaixo à direita a partir de `lg`, e no alto abaixo disso, onde o
 *    canto de baixo é da barra fixa de ações e da gaveta do modal.
 * 4. O botão de fechar vai para o canto superior direito, como na prancheta, e ganha área de toque de
 *    44 px por um `::after` (compromisso A-3). O desenho continua o do pacote.
 * 5. Sucesso e atenção ficam com o ícone na tinta: o tema não tem cor própria para os dois.
 * 6. A lista aceita ponteiro mesmo com um modal aberto. O `radix-ui` desliga o ponteiro do `<body>`
 *    enquanto o modal está aberto, e sem isto o toque no aviso cairia no fundo do modal e o fecharia.
 *    O par dela é `manterAbertoAoTocarNoAviso`, abaixo, que o `dialog.tsx` e o `sheet.tsx` chamam.
 */
const TELA_GRANDE = "(min-width: 64rem)"

function assinar(avisar: () => void) {
  const consulta = window.matchMedia(TELA_GRANDE)
  consulta.addEventListener("change", avisar)
  return () => consulta.removeEventListener("change", avisar)
}

function ehTelaGrande() {
  return window.matchMedia(TELA_GRANDE).matches
}

function noServidor() {
  return true
}

const Toaster = ({ ...props }: ToasterProps) => {
  const telaGrande = useSyncExternalStore(assinar, ehTelaGrande, noServidor)

  return (
    <Sonner
      theme="system"
      position={telaGrande ? "bottom-right" : "top-center"}
      closeButton
      containerAriaLabel="Notificações"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <CircleXIcon className="size-4 text-destructive" />,
      }}
      toastOptions={{
        closeButtonAriaLabel: "Fechar aviso",
        classNames: {
          title: "font-semibold!",
          description: "text-tinta-suave! text-meta!",
          closeButton: "after:absolute after:-inset-3",
        },
        style: {
          fontFamily: "var(--font-sans)",
          fontSize: "var(--texto-interface)",
        },
      }}
      style={
        {
          pointerEvents: "auto",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "0",
          "--toast-close-button-transform": "translate(35%, -35%)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

/**
 * **O toque no aviso não é toque fora do modal.** Todo conteúdo de modal do catálogo chama isto no
 * `onInteractOutside`, o do `dialog.tsx` (item 44g) e o do `sheet.tsx` (item 44i): sem ele, fechar o
 * aviso de erro fecharia junto o modal que o guia manda manter aberto (§7, retorno de ação).
 */
function manterAbertoAoTocarNoAviso(evento: { target: EventTarget | null; preventDefault: () => void }) {
  if (evento.target instanceof Element && evento.target.closest("[data-sonner-toaster]") !== null) {
    evento.preventDefault()
  }
}

export { Toaster, manterAbertoAoTocarNoAviso }
