/**
 * ============================================================================
 *  O teto do eixo das barras de T-07 — item 110, critério 6
 * ============================================================================
 *
 * **Mora fora do `.tsx`** pela razão dos itens 57 a 59: derivação dentro de um componente é derivação
 * que nenhum teste do laço curto alcança.
 *
 * **Só existe para quem tem denominador.** Os quadros 2, 5 e 6 não passam por aqui e continuam no domínio
 * automático do Recharts. Com denominador, o comprimento passa a ser parte de um todo — três votos de
 * um, de dez resolvidas, desenham três barras de 10%, e não três barras cheias (A-111).
 *
 * O maior valor entra na conta para nenhuma barra passar da ponta se um dia o denominador vier menor que
 * uma parte; o `1`, para o domínio nunca ser `[0, 0]`, que é o quadro 7 de um período sem resolvida.
 */
export function tetoDoEixo(valores: readonly number[], denominador: number): number {
  return Math.max(denominador, ...valores, 1);
}
