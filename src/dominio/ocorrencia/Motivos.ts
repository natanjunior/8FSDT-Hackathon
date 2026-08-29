/**
 * Os motivos estruturados de `pausar` e `cancelar` — a invariante 5 (D8, D12, D23).
 *
 * **`MOTIVOS_DE_PAUSA` passou a ser exercido no item 23**, que é o comando `pausar`: ele é o domínio de
 * valor do `pausaSchema` e o campo obrigatório de `RegistroDeTransicao.pausa`.
 * **`MOTIVOS_DE_CANCELAMENTO` ainda não é** — o comando que o produz é o item 18, e até lá o tipo entra
 * porque o registro de transição o carrega como campo e a projeção tem de emiti-lo nulo.
 */
export const MOTIVOS_DE_PAUSA = [
  "aguardando_informacao_solicitante",
  "aguardando_peca",
  "aguardando_autorizacao",
  "aguardando_terceiro",
] as const;

export type MotivoPausa = (typeof MOTIVOS_DE_PAUSA)[number];

/**
 * **Um conjunto só, não dois** (`modelo-de-dados.md` §5). As listas da D5 são por papel, `duplicada` está
 * nas duas, e a divisão é **autorização, não domínio de valor**.
 */
export const MOTIVOS_DE_CANCELAMENTO = [
  "desistencia",
  "resolvido_por_conta_propria",
  "aberta_por_engano",
  "duplicada",
  "improcedente",
  "fora_de_escopo",
  "sem_informacao_suficiente",
] as const;

export type MotivoCancelamento = (typeof MOTIVOS_DE_CANCELAMENTO)[number];
