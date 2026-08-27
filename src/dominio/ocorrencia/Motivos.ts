/**
 * Os motivos estruturados de `pausar` e `cancelar` — a invariante 5 (D8, D12, D23).
 *
 * **Nenhum dos dois é exercido nesta fatia**, e os tipos entram porque o registro de transição os carrega
 * como campos e a projeção tem de emiti-los (nulos). Os comandos que os produzem são os itens 18 e 23.
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
