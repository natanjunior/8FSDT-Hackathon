/**
 * ============================================================================
 *  A linha inteira leva à ocorrência — item 67, critério 67.3
 * ============================================================================
 *
 * **Um link só por linha, e o alvo de teclado é o título.** Ele ganha uma camada que cobre a linha
 * inteira (`after:absolute after:inset-0`), e a linha vira `relative`. Assim o ponteiro clica em qualquer
 * lugar e chega à ocorrência, e o teclado continua com **uma parada por linha** — que é o que se perderia
 * embrulhando tudo num `<a>` com controles dentro, e o que se perderia de outro jeito pondo um link
 * invisível em cada célula.
 *
 * **O anel de foco é da linha, e não do título**, por `focus-within`: o que recebe o clique é a linha
 * toda, então é ela que precisa aparecer quando o título está focado.
 *
 * **O que fica POR CIMA vai em `relative z-10`:** o gatilho do cartão de Tempo. Sem isso a camada o
 * cobriria, e o cartão nunca abriria.
 *
 * **Módulo sem diretiva de cliente** (item 91): o painel, que é de servidor, usa o mesmo padrão na lista das
 * mais velhas e no cartão da mais velha, e só alcança estas constantes se elas não morarem num módulo de
 * cliente.
 */
export const LINHA_CLICAVEL =
  "relative hover:bg-secondary focus-within:outline-2 focus-within:outline-marca focus-within:-outline-offset-2";

/** A camada que cobre a linha. Vai no link do título, que é o alvo de teclado. */
export const CAMADA_DO_TITULO =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

/** **Por cima da camada** — o que precisa de clique próprio. */
export const ACIMA_DA_CAMADA = "relative z-10";
