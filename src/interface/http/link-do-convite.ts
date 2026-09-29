import { headers } from "next/headers";

import { origemDoPedido } from "./confirmacao-de-conta";

/**
 * ============================================================================
 *  O link do convite — `/?e=CODIGO` (item 86)
 * ============================================================================
 *
 * **O link é curto de propósito**: ele vai para um QR e para um cartaz. A página tem endereço próprio,
 * `/convite/{codigo}`, e é para ela que o despachante manda. É o endereço estável que o `?destino=` precisa
 * para voltar depois de entrar.
 */

/**
 * O destino do `?e=`, ou `null` quando não há convite no endereço.
 *
 * **Não valida formato nem consulta nada**: quem decide se o código leva a algum lugar é a página. Aqui só
 * se normaliza, como as oito casas de T-02 normalizam o que se digita, e se codifica, para que o valor não
 * saia do segmento.
 */
export function destinoDoConvite(
  parametros: Record<string, string | string[] | undefined>,
): string | null {
  const bruto = parametros.e;
  const primeiro = Array.isArray(bruto) ? bruto[0] : bruto;
  const codigo = primeiro?.trim().toUpperCase() ?? "";
  return codigo === "" ? null : `/convite/${encodeURIComponent(codigo)}`;
}

/** O link que o Gestor copia e que o QR carrega. */
export function linkDoConvite(origem: string, codigo: string): string {
  return `${origem}/?e=${encodeURIComponent(codigo)}`;
}

/**
 * O link, com a origem deste pedido — a mesma que o item 6c usa para o link de confirmação
 * (`origemDoPedido`). Atrás do proxy do Azure, é o `x-forwarded-host`.
 */
export async function montarLinkDoConvite(codigo: string): Promise<string> {
  return linkDoConvite(origemDoPedido(await headers()), codigo);
}
