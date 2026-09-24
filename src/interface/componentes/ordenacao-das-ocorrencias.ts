import { semPaginacao } from "./filtros-da-lista";
import {
  ariaSortDa,
  escreverOrdenacao,
  lerOrdenacao,
  proximaOrdenacao,
  rotuloDoCabecalho,
  SEM_ORDENACAO,
  type Ordenacao,
} from "./ordenacao-em-tres-estados";

/**
 * ============================================================================
 *  A ordem da tabela de T-03 — item 67, critério 67.5
 * ============================================================================
 *
 * **Invólucro, não cópia.** A gramática do ciclo é a do item 68a e é **importada**: o que mora aqui é só o
 * que é da lista de ocorrências, e que a tabela de participantes não tem.
 *
 * **E o que é da lista é uma coisa só: o padrão APARECE.** Em participantes, *sem ordenação* não marca
 * coluna nenhuma; aqui o critério 67.5 manda que a ordem inicial seja visível como tal. Então *sem
 * ordenação* e *Tempo decrescente* são o mesmo estado, e ele se desenha na coluna Tempo:
 *
 * - sem nada na URL, **Tempo mostra a seta para baixo**, com `aria-sort="descending"`;
 * - em Tempo o ciclo tem **dois** passos: do padrão, um clique inverte (a mais parada primeiro); o
 *   segundo devolve o padrão;
 * - nas outras colunas o ciclo é o de sempre: crescente, decrescente, e o terceiro clique devolve o
 *   padrão — que é Tempo decrescente, e não *nenhuma ordem*;
 * - `?ordem=atualizacao&sentido=decrescente` é lido como o padrão, para que o mesmo resultado não tenha
 *   dois endereços.
 */

/**
 * As mesmas colunas de `COLUNAS_DE_ORDENACAO` (Aplicação).
 *
 * **Copiada, e não importada, porque este arquivo é chamado do navegador**: importar `@/aplicacao` num
 * componente de cliente arrastaria a camada inteira para o pacote que desce. É a mesma razão do
 * `PAGINA_MAXIMA` em `page.tsx`. **Um teste prende as duas listas**, e é ele que impede a divergência.
 */
export const COLUNAS_DA_LISTA = [
  "status",
  "titulo",
  "area",
  "prioridade",
  "responsavel",
  "atualizacao",
] as const;

export type ColunaDaLista = (typeof COLUNAS_DA_LISTA)[number];

/** A coluna do padrão. Ela é a única com ciclo de dois passos, e a única marcada sem nada na URL. */
const COLUNA_DO_PADRAO = "atualizacao";

/** *Tempo decrescente* **é** o padrão, e o padrão se escreve como ausência. */
function normalizar(ordenacao: Ordenacao<ColunaDaLista>): Ordenacao<ColunaDaLista> {
  return ordenacao.ordem === COLUNA_DO_PADRAO && ordenacao.sentido === "decrescente"
    ? SEM_ORDENACAO
    : ordenacao;
}

export function lerOrdenacaoDaLista(parametros: {
  get: (nome: string) => string | null;
}): Ordenacao<ColunaDaLista> {
  return normalizar(lerOrdenacao(parametros, COLUNAS_DA_LISTA));
}

/**
 * O estado depois do clique.
 *
 * **A primeira linha é o ciclo de dois passos de Tempo**: do padrão, clicar em Tempo não começa uma ordem
 * nova — inverte a que já está valendo.
 */
export function proximaNaLista(
  atual: Ordenacao<ColunaDaLista>,
  coluna: ColunaDaLista,
): Ordenacao<ColunaDaLista> {
  if (atual.ordem === null && coluna === COLUNA_DO_PADRAO) {
    return { ordem: COLUNA_DO_PADRAO, sentido: "crescente" };
  }
  return normalizar(proximaOrdenacao(atual, coluna));
}

/** No padrão, Tempo é `descending`; as outras, `none`. Fora dele, é o do 68a. */
export function ariaSortNaLista(
  atual: Ordenacao<ColunaDaLista>,
  coluna: ColunaDaLista,
): "ascending" | "descending" | "none" {
  if (atual.ordem === null) return coluna === COLUNA_DO_PADRAO ? "descending" : "none";
  return ariaSortDa(atual, coluna);
}

/**
 * O nome acessível diz o que o próximo clique faz.
 *
 * **Tempo diz *inverter* nos dois estados em que ele é a ordem** — o padrão e o crescente —, porque em
 * ambos o próximo clique inverte. O rótulo do 68a diria *"Tirar a ordenação de Tempo"* no padrão, e isso
 * seria falso: não há como tirar a ordem que é o padrão. **Com outra coluna ordenando, Tempo volta a
 * dizer *"Ordenar por Tempo"***: ali ele não é a ordem, e o clique começa nele, crescente.
 */
export function rotuloNaLista(
  atual: Ordenacao<ColunaDaLista>,
  coluna: ColunaDaLista,
  rotulo: string,
): string {
  if (coluna === COLUNA_DO_PADRAO && (atual.ordem === null || atual.ordem === COLUNA_DO_PADRAO)) {
    return `Inverter a ordem de ${rotulo}`;
  }
  return rotuloDoCabecalho(atual, coluna, rotulo);
}

/** A URL do próximo estado: a ordem velha sai, a nova entra, e a paginação cai junto. */
export function consultaComOrdenacao(
  consultaAtual: string,
  proxima: Ordenacao<ColunaDaLista>,
): URLSearchParams {
  const proximos = semPaginacao(new URLSearchParams(consultaAtual));
  proximos.delete("ordem");
  proximos.delete("sentido");
  escreverOrdenacao(proximos, proxima);
  return proximos;
}
