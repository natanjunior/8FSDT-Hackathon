/**
 * ============================================================================
 *  A ordenação em três estados — item 68a
 * ============================================================================
 *
 * **Primeiro clique crescente, segundo decrescente, terceiro tira a ordenação**, e sem ordenação vale a
 * ordem inicial de quem usa. Clicar em outra coluna começa nela, crescente, venha de onde vier.
 *
 * **Nada de participantes aqui dentro.** A lista de ocorrências (item 67) ordena pela mesma gramática, e
 * importa este arquivo em vez de copiá-lo.
 *
 * **No endereço, sem `ordem` é sem ordenação.** `sentido` sozinho não vale: sem coluna não há o que
 * inverter, e ler um estado *"decrescente de nada"* faria o próximo clique errar.
 */

export type Sentido = "crescente" | "decrescente";

export type Ordenacao<C extends string> = { readonly ordem: C | null; readonly sentido: Sentido };

export const SEM_ORDENACAO = { ordem: null, sentido: "crescente" } as const;

export function proximaOrdenacao<C extends string>(atual: Ordenacao<C>, coluna: C): Ordenacao<C> {
  if (atual.ordem !== coluna) return { ordem: coluna, sentido: "crescente" };
  return atual.sentido === "crescente" ? { ordem: coluna, sentido: "decrescente" } : SEM_ORDENACAO;
}

export function ariaSortDa<C extends string>(
  atual: Ordenacao<C>,
  coluna: C,
): "ascending" | "descending" | "none" {
  if (atual.ordem !== coluna) return "none";
  return atual.sentido === "crescente" ? "ascending" : "descending";
}

/** O nome acessível diz o que o próximo clique faz, e contém o rótulo visível. */
export function rotuloDoCabecalho<C extends string>(atual: Ordenacao<C>, coluna: C, rotulo: string): string {
  const sentido = ariaSortDa(atual, coluna);
  if (sentido === "ascending") return `Inverter a ordem de ${rotulo}`;
  if (sentido === "descending") return `Tirar a ordenação de ${rotulo}`;
  return `Ordenar por ${rotulo}`;
}

/** **Valor desconhecido vale sem ordenação, sem erro.** */
export function lerOrdenacao<C extends string>(
  parametros: { get: (nome: string) => string | null },
  colunas: readonly C[],
): Ordenacao<C> {
  const ordem = colunas.find((coluna) => coluna === parametros.get("ordem")) ?? null;
  if (ordem === null) return SEM_ORDENACAO;
  return { ordem, sentido: parametros.get("sentido") === "decrescente" ? "decrescente" : "crescente" };
}

export function escreverOrdenacao<C extends string>(consulta: URLSearchParams, ordenacao: Ordenacao<C>): void {
  if (ordenacao.ordem === null) return;
  consulta.set("ordem", ordenacao.ordem);
  if (ordenacao.sentido === "decrescente") consulta.set("sentido", "decrescente");
}
