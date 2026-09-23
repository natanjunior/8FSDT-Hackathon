/**
 * ============================================================================
 *  O quadro 6 de T-07 — a idade do que está em aberto, em palavra
 * ============================================================================
 *
 * **Os limites chegam na faixa, e não por import.** A resposta publica `deDias` e `ateDias` em número —
 * é o que o critério 59.10 comprou: trocar os limites é uma linha em `LIMITES_DAS_FAIXAS_DE_IDADE`, sem
 * renomear `enum`, sem reescrever tabela de rótulo e sem refazer teste de projeção. Ler o mesmo número de
 * uma segunda fonte poria duas verdades numa frase só, e a frase estaria errada justamente quando elas
 * discordassem — o caso normal durante um deploy.
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela razão dos itens 57 e 58: derivação dentro de um
 * componente é derivação que nenhum teste do laço curto alcança.
 *
 * **Nada de cor, de peso nem de ícone.** A faixa mais velha se distingue **por palavra** (critério 59.5),
 * numa oração que entra quando há alguém nela e sai quando não há. Na linha da faixa ela não caberia: a
 * linha já diz *Mais de 90 dias*, e um `· a mais antiga` ao lado do número seria o mesmo fato escrito
 * duas vezes — foi o argumento que tirou a mediana repetida do mês pequeno, no item 58.
 */

/** O que a linha precisa saber da faixa. É a forma de `DashboardProjetado.abertasPorIdade[]`. */
export type FaixaDeIdadeNaTela = { deDias: number; ateDias: number | null; quantidade: number };

const dias = (quantos: number): string => `${String(quantos)} ${quantos === 1 ? "dia" : "dias"}`;

/**
 * `Até 7 dias` · `8 a 30 dias` · `31 a 90 dias` · `Mais de 90 dias`.
 *
 * **A faixa sem teto diz o limite dela, e não o começo:** ela abre em 91 e o que a define é o 90 que
 * ficou para trás. O singular existe porque os limites são de quem opera — um corte que comece em
 * `[1, …]` escreveria `Até 1 dias` sem ele.
 */
export function rotuloDaFaixaDeIdade(faixa: FaixaDeIdadeNaTela): string {
  if (faixa.ateDias === null) return `Mais de ${dias(faixa.deDias - 1)}`;
  if (faixa.deDias === 0) return `Até ${dias(faixa.ateDias)}`;
  return `${String(faixa.deDias)} a ${dias(faixa.ateDias)}`;
}

/**
 * O rodapé do cartão: **uma oração sempre, duas quando a faixa mais velha tem alguém.**
 *
 * A primeira cumpre o critério 59.6 — a organização recém-criada vê as quatro faixas a zero e uma linha
 * dizendo o que vai ser medido. A segunda é o critério 59.5, e acrescenta o que a linha da faixa não tem:
 * o número lido em voz alta, e a afirmação de que aquilo está esperando.
 *
 * **A mais velha é a ÚLTIMA do array**, e não a de `ateDias === null` procurada por busca: o array vem
 * ordenado por construção da Aplicação, e uma segunda regra de *qual é a mais velha* seria a segunda que
 * envelhece.
 */
export function textoDaIdadeEmAberto(faixas: readonly FaixaDeIdadeNaTela[]): string {
  const sempre = "Há quanto tempo o que está em aberto espera, contando do registro.";
  const maisVelha = faixas.at(-1);

  if (maisVelha === undefined || maisVelha.quantidade === 0) return sempre;

  const verbo = maisVelha.quantidade === 1 ? "espera" : "esperam";
  const quando = rotuloDaFaixaDeIdade(maisVelha).toLocaleLowerCase("pt-BR");

  return `${sempre} ${String(maisVelha.quantidade)} ${verbo} há ${quando}.`;
}
