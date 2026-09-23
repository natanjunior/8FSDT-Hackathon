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
 * Os valores são os da prancheta: caixa com raio 8, 3 px de respiro e 3 de vão; opção com raio 6 e 13
 * de lateral, na altura de 44 do alvo de toque; contagem no oitavo papel, 1 × 7 px.
 */
export const CAIXA_DO_FILTRO = "bg-muted flex w-full flex-wrap gap-[3px] rounded-md p-[3px] md:w-fit";

export const OPCAO_DO_FILTRO = [
  // `font-normal` não é redundante: a base do `ui/toggle.tsx` traz `font-medium`, e sem ele a opção
  // desmarcada pintaria em 500.
  "text-interface text-tinta-suave min-h-11 gap-2 rounded-sm px-3.25 font-normal",
  "data-[state=on]:bg-superficie data-[state=on]:text-tinta data-[state=on]:font-semibold data-[state=on]:shadow-sm",
].join(" ");

export const CONTAGEM_DO_FILTRO =
  "bg-background text-tinta-suave text-rotulo-peca rounded-full px-1.75 py-px font-mono font-medium tabular-nums";
