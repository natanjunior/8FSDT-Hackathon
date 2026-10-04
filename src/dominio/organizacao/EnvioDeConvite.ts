/**
 * As regras do convite por e-mail (item 122) que valem dos dois lados: a Aplicação as aplica, a tela as
 * desenha. **O lote existe porque não há fila**: o envio acontece dentro da requisição, um depois do outro,
 * e vinte chamadas de um a dois segundos cabem com folga no tempo de uma requisição (ADR-0022).
 */
export const LOTE_DE_ENVIO = 20;

/** Gerar novo link não zera: conta todo envio do vínculo, de qualquer convite dele. */
export const ENVIOS_POR_PARTICIPANTE = 10;

/**
 * Os motivos de não envio, em ordem de checagem. O revogado vem primeiro, porque sem vínculo não há o que
 * checar, e ele cobre também a pessoa de outra organização, sem revelar que ela existe.
 */
export const MOTIVOS_DE_NAO_ENVIO = [
  "vinculo-revogado",
  "sem-email",
  "ja-tem-conta",
  "encarregado",
  "limite-do-dia",
  "limite-do-participante",
  "falha-no-envio",
] as const;

export type MotivoDeNaoEnvio = (typeof MOTIVOS_DE_NAO_ENVIO)[number];
