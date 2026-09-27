"use client";

import { useEffect, useRef } from "react";

import { acaoDeRegistrarAbertura } from "@/interface/acoes";

/**
 * **Marca a ocorrência como aberta, e não desenha nada** — item 88.
 *
 * **Por que um componente de cliente, e não a própria renderização do servidor.** A escrita precisa
 * invalidar o segmento de T-03 no cache de cliente, e só uma função de servidor **chamada pelo navegador**
 * consegue isso. De lambuja, nada grava durante *prefetch*: a lista com a linha visível na tela não muda o
 * número, e o ponta a ponta prova.
 *
 * **Monta só quando a leitura é a primeira**, e quem decide é a página: quando ela monta isto, a ocorrência
 * já está na tela. O `ref` impede a segunda chamada do mesmo ciclo de vida — o efeito duplo do modo estrito
 * em desenvolvimento não vira duas escritas, e a instrução é idempotente de qualquer forma.
 *
 * **A promessa é engolida de propósito.** Nada aqui tem o que dizer a quem lê: a ocorrência já apareceu.
 * Quem registra a falha é a ação, no servidor.
 */
export function RegistroDeAbertura({ ocorrenciaId }: { ocorrenciaId: string }) {
  const jaFoi = useRef(false);

  useEffect(() => {
    if (jaFoi.current) return;
    jaFoi.current = true;
    void acaoDeRegistrarAbertura(ocorrenciaId).catch(() => undefined);
  }, [ocorrenciaId]);

  return null;
}
