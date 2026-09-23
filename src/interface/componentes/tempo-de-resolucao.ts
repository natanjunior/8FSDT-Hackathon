import { duracaoEmTexto } from "./duracao";

/**
 * ============================================================================
 *  A linha do mês do quadro 4 de T-07 — o que se escreve ao lado da barra
 * ============================================================================
 *
 * **Três formas, e qual delas vale é decisão de quantas resoluções o mês teve:**
 *
 * | Mês | A linha |
 * |---|---|
 * | sem resolução | `— · 0 resolvidas` |
 * | 1 a 3 resoluções | `6 min, 12 min, 3,0 dias · 3 resolvidas` |
 * | 4 ou mais | `mediana 12 min · p90 2,1 dias · 11 resolvidas` |
 *
 * **O mês pequeno não repete a mediana rotulada.** Com até três valores, a lista já **contém** a mediana
 * quando o número é ímpar e a determina quando é par: `mediana 6 min · 6 min · 1 resolvida` poria o mesmo
 * número duas vezes na mesma linha, uma vez como estatística e outra como observação. A mediana continua
 * na resposta e continua desenhando a barra; o que ela não faz é aparecer duas vezes.
 *
 * **Os rótulos `mediana` e `p90` são obrigatórios na forma de cima.** Duas durações lado a lado sem rótulo
 * não se distinguem, e este item existe porque um número de tempo sem nome foi lido como outra coisa.
 *
 * **A formatação de unidade é `duracaoEmTexto`, do item 55, chamada — e não reescrita.** Um segundo lugar
 * que soubesse escrever duração seria o segundo que diverge.
 *
 * **O separador é ` · `, e a vírgula separa os valores da amostra.** Nenhum separador novo entra no
 * vocabulário da tela: é a mesma regra que `fluxo-mensal.ts` escreveu.
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela razão do item 57: derivação dentro de um
 * componente é derivação que nenhum teste do laço curto alcança.
 */

/** O que a linha precisa saber do mês. É a forma de `DashboardProjetado.tempoDeResolucao.porMes[]`. */
export type MesDoTempoDeResolucao = {
  mediana: number | null;
  p90: number | null;
  amostra: readonly number[] | null;
  resolvidas: number;
};

export function textoDoTempoDeResolucao(mes: MesDoTempoDeResolucao): string {
  const denominador = `${String(mes.resolvidas)} ${mes.resolvidas === 1 ? "resolvida" : "resolvidas"}`;

  if (mes.amostra !== null) {
    const valores = mes.amostra.map((horas) => duracaoEmTexto(horas)).join(", ");
    return `${valores} · ${denominador}`;
  }

  // O mês sem resolução. O `p90` entra na guarda junto com a mediana porque os dois vêm nulos no mesmo
  // caso, e um `!` aqui seria uma afirmação que o tipo não sustenta.
  if (mes.mediana === null || mes.p90 === null) return `— · ${denominador}`;

  return `mediana ${duracaoEmTexto(mes.mediana)} · p90 ${duracaoEmTexto(mes.p90)} · ${denominador}`;
}
