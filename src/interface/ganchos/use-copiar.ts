"use client";

import { useEffect, useRef, useState } from "react";

/**
 * **Copiar um texto, com a falha prevista** — extraído de `codigo-da-organizacao.tsx` no item 86, que
 * passou a ter dois consumidores: o código em T-15 e o link do convite.
 *
 * `navigator.clipboard` não existe fora de contexto seguro. Na falha, o desfecho é `selecione`, e quem
 * consome desenha o texto dentro de `copiaManual`, que o efeito seleciona para `Ctrl+C`. **O botão nunca
 * diz `Copiado` sem ter copiado.**
 */
export function useCopiar(texto: string) {
  const [desfecho, setDesfecho] = useState<"parado" | "copiado" | "selecione">("parado");
  const copiaManual = useRef<HTMLSpanElement>(null);

  // O texto da falha só existe depois do render que o desenha: a seleção vem no efeito, e não no `catch`.
  useEffect(() => {
    if (desfecho !== "selecione" || copiaManual.current === null) return;
    window.getSelection()?.selectAllChildren(copiaManual.current);
  }, [desfecho]);

  async function copiar() {
    try {
      // `navigator.clipboard` é `undefined` fora de contexto seguro — a checagem vem antes do `await`.
      if (navigator.clipboard === undefined) throw new Error("sem área de transferência");
      await navigator.clipboard.writeText(texto);
      setDesfecho("copiado");
      window.setTimeout(() => setDesfecho("parado"), 4000);
    } catch {
      setDesfecho("selecione");
    }
  }

  return { desfecho, copiar, copiaManual };
}
