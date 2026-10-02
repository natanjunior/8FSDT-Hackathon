"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@/interface/componentes/ui/button";
import { useCopiar } from "@/interface/ganchos/use-copiar";

/**
 * O link do convite com o botão de copiar (item 86). O mesmo mecanismo e a mesma falha prevista do
 * código em T-15 (`useCopiar`).
 */
export function LinkDoConvite({ link }: { link: string }) {
  const { desfecho, copiar, copiaManual } = useCopiar(link);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <code className="text-corpo text-tinta font-mono break-all">{link}</code>
        <Button
          type="button"
          variant="outline"
          className="border-linha text-interface min-h-11 rounded-sm px-4 has-[>svg]:px-4"
          onClick={() => void copiar()}
        >
          {desfecho === "copiado" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {desfecho === "copiado" ? "Copiado" : "Copiar"}
          <span className="sr-only"> o link</span>
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-meta text-tinta-suave max-w-115">
        {desfecho === "selecione" ? (
          <>
            Selecione e copie:{" "}
            <span ref={copiaManual} className="text-tinta font-mono break-all select-all">
              {link}
            </span>
          </>
        ) : (
          "Quem abre o link pede para entrar, e você decide em Participantes."
        )}
      </p>
    </div>
  );
}
