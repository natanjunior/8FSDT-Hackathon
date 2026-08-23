/**
 * Comum ou privativa — o tipo `tipo_area` do banco (modelo §5).
 *
 * **Deriva a visibilidade da ocorrência** (D10), conforme o tipo **vigente no momento do registro** e não
 * o atual: cada ocorrência guarda uma cópia congelada em `areaTipo`. Reclassificar uma Área muda o que
 * acontece daqui para a frente e não mexe no passado — é o que torna a operação segura de oferecer.
 */
export const TIPOS_DE_AREA = ["comum", "privativa"] as const;

export type TipoArea = (typeof TIPOS_DE_AREA)[number];

export function ehTipoDeArea(valor: unknown): valor is TipoArea {
  return typeof valor === "string" && (TIPOS_DE_AREA as readonly string[]).includes(valor);
}
