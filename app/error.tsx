"use client";

import Link from "next/link";

import { FRASES_DE_FALHA } from "@/interface/componentes/frases-de-falha";
import { CLASSE_DO_CAMINHO, MolduraDeConta } from "@/interface/componentes/moldura-de-conta";
import { Button } from "@/interface/componentes/ui/button";

/**
 * **A falha de renderização fora da casca** (item 90, critério 4): as telas de conta, o grupo `(foco)`, a
 * documentação e `/grupo`. Sem este arquivo, uma falha ali entregava a tela genérica do framework.
 *
 * **`retry()` e não `reset()`:** a falha é de leitura no servidor, e `reset()` renderiza de novo sem
 * buscar — não recupera de erro de Server Component (`respostas.md` P2 da spec 90.1).
 *
 * **Nada do erro vai para a tela** (guia, regra 2): sem mensagem, sem `digest`, sem código. O registro já
 * acontece no servidor.
 *
 * **O caminho secundário existe aqui e não na casca**, porque aqui não há barra lateral para levar a
 * pessoa a outro lugar.
 */
export default function FalhaDaPagina({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <MolduraDeConta
      titulo={FRASES_DE_FALHA.paginaTitulo}
      contexto={FRASES_DE_FALHA.paginaFrase}
      caminhos={
        <Link href="/" className={CLASSE_DO_CAMINHO}>
          {FRASES_DE_FALHA.voltarAoInicio}
        </Link>
      }
    >
      <Button type="button" className="h-11 w-full font-medium" onClick={() => retry()}>
        {FRASES_DE_FALHA.acao}
      </Button>
    </MolduraDeConta>
  );
}
