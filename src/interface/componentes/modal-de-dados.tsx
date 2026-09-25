"use client";

import { TableIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CONTEUDO_DO_DIALOG, CONTEUDO_DO_SHEET } from "@/interface/componentes/modal";
import { Button } from "@/interface/componentes/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/interface/componentes/ui/dialog";
import { SheetContent } from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

/**
 * ============================================================================
 *  O `Ver dados` de T-07 — a tabela do quadro, num modal
 * ============================================================================
 *
 * **O idioma é o do `Modal`** (`modal.tsx`): `Dialog` a partir de 768 px, `Sheet` de baixo abaixo disso, e
 * as mesmas duas classes de conteúdo. **O `Modal` em si não serve**: ele é da família de formulário, com
 * envio, obrigatórios e rodapé de ação, e aqui não há o que enviar.
 *
 * **O foco preso, o `Esc` e a volta do foco ao botão são do primitivo do Radix**, e ninguém os
 * reimplementa aqui. O ponta a ponta os afirma.
 *
 * **`aria-describedby={undefined}`** é o que o Radix aceita para conteúdo sem descrição, e silencia o aviso
 * dele no console. A tabela tem `caption`, e uma descrição a mais repetiria o período para o leitor de
 * tela.
 *
 * **O título do modal é o do quadro**, e o veredito do quadro fica fora dele, visível no cartão.
 *
 * **A largura é `3xl`, e não a `lg` do catálogo**: a tabela do quadro 1 tem seis colunas, e com `2xl` a
 * de *Saldo* saía cortada (captura de 24/09/2026).
 */
export function ModalDeDados({ titulo, children }: { titulo: string; children: ReactNode }) {
  const celular = useIsMobile();
  const corpo = (
    <>
      <div className={cn("shrink-0 pr-14", celular ? "px-4 pt-5" : "px-6 pt-5.5")}>
        <DialogTitle className="text-titulo-bloco text-tinta">{titulo}</DialogTitle>
      </div>
      <div
        className={cn("min-h-0 flex-1 overflow-y-auto", celular ? "px-4 pt-4 pb-5" : "px-6 py-5")}
      >
        {children}
      </div>
    </>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="border-linha text-interface">
          <TableIcon aria-hidden="true" className="size-4" />
          Ver dados
        </Button>
      </DialogTrigger>
      {celular ? (
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          className={CONTEUDO_DO_SHEET}
        >
          {corpo}
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-tinta-suave absolute top-2 right-2"
            >
              <XIcon aria-hidden="true" className="size-4.5" />
              <span className="sr-only">Fechar</span>
            </Button>
          </DialogClose>
        </SheetContent>
      ) : (
        <DialogContent
          aria-describedby={undefined}
          className={cn(CONTEUDO_DO_DIALOG, "md:max-w-3xl")}
        >
          {corpo}
        </DialogContent>
      )}
    </Dialog>
  );
}
