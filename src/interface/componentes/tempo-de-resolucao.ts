import { duracaoEmTexto, SEM_DURACAO, TETO_DAS_HORAS } from "./duracao";
import { nomeCompletoDoMes } from "./fluxo-mensal";

/**
 * ============================================================================
 *  O quadro 3 de T-07 — o tempo de resolução, em linha e em palavra
 * ============================================================================
 *
 * **Três formas de mês, e qual delas vale é decisão de quantas resoluções o mês teve:**
 *
 * | Mês | `mediana` | `p90` | `amostra` |
 * |---|---|---|---|
 * | sem resolução | `null` | `null` | `null` |
 * | 1 a 3 resoluções | o valor | `null` | as durações |
 * | 4 ou mais | o valor | o valor | `null` |
 *
 * **O gráfico desenha a mediana e o p90** (item 73), e o mês pequeno é buraco na linha do p90. Quem diz os
 * valores do mês pequeno é a tabela do `Ver dados`, com as durações uma a uma.
 *
 * **A formatação de unidade é `duracaoEmTexto`, do item 55, chamada — e não reescrita.** Um segundo lugar
 * que soubesse escrever duração seria o segundo que diverge. A unidade do eixo segue o mesmo degrau.
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela razão do item 57: derivação dentro de um
 * componente é derivação que nenhum teste do laço curto alcança.
 */

/** O que o quadro precisa saber do mês. É a forma de `DashboardProjetado.tempoDeResolucao.porMes[]`. */
export type MesDoTempoDeResolucao = {
  /** `YYYY-MM`. O veredito escreve o nome do mês a partir dele. */
  mes: string;
  mediana: number | null;
  p90: number | null;
  amostra: readonly number[] | null;
  resolvidas: number;
};

/** A frase que ocupa o lugar do número no mês sem resolução — literal do protótipo (critério 36.2). */
export const SEM_RESOLUCAO_NO_MES = "nenhuma resolução no mês";

/**
 * A junção com *"e"*: `3 h e 48 h`, `3 h, 5 h e 9 h`. **É nova no projeto**, que só juntava com vírgula,
 * e sai da ICU, pelo argumento do cabeçalho de `datas.ts`.
 */
const JUNCAO = new Intl.ListFormat("pt-BR", { type: "conjunction" });

const duracoes = (amostra: readonly number[]): string =>
  JUNCAO.format(amostra.map((horas) => duracaoEmTexto(horas)));

export type UnidadeDoEixo = { divisor: number; sufixo: string };

/**
 * **A unidade do eixo segue a magnitude do maior valor desenhado**, pelo degrau de `duracaoEmTexto`:
 * acima de `TETO_DAS_HORAS`, dias; a partir de uma hora, horas; abaixo, minutos. O eixo tem uma unidade
 * só, e o valor desenhado é o número em horas dividido por `divisor`.
 */
export function unidadeDoEixo(maiorEmHoras: number): UnidadeDoEixo {
  if (maiorEmHoras > TETO_DAS_HORAS) return { divisor: 24, sufixo: "d" };
  if (maiorEmHoras >= 1) return { divisor: 1, sufixo: "h" };
  return { divisor: 1 / 60, sufixo: "min" };
}

/**
 * **O veredito fala do mês mais recente que teve resolução.** Com p90, a mediana e o p90 em palavra;
 * com amostra pequena, as durações uma a uma, porque p90 de três pontos é valor que ninguém observou.
 */
export function vereditoDoTempo(
  meses: readonly MesDoTempoDeResolucao[],
  comAno: boolean,
): string {
  const recente = [...meses].reverse().find((mes) => mes.resolvidas > 0);
  if (recente === undefined || recente.mediana === null) return "Nenhuma resolução no período.";

  const nome = nomeCompletoDoMes(recente.mes, comAno);
  if (recente.p90 !== null) {
    return `Em ${nome}, metade das resoluções levou até ${duracaoEmTexto(recente.mediana)}, e uma em cada dez levou mais de ${duracaoEmTexto(recente.p90)}.`;
  }

  const quantas = `${String(recente.resolvidas)} ${recente.resolvidas === 1 ? "resolução" : "resoluções"}`;
  return `Em ${nome} houve ${quantas}: ${duracoes(recente.amostra ?? [recente.mediana])}.`;
}

/**
 * As três colunas de tempo da tabela do `Ver dados`: mediana, p90 e resoluções.
 *
 * **O mês vazio escreve a frase do contrato** na coluna da mediana; **o mês pequeno escreve as durações
 * no lugar do p90**, que é o número que ele não tem.
 */
export function celulasDoTempo(mes: MesDoTempoDeResolucao): {
  mediana: string;
  p90: string;
  resolvidas: string;
} {
  const resolvidas = String(mes.resolvidas);
  if (mes.mediana === null) {
    return { mediana: SEM_RESOLUCAO_NO_MES, p90: SEM_DURACAO, resolvidas };
  }
  if (mes.p90 === null) {
    return {
      mediana: duracaoEmTexto(mes.mediana),
      p90: `durações: ${duracoes(mes.amostra ?? [mes.mediana])}`,
      resolvidas,
    };
  }
  return { mediana: duracaoEmTexto(mes.mediana), p90: duracaoEmTexto(mes.p90), resolvidas };
}
