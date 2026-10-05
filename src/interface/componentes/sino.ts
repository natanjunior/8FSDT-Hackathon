import type { NovidadeLida, SinoLido } from "@/aplicacao/ocorrencia";
import { rotuloDeStatus, type LenteDeRotulo } from "@/interface/projecoes";

import { tempoRelativo } from "./tempo-relativo";

/**
 * ============================================================================
 *  O sino — item 117, a metade pura
 * ============================================================================
 *
 * **Mora em `componentes/`, e não em `projecoes/`**: a projeção precisa de `tempoRelativo`, que é daqui, e
 * a direção que o código segue é `componentes` → `projecoes`. Sem DOM, e por isso testável em `node`.
 */

/** O teto do número na pílula; o nome acessível leva o exato (spec §3.10). */
export const TETO_DO_NUMERO = 99;

/** O que a tela precisa de uma novidade para escrever o tipo. */
export type NovidadeNaTela = Pick<NovidadeLida, "ocorrenciaId" | "titulo" | "tipo" | "em" | "por" | "alvo" | "naoLida">;

/** Zero é ausência (como no 88): a pílula não é desenhada. */
export function numeroDoSino(naoLidas: number): string | null {
  if (naoLidas <= 0) return null;
  return naoLidas > TETO_DO_NUMERO ? `${String(TETO_DO_NUMERO)}+` : String(naoLidas);
}

/** O número vai DENTRO do nome, e exato: é o que o leitor de tela anuncia (como o `Quantos` do recorte). */
export function nomeDoSino(naoLidas: number): string {
  if (naoLidas <= 0) return "Avisos";
  return naoLidas === 1 ? "Avisos, 1 não lido" : `Avisos, ${String(naoLidas)} não lidos`;
}

/**
 * O texto do tipo (spec §3.13). **O de status vem de fora**, já no rótulo de quem lê: a tabela de nomes é
 * da projeção da ocorrência, e uma segunda aqui divergiria (item 100).
 */
export function textoDoTipo(novidade: NovidadeNaTela, quemLePessoaId: string, status: string | null): string {
  switch (novidade.tipo) {
    case "criacao":
      return "Nova ocorrência";
    case "status":
      return status ?? "Mudança de status";
    case "comentario":
      return "Mensagem nova";
    case "atribuicao":
      return novidade.alvo?.pessoaId === quemLePessoaId ? "Atribuída a você" : "Novo responsável";
    case "compartilhamento":
      return novidade.alvo === null || novidade.alvo.pessoaId === quemLePessoaId
        ? "Compartilhada com você"
        : `Compartilhada com ${novidade.alvo.nome}`;
  }
}

/** O pé da lista, quando o limite deixou não lidas de fora (spec §3.11). */
export function foraDaLista(quantas: number): string {
  return quantas === 1
    ? "Mais 1 não lida fora desta lista."
    : `Mais ${String(quantas)} não lidas fora desta lista.`;
}

export type LinhaDoSino = {
  ocorrenciaId: string;
  href: string;
  titulo: string;
  tipo: string;
  por: string;
  quando: string;
};

export type SinoNaTela = {
  naoLidas: number;
  naoLidasNaLista: readonly LinhaDoSino[];
  lidas: readonly LinhaDoSino[];
  /** Não lidas que o limite deixou fora da lista; o pé diz quantas. */
  foraDaLista: number;
};

/**
 * **O que a lista mostra, já em texto**, em duas faixas. O rótulo do status é o de quem lê: o Solicitante
 * lê o da organização, o Gestor o nome do ciclo (item 100).
 */
export function projetarSino(
  sino: SinoLido,
  quemLe: { pessoaId: string; lente: LenteDeRotulo },
  agora: number,
): SinoNaTela {
  const linhas = sino.novidades.map((novidade) => ({
    naoLida: novidade.naoLida,
    linha: {
      ocorrenciaId: novidade.ocorrenciaId,
      href: `/ocorrencias/${novidade.ocorrenciaId}`,
      titulo: novidade.titulo,
      tipo: textoDoTipo(
        novidade,
        quemLe.pessoaId,
        novidade.statusNovo === null
          ? null
          : rotuloDeStatus(novidade.statusNovo, novidade.motivoPausa, quemLe.lente),
      ),
      por: novidade.por.nome,
      quando: tempoRelativo(novidade.em, agora),
    },
  }));
  const naoLidasNaLista = linhas.filter((l) => l.naoLida).map((l) => l.linha);
  return {
    naoLidas: sino.naoLidas,
    naoLidasNaLista,
    lidas: linhas.filter((l) => !l.naoLida).map((l) => l.linha),
    foraDaLista: Math.max(0, sino.naoLidas - naoLidasNaLista.length),
  };
}
