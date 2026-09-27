/**
 * ============================================================================
 *  O cabeçalho de coluna e a célula, escritos uma vez — item 44q, critério 3
 * ============================================================================
 *
 * **Eram quatro cópias** (`lista-de-ocorrencias`, `lista-de-ordem-manual`, `tabela-de-areas`,
 * `tabela-de-participantes`), e já tinham divergido: T-03 com `py-2` e sem fundo, as outras três com
 * `py-0` e fundo. A prancheta tem uma só: fundo `--ground` e 11 px em cima e embaixo, nas duas.
 *
 * **O fundo mora também na peça** (`ui/table.tsx`, `TableHead`); aqui ele se repete porque o portão de
 * estilo mede esta cadeia, e ela tem de dizer sozinha o que a coluna é.
 */
export const ROTULO_DE_COLUNA =
  "text-rotulo-coluna text-tinta-suave bg-background h-auto px-4 py-2.75 font-mono uppercase";

export const CELULA = "text-interface px-4 py-2.75";
