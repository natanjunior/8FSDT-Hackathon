/**
 * ============================================================================
 *  A cor de cada barra de T-07 — item 134, critérios 7, 8 e 9
 * ============================================================================
 *
 * **Mora fora do `.tsx`** pela razão do `teto-do-eixo.ts`: derivação dentro de componente é derivação que
 * nenhum teste do laço curto alcança.
 *
 * **Quem escolhe é o quadro, e não a peça.** Os quadros 4 e 5 não passam cor e ficam no padrão, o
 * `--chart-1`. Os quadros 2 e 7 passam `degrauDaEscala(indice)`: a escala é **posicional**, pela ordem das
 * barras, e não pelo que elas significam. O quadro 6 passa `corDoStatusNaBarra(status)`, e é a única
 * exceção à paleta posicional: veste a cor-sinal do selo, o fundo nos cheios e a tinta nos apagados.
 * *Em análise* e *Cancelada* caem as duas em `--ink-soft`, e a palavra ao lado de cada barra as distingue.
 *
 * **`--marca` é `--accent`** no CSS (`globals.css`, `--color-marca: var(--accent)`): o critério diz
 * `--marca`, e o token que existe como variável é o `--accent`.
 *
 * **O contorno de *Pausada*** (respostas.md P2): o âmbar mede 1,90:1 no branco, e o contorno em tinta suave
 * é quem passa o piso de 3:1. É o mesmo sinal que o marcador de *Pausada* tem na régua do ciclo.
 */

export type CorDaBarra = { cor: string; contorno?: string };

export const COR_PADRAO_DA_BARRA = "var(--chart-1)";

const ESCALA = [
  "var(--chart-1)",
  "var(--chart-1-2)",
  "var(--chart-1-3)",
  "var(--chart-1-4)",
  "var(--chart-1-5)",
] as const;

/** O degrau da barra de índice `indice`. Passou do fim, repete o último. */
export function degrauDaEscala(indice: number): CorDaBarra {
  const limitado = Math.min(Math.max(indice, 0), ESCALA.length - 1);
  return { cor: ESCALA[limitado] ?? COR_PADRAO_DA_BARRA };
}

const COR_DO_STATUS: Readonly<Record<string, CorDaBarra>> = {
  aberta: { cor: "var(--accent)" },
  pausada: { cor: "var(--atencao)", contorno: "var(--ink-soft)" },
  em_analise: { cor: "var(--ink-soft)" },
  em_atendimento: { cor: "var(--info)" },
  resolvida: { cor: "var(--ok)" },
  cancelada: { cor: "var(--ink-soft)" },
};

/** A cor da barra do status. Status que o mapa não conhece fica no padrão, e a barra continua lá. */
export function corDoStatusNaBarra(status: string): CorDaBarra {
  return COR_DO_STATUS[status] ?? { cor: COR_PADRAO_DA_BARRA };
}
