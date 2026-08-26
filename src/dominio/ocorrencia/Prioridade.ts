/**
 * Três níveis (D6, confirmado na §13 do `modelo-de-dados.md`).
 *
 * **Nasce `normal` e o cliente não a envia** — enviá-la devolve `422 CAMPO_NAO_SUPORTADO`. Não há campo
 * de urgência em T-04: campo de urgência sofre inflação e vira ruído (D7), e quem prioriza é o Gestor,
 * lendo a descrição.
 */
export const PRIORIDADES = ["baixa", "normal", "alta"] as const;

export type Prioridade = (typeof PRIORIDADES)[number];

/** O que o servidor escreve no registro. */
export const PRIORIDADE_INICIAL: Prioridade = "normal";
