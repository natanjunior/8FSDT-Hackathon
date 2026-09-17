"use client";

import { useState, type DragEvent } from "react";

import { destinoDoVao, vaoDoArrasto } from "@/interface/componentes/ordem-manual";

/**
 * ============================================================================
 *  Arrastar uma linha, com o arrastar nativo do HTML — item 44j
 * ============================================================================
 *
 * **Sem dependência nova** (critério 9): `draggable`, `dragstart`, `dragover`, `drop` e `dragend`. O
 * gancho **não sabe o que é a linha**, e por isso serve a uma `<tr>` (item 44k) e a uma `<div>` (os
 * contatos de T-08).
 *
 * **Só a alça começa o arrasto**, e ela só existe onde há ponteiro fino. Quem usa teclado ou leitor de
 * tela tem as setas, que são o caminho acessível; a alça é escondida da árvore de acessibilidade.
 *
 * **A linha só recua no quadro seguinte ao início.** Mudar o DOM do elemento arrastado dentro do
 * `dragstart` cancela o arrasto em alguns navegadores, e é por isso que o estado tem duas partes: a
 * origem, que não desenha nada, e a visibilidade, que desenha.
 *
 * **A imagem que o navegador mostra é a linha inteira** (`setDragImage`), e não a alça: é o que a
 * prancheta *"T-09 · arrastando uma linha"* desenha.
 *
 * **Soltar fora, `Esc` ou qualquer fim de arrasto não movem nada**: `dragend` encerra sem chamar quem
 * grava.
 */

export type PropsDaAlca = {
  readonly draggable: boolean;
  readonly "aria-hidden": true;
  readonly "data-alca-de-arrasto": "";
  readonly onDragStart: (evento: DragEvent<HTMLElement>) => void;
  readonly onDragEnd: () => void;
};

export type PropsDaLinha = {
  readonly "data-linha-arrastavel": "";
  readonly onDragOver: (evento: DragEvent<HTMLElement>) => void;
  readonly onDrop: (evento: DragEvent<HTMLElement>) => void;
};

export type PropsDaVaga = {
  readonly onDragOver: (evento: DragEvent<HTMLElement>) => void;
  readonly onDrop: (evento: DragEvent<HTMLElement>) => void;
};

export type ArrastoDeLinha = {
  /** O índice da linha que está sendo arrastada, para ela recuar. `null` quando não há arrasto. */
  readonly arrastando: number | null;
  /** O vão onde a vaga tracejada aparece, de `0` a `quantidade`. `null` quando soltar ali não moveria. */
  readonly vaga: number | null;
  readonly propsDaAlca: (indice: number) => PropsDaAlca;
  readonly propsDaLinha: (indice: number) => PropsDaLinha;
  readonly propsDaVaga: () => PropsDaVaga;
};

type Arrasto = { readonly de: number; readonly visivel: boolean };

function metadeDeBaixo(evento: DragEvent<HTMLElement>): boolean {
  const caixa = evento.currentTarget.getBoundingClientRect();
  return evento.clientY > caixa.top + caixa.height / 2;
}

export function useArrastoDeLinha(opcoes: {
  readonly quantidade: number;
  readonly inerte: boolean;
  readonly aoMover: (de: number, para: number) => void;
}): ArrastoDeLinha {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [vaga, setVaga] = useState<number | null>(null);

  function encerrar(): void {
    setArrasto(null);
    setVaga(null);
  }

  function noLimite(vao: number): number {
    return Math.min(Math.max(vao, 0), opcoes.quantidade);
  }

  function passar(evento: DragEvent<HTMLElement>, vao: number): void {
    if (arrasto === null || opcoes.inerte) return;
    // Sem isto o navegador recusa soltar aqui.
    evento.preventDefault();
    evento.dataTransfer.dropEffect = "move";
    const limitado = noLimite(vao);
    setVaga(destinoDoVao(arrasto.de, limitado) === arrasto.de ? null : limitado);
  }

  function soltar(evento: DragEvent<HTMLElement>, vao: number): void {
    if (arrasto === null) return;
    evento.preventDefault();
    const de = arrasto.de;
    const para = destinoDoVao(de, noLimite(vao));
    encerrar();
    if (!opcoes.inerte && para !== de) opcoes.aoMover(de, para);
  }

  return {
    arrastando: arrasto !== null && arrasto.visivel ? arrasto.de : null,
    vaga,
    propsDaAlca: (indice) => ({
      draggable: !opcoes.inerte,
      "aria-hidden": true,
      "data-alca-de-arrasto": "",
      onDragStart: (evento) => {
        if (opcoes.inerte) {
          evento.preventDefault();
          return;
        }
        evento.dataTransfer.effectAllowed = "move";
        // O Firefox só começa o arrasto quando há dado.
        evento.dataTransfer.setData("text/plain", String(indice));
        const linha = evento.currentTarget.closest<HTMLElement>("[data-linha-arrastavel]");
        if (linha !== null) {
          const caixa = linha.getBoundingClientRect();
          evento.dataTransfer.setDragImage(linha, evento.clientX - caixa.left, evento.clientY - caixa.top);
        }
        setArrasto({ de: indice, visivel: false });
        window.requestAnimationFrame(() => {
          setArrasto((atual) => (atual !== null && atual.de === indice ? { de: indice, visivel: true } : atual));
        });
      },
      onDragEnd: encerrar,
    }),
    propsDaLinha: (indice) => ({
      "data-linha-arrastavel": "",
      onDragOver: (evento) => {
        passar(evento, vaoDoArrasto(indice, metadeDeBaixo(evento)));
      },
      onDrop: (evento) => {
        soltar(evento, vaoDoArrasto(indice, metadeDeBaixo(evento)));
      },
    }),
    propsDaVaga: () => ({
      onDragOver: (evento) => {
        if (vaga !== null) passar(evento, vaga);
      },
      onDrop: (evento) => {
        if (vaga !== null) soltar(evento, vaga);
      },
    }),
  };
}
