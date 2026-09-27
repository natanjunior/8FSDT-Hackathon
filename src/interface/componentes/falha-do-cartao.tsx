"use client";

import { catchError, type ErrorInfo } from "next/error";
import type { ReactNode } from "react";

import { CorpoDoCartao } from "@/interface/componentes/cartao";
import { FRASES_DE_FALHA } from "@/interface/componentes/frases-de-falha";
import { Button } from "@/interface/componentes/ui/button";

type Propriedades = {
  /** A frase do cartão. `null` quando o recuo basta, como o título da linha do tempo. */
  frase: string | null;
  /** O que vem antes da frase: o trilho neutro da régua, a faixa com o título da conversa. */
  antes?: ReactNode;
  /** A frase dentro de `CorpoDoCartao`, para quem a põe fora dele (a conversa). */
  noCorpo?: boolean;
};

/**
 * **A falha de uma leitura secundária fica no cartão** (item 90, critério 5).
 *
 * T-05 dispara três leituras concorrentes do mesmo agregado e passa duas para dentro de `<Suspense>`.
 * Sem fronteira, uma falha transitória na segunda ou na terceira apaga a tela inteira — inclusive o
 * relato e o selo que já tinham chegado. Com ela, a falha fica no cartão que a esperava.
 *
 * **`catchError` e não uma classe à mão:** ele não engole `redirect()` nem `notFound()`, limpa o estado
 * de erro quando a pessoa navega, e o `retry()` dele repinta dentro de uma transição, preservando o
 * estado dos componentes de cliente que ficaram fora da fronteira — o texto meio escrito no campo de
 * mensagem, por exemplo.
 *
 * **`retry()` e não `reset()`:** no Next 16.3, `reset()` renderiza de novo sem buscar, e a falha aqui é
 * de leitura no servidor (`respostas.md` P2 da spec 90.1).
 *
 * **Nada do erro vai para a tela** (guia, regra 2): sem mensagem, sem `digest`, sem código. O registro
 * já acontece no servidor.
 */
function Recuo({ frase, antes, noCorpo = false }: Propriedades, { retry }: ErrorInfo) {
  const aviso =
    frase === null ? null : (
      <div className="flex flex-col items-start gap-3">
        <p className="text-corpo text-tinta-suave">{frase}</p>
        <Button type="button" variant="outline" className="h-11 font-medium" onClick={() => retry()}>
          {FRASES_DE_FALHA.acao}
        </Button>
      </div>
    );

  return (
    <>
      {antes}
      {aviso !== null && (noCorpo ? <CorpoDoCartao>{aviso}</CorpoDoCartao> : aviso)}
    </>
  );
}

export const FalhaDoCartao = catchError(Recuo);
