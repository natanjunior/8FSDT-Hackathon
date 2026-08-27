/**
 * Em que pé está um `Pedido de entrada` (glossário; modelo §6.15).
 *
 * Os valores são a grafia do tipo `situacao_pedido_entrada` do banco. **As três são o ciclo inteiro do
 * pedido, e nenhuma delas é um vínculo** — a D25 é literal: *"o Vínculo só passa a existir com aprovação
 * do Gestor"*.
 *
 * O guarda existe pela mesma razão de `ehPapel` e `ehTipoDeArea`: o valor vem do banco, e um enum que
 * divergiu do código é migração aplicada sem código. **Falha alto, não em silêncio.**
 */
export const SITUACOES_DO_PEDIDO = ["pendente", "aprovado", "recusado"] as const;

export type SituacaoDoPedido = (typeof SITUACOES_DO_PEDIDO)[number];

export function ehSituacaoDoPedido(valor: unknown): valor is SituacaoDoPedido {
  return typeof valor === "string" && (SITUACOES_DO_PEDIDO as readonly string[]).includes(valor);
}
