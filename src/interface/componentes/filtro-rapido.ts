/**
 * ============================================================================
 *  O filtro rápido de lista, escrito uma vez — item 44q, critério 3
 * ============================================================================
 *
 * **T-03, T-08, T-09 e T-14 montam a mesma peça** — `toggle-group` com a contagem ao lado de cada opção
 * (guia §8) —, e até o 44q ela estava copiada três vezes. A contagem fica **dentro** do nome acessível,
 * como decidiu a resposta P2 do 44p: esconder de quem usa leitor de tela um número que está na tela
 * seria negar-lhe o que todo mundo vê.
 *
 * **A caixa saiu no item 104.** Os valores vinham da prancheta (caixa com raio 8, 3 px de respiro), e a
 * Pauta Rule do guia põe filtro fora da caixa; desde 13/09/2026, onde o guia e a prancheta divergem vale o
 * guia (`style-guide.md:26`). As opções ficam sobre uma régua, e a marcada veste o cromo, como o item ativo
 * da barra lateral (`ui/sidebar.tsx:494`). Opção com raio 6 e 13 de lateral, na altura de 44 do alvo de
 * toque; contagem no oitavo papel, 1 × 7 px.
 */
// `rounded-none` anula o `rounded-md` da base de `ui/toggle-group.tsx:39`, que curvaria a régua nas pontas.
export const CAIXA_DO_FILTRO = "border-linha-suave flex w-full flex-wrap gap-1 rounded-none border-b pb-1 md:w-fit";

export const OPCAO_DO_FILTRO = [
  // `font-normal` não é redundante: a base do `ui/toggle.tsx` traz `font-medium`, e sem ele a opção
  // desmarcada pintaria em 500. `group/opcao` é o que deixa a contagem saber se a opção está marcada.
  "group/opcao text-interface text-tinta-suave min-h-11 gap-2 rounded-sm px-3.25 font-normal",
  "data-[state=on]:bg-secondary data-[state=on]:text-tinta data-[state=on]:font-semibold",
].join(" ");

/** Sobre o chão a pílula precisa do cromo para existir; sobre a opção marcada, que já é cromo, volta ao chão. */
export const CONTAGEM_DO_FILTRO =
  "bg-secondary group-data-[state=on]/opcao:bg-background text-tinta-suave text-rotulo-peca rounded-full px-1.75 py-px font-mono font-medium tabular-nums";
