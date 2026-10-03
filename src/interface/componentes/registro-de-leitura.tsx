"use client";

import { useEffect, useRef } from "react";

import { acaoDeRegistrarLeitura } from "@/interface/acoes";

/**
 * **Grava a leitura de quem abriu, e não desenha nada** — itens 88 e 117.
 *
 * **Por que um componente de cliente, e não a própria renderização do servidor.** A escrita precisa
 * invalidar o segmento de T-03 no cache de cliente, e só uma função de servidor **chamada pelo navegador**
 * consegue isso. De lambuja, nada grava durante *prefetch*: a lista com a linha visível na tela não muda o
 * número, e o ponta a ponta prova.
 *
 * **Monta em toda abertura**: toda leitura conta para o sino (item 117), e o upsert é idempotente. Quando
 * a página monta isto, a ocorrência já está na tela. O `ref` impede a segunda chamada do mesmo ciclo de vida — o efeito duplo do modo estrito
 * em desenvolvimento não vira duas escritas, e a instrução é idempotente de qualquer forma.
 *
 * **A promessa é engolida de propósito.** Nada aqui tem o que dizer a quem lê: a ocorrência já apareceu.
 * Quem registra a falha é a ação, no servidor.
 */
export function RegistroDeLeitura({ ocorrenciaId }: { ocorrenciaId: string }) {
  const jaFoi = useRef(false);

  useEffect(() => {
    if (jaFoi.current) return;
    jaFoi.current = true;
    void acaoDeRegistrarLeitura(ocorrenciaId).catch(() => undefined);
  }, [ocorrenciaId]);

  return null;
}
