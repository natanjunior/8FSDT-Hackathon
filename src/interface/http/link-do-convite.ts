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

/**
 * **O link do QR de uma área** (item 111): a página do convite, e não o `/?e=` curto. Ninguém digita o
 * QR da área, e ir direto à página economiza o salto do despachante.
 */
export function linkDoQrDaArea(origem: string, codigo: string, areaId: string): string {
  return `${origem}/convite/${encodeURIComponent(codigo)}?area=${encodeURIComponent(areaId)}`;
}

/**
 * **O link do convite pessoal** (item 121). Endereço longo de propósito: ele não vai para cartaz, vai para
 * uma pessoa. É o lugar único onde o endereço se monta, e o modal e o e-mail do item 122 o usam.
 */
export function linkDoConvitePessoal(origem: string, token: string): string {
  return `${origem}/convite-pessoal/${token}`;
}

/** O link pessoal, com a origem deste pedido: atrás do proxy do Azure, é o `x-forwarded-host`. */
export async function montarLinkDoConvitePessoal(token: string): Promise<string> {
  return linkDoConvitePessoal(origemDoPedido(await headers()), token);
}

/** O link do QR da área, com a origem deste pedido, na forma de `montarLinkDoConvite`. */
export async function montarLinkDoQrDaArea(codigo: string, areaId: string): Promise<string> {
  return linkDoQrDaArea(origemDoPedido(await headers()), codigo, areaId);
}