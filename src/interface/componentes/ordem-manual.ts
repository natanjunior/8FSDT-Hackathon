/**
 * ============================================================================
 *  A ordem manual — as decisões de mover uma linha, em funções puras (item 44j)
 * ============================================================================
 *
 * **Duas listas usam isto:** os contatos de T-08, no item 44j, e as categorias e áreas de T-09 e T-14, no
 * item 44k. O que as duas têm em comum é a regra; o que muda é quem grava. Em T-08, mover troca o estado
 * do formulário; no 44k, mover chama o endpoint do item 50. Nenhuma função daqui sabe qual.
 *
 * **Posições começam em zero aqui**, e o que a pessoa lê começa em um: quem escreve a frase soma um.
 *
 * **O vão** é o espaço entre duas linhas, numerado de `0` (antes da primeira) a `quantidade` (depois da
 * última). É nele que a vaga tracejada aparece enquanto se arrasta. Soltar no vão logo acima ou logo
 * abaixo da própria linha não a move, e nesses dois a vaga não aparece.
 *
 * **Sem `import`:** o arquivo não conhece React nem o domínio, e o teste roda em Node.
 */

/** A lista com o item `de` levado à posição final `para`. Índice fora da lista, ou igual, devolve a mesma lista. */
export function moverItem<T>(lista: readonly T[], de: number, para: number): readonly T[] {
  const dentro = (indice: number) => Number.isInteger(indice) && indice >= 0 && indice < lista.length;
  if (!dentro(de) || !dentro(para) || de === para) return lista;
  const copia = [...lista];
  // Os argumentos são avaliados antes da chamada: o item sai, e entra na posição final da lista menor.
  copia.splice(para, 0, ...copia.splice(de, 1));
  return copia;
}

/** O vão onde a linha cai quando o ponteiro está sobre a linha `sobre`, na metade de cima ou na de baixo. */
export function vaoDoArrasto(sobre: number, metadeDeBaixo: boolean): number {
  return metadeDeBaixo ? sobre + 1 : sobre;
}

/** A posição final da linha `de` solta no vão `vao`. Um vão abaixo dela conta uma casa a menos, porque ela sai de cima. */
export function destinoDoVao(de: number, vao: number): number {
  return vao > de ? vao - 1 : vao;
}

/** A posição final da linha `de` solta sobre a linha `sobre`. Igual a `de`, a vaga não aparece. */
export function destinoDoArrasto(de: number, sobre: number, metadeDeBaixo: boolean): number {
  return destinoDoVao(de, vaoDoArrasto(sobre, metadeDeBaixo));
}

/** A frase da região de estado depois de cada movimento. `posicao` é a que a pessoa lê, a partir de um. */
export function anuncioDeMovimento(posicao: number, total: number): string {
  return `Movido para a posição ${String(posicao)} de ${String(total)}.`;
}
