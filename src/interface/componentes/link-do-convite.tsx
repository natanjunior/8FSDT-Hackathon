"use client";

import { Check, Copy } from "lucide-react";

import { Button } from "@/interface/componentes/ui/button";
import { useCopiar } from "@/interface/ganchos/use-copiar";

/**
 * **Copiar link** — o botão do cartão *Convidar pessoas* (item 120, bloco 10). **Copia o link, não o
 * código**, e o link não aparece escrito: a frase de cima diz o que ele faz, e o botão o entrega. **A falha
 * tem nome**, a mesma do código em T-15 (`useCopiar`): sem área de transferência, o link aparece
 * selecionado para `Ctrl+C`, e o botão nunca diz *Copiado* sem ter copiado.
 */
export function CopiaDoLink({ link }: { link: string }) {
  const { desfecho, copiar, copiaManual } = useCopiar(link);

  return (
    <div className="flex flex-col gap-2.5">
      <Button
        type="button"
        variant="outline"
        className="border-linha text-interface min-h-11 w-fit rounded-sm px-4 has-[>svg]:px-4"
        onClick={() => void copiar()}
      >
        {desfecho === "copiado" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {desfecho === "copiado" ? "Copiado" : "Copiar link"}
      </Button>
      <p role="status" aria-live="polite" className="text-meta text-tinta-suave max-w-115">
        {desfecho === "selecione" && (
          <>
            Selecione e copie:{" "}
            <span ref={copiaManual} className="text-tinta font-mono break-all select-all">
              {link}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
