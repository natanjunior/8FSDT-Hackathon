/**
 * ============================================================================
 *  O corte do bloco 1 de T-07 — três categorias e o resto
 * ============================================================================
 *
 * **Quatro faixas, e a quarta é *Outras*.** O gráfico desenha as três categorias de maior total no período
 * e soma tudo o que sobra numa quarta faixa cinza. É o que faz o topo da pilha ser o total de ocorrências
 * do mês — um número verdadeiro, que responde *"está melhorando ou piorando"* — em vez da soma das que
 * couberam no desenho.
 *
 * **Módulo puro, e é por isso que ele não mora no componente.** A transposição é a parte que se quer sob
 * teste, e o projeto `unitario` roda em `environment: "node"`: importar daqui um módulo com JSX e
 * `"use client"` estrearia esse risco sem ganho. A ilha do gráfico importa este tipo, nunca o contrário —
 * a mesma direção que o `ciclo.ts` e o `linha-do-tempo.ts` já têm.
 *
 * **Ela não ordena e não preenche mês.** As duas coisas já aconteceram na Aplicação: `agrupar` devolve as
 * séries por total decrescente, com desempate alfabético em pt-BR, e com um ponto por mês do eixo — zero
 * onde não houve ocorrência. Repetir qualquer uma delas aqui seria afirmar a mesma coisa em duas camadas,
 * e a segunda envelhece sozinha.
 */

/** Uma linha do gráfico: um mês do eixo, com o valor de cada uma das quatro faixas. */
export type LinhaDoGrafico = {
  /** O rótulo pronto do mês — `jun`, ou `jun/26` quando a janela atravessa a virada do ano. */
  mes: string;
  categoria1: number;
  categoria2: number;
  categoria3: number;
  outras: number;
};

/** Uma série mensal como a projeção a entrega, com o nome já resolvido. */
type SerieDeEntrada = {
  rotulo: string;
  porMes: readonly { mes: string; quantidade: number }[];
};

/**
 * Transpõe série × mês em mês × série, com o corte em três mais *Outras*.
 *
 * O eixo é `rotulos`, e ele vem de fora porque quem o monta é o bloco 4 — `tempoMedioDeResolucao.porMes`
 * é a única série que o contrato garante sem buraco. Cada série é lida **por posição**, que é o que o
 * preenchimento da Aplicação torna seguro.
 *
 * **Os nomes voltam separados dos números.** As chaves das linhas são identificadores, porque o componente
 * do catálogo transforma cada chave em propriedade CSS `--color-<chave>` e *"Infiltração no 3º andar"* não
 * é nome de propriedade. O nome da categoria viaja em `nomes`, que é o que o balão mostra.
 */
export function linhasDaRecorrencia(
  series: readonly SerieDeEntrada[],
  rotulos: readonly string[],
): {
  linhas: readonly LinhaDoGrafico[];
  nomes: { categoria1?: string; categoria2?: string; categoria3?: string };
} {
  const nomeadas = series.slice(0, 3);
  const resto = series.slice(3);

  const quantidadeEm = (serie: SerieDeEntrada | undefined, indice: number): number =>
    serie?.porMes[indice]?.quantidade ?? 0;

  const linhas = rotulos.map((mes, indice) => ({
    mes,
    categoria1: quantidadeEm(nomeadas[0], indice),
    categoria2: quantidadeEm(nomeadas[1], indice),
    categoria3: quantidadeEm(nomeadas[2], indice),
    outras: resto.reduce((soma, serie) => soma + quantidadeEm(serie, indice), 0),
  }));

  return {
    linhas,
    nomes: {
      categoria1: nomeadas[0]?.rotulo,
      categoria2: nomeadas[1]?.rotulo,
      categoria3: nomeadas[2]?.rotulo,
    },
  };
}
