/**
 * ============================================================================
 *  A terceira seção do quadro 1 de T-07 — o que está voltando
 * ============================================================================
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela razão dos itens 57, 58 e 59: derivação dentro de um
 * componente é derivação que nenhum teste do laço curto alcança.
 *
 * **Nenhum rótulo viaja na resposta.** O texto da dupla são os dois nomes com um separador, e escrevê-lo é
 * da tela — o mesmo corte que o item 59 fez com a faixa de idade e o 55 com a unidade de tempo.
 * `statusRotulo` continua sendo a exceção, porque ele depende de quem lê.
 *
 * **O tipo é declarado aqui e não importado da Aplicação**, como `FaixaDeIdadeNaTela`: ler a mesma forma
 * de duas fontes poria duas verdades numa linha só.
 */

/** O que a linha precisa saber da dupla. É a forma de `DashboardProjetado.duplasRecorrentes[]`. */
export type DuplaNaTela = {
  area: { id: string; nome: string };
  categoria: { id: string; nome: string };
  quantidade: number;
};

/**
 * A chave da lista — **o par de identificadores, e nunca o rótulo**.
 *
 * Dois nomes iguais em organizações diferentes não colidem, mas uma Área e uma Categoria homônimas na
 * mesma organização sim, e `key` duplicada em React é defeito silencioso.
 */
export function chaveDaDupla(dupla: DuplaNaTela): string {
  return `${dupla.area.id}:${dupla.categoria.id}`;
}

/**
 * `Garagem — Subsolo 1 · Vazamentos` — **área primeiro**, como o critério 60.4 escreve a dupla.
 *
 * A frase do cartão diz *"oito vazamentos no mesmo bloco"*, que é categoria primeiro; os critérios dizem
 * *"área e categoria"* três vezes seguidas. Os critérios são o alvo, e a frase é prosa.
 *
 * **O separador é ` · `**, o mesmo do fluxo mensal e do quadro 4. Nenhum separador novo entra no
 * vocabulário da tela.
 */
export function rotuloDaDupla(dupla: DuplaNaTela): string {
  return `${dupla.area.nome} · ${dupla.categoria.nome}`;
}

/**
 * O que a seção escreve quando nenhuma dupla se repetiu no período — critério 60.3.
 *
 * **Duas orações curtas e nenhum aviso de defeito.** A primeira diz o que aconteceu; a segunda diz o que
 * vai aparecer ali, que é o critério literal. Ela não promete prazo, não pede ação e não explica o produto.
 */
export const SEM_DUPLA_RECORRENTE =
  "Nenhuma dupla se repetiu no período. Aqui aparece a mesma categoria voltando na mesma área, " +
  "a partir da segunda vez.";
