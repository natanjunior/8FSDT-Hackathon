"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import {
  cicloDaOrdem,
  semearOrdem,
  type EfeitoDaOrdem,
  type EstadoDaOrdem,
  type EventoDaOrdem,
} from "@/interface/componentes/ordem-da-lista";
import { MENSAGEM_SEM_CONEXAO, avisarErro, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  A ordem que se grava — o gancho de T-09 e T-14, item 44k
 * ============================================================================
 *
 * **A decisão mora em `cicloDaOrdem`**, que é pura e tem teste; este gancho só liga os efeitos ao React,
 * ao `fetch` e ao roteador. É a mesma divisão de `useEnvioDoModal` (44g).
 *
 * **A escrita é a do item 50:** `PUT /categorias/ordem` e `PUT /areas/ordem`, com `{ ids }` = a lista
 * inteira da organização, ativas e inativas, na ordem nova. É por isso que alça e setas ficam inertes com
 * filtro ou busca: o endpoint não aceita pedaço de lista.
 *
 * **`409 LISTA_DESATUALIZADA`** é *"a lista mudou desde que você a abriu"*: a linha volta, sai o aviso com
 * o `detail` do servidor e a página recarrega. **Esta tela não escreve frase própria para esse código** —
 * `mensagemDoProblema` a preferiria ao texto do servidor, e o item 50 redigiu aquele `detail` para cá.
 *
 * **Mover não gera aviso de sucesso** (critério 3): o movimento da linha é a resposta.
 *
 * **A re-semeadura acontece durante a renderização**, pelo padrão do React de ajustar estado guardando a
 * propriedade anterior, e é seguro porque o evento `semeou` não tem efeito: nada é disparado durante a
 * renderização.
 *
 * **A resposta do servidor precisa do estado de agora, e o chega por uma referência sincronizada**, que é
 * o padrão do *último valor*: ela se escreve no manipulador e no efeito, nunca na renderização. Aplicar o
 * ciclo dentro de um atualizador do React dispararia os efeitos duas vezes no modo estrito, e é por isso
 * que ele não é usado aqui.
 *
 * **`organizacaoId` vem por propriedade**, sempre o da renderização daquela aba, nunca lido do cookie no
 * clique (a afirmação do contrato §4.3).
 */

export type OrdemGravada<T> = {
  /** A lista de mostrar: a otimista. */
  readonly itens: readonly T[];
  readonly anuncio: string;
  readonly mover: (de: number, para: number) => void;
};

export function useOrdemGravada<T extends { readonly id: string }>(opcoes: {
  readonly itens: readonly T[];
  readonly endpoint: string;
  readonly organizacaoId: string;
  readonly tituloDaFalha: string;
}): OrdemGravada<T> {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoDaOrdem<T>>(() => semearOrdem(opcoes.itens));
  const [anterior, setAnterior] = useState(opcoes.itens);
  const [anuncio, setAnuncio] = useState("");
  const agora = useRef(estado);

  let atual = estado;
  if (anterior !== opcoes.itens) {
    atual = cicloDaOrdem(estado, { tipo: "semeou", itens: opcoes.itens }).estado;
    setAnterior(opcoes.itens);
    setEstado(atual);
  }

  useEffect(() => {
    agora.current = estado;
  }, [estado]);

  function executar(efeitos: readonly EfeitoDaOrdem[]): void {
    for (const efeito of efeitos) {
      if (efeito.tipo === "anunciar") setAnuncio(efeito.texto);
      if (efeito.tipo === "avisar-erro") avisarErro(opcoes.tituloDaFalha, efeito.aviso);
      if (efeito.tipo === "recarregar") router.refresh();
      if (efeito.tipo === "gravar") void gravar(efeito.ids, efeito.geracao);
    }
  }

  function aplicar(de: EstadoDaOrdem<T>, evento: EventoDaOrdem<T>): void {
    const passo = cicloDaOrdem(de, evento);
    // Geração velha, ou movimento que não move: o ciclo devolve o mesmo estado, e escrevê-lo apagaria
    // uma re-semeadura que tenha acontecido depois.
    if (passo.estado === de && passo.efeitos.length === 0) return;
    agora.current = passo.estado;
    setEstado(passo.estado);
    executar(passo.efeitos);
  }

  async function gravar(ids: readonly string[], geracao: number): Promise<void> {
    let evento: EventoDaOrdem<T>;
    try {
      const resposta = await fetch(opcoes.endpoint, {
        method: "PUT",
        headers: cabecalhosDeEscrita(opcoes.organizacaoId),
        body: JSON.stringify({ ids }),
      });
      const corpo: unknown = await resposta.json().catch(() => null);
      if (resposta.ok) {
        const devolvidos = (corpo as { itens?: unknown } | null)?.itens;
        evento = {
          tipo: "respondeu-ok",
          geracao,
          itens: Array.isArray(devolvidos) ? (devolvidos as readonly T[]) : agora.current.naTela,
        };
      } else {
        const codigo = (corpo as { codigo?: unknown } | null)?.codigo;
        evento = {
          tipo: "respondeu-erro",
          geracao,
          aviso: mensagemDoProblema(corpo),
          desatualizada: codigo === "LISTA_DESATUALIZADA",
        };
      }
    } catch (erro) {
      // Sem este ramo a rejeição do `fetch` subiria pela fronteira do React. O erro de controle do Next
      // continua subindo.
      unstable_rethrow(erro);
      evento = { tipo: "respondeu-erro", geracao, aviso: MENSAGEM_SEM_CONEXAO, desatualizada: false };
    }
    aplicar(agora.current, evento);
  }

  return {
    itens: atual.naTela,
    anuncio,
    mover: (de, para) => {
      aplicar(atual, { tipo: "moveu", de, para });
    },
  };
}
