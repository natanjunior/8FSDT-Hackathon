/**
 * ============================================================================
 *  As abas de T-15 — item 120, blocos 7 e 8
 * ============================================================================
 *
 * **A ordem e os nomes são do dono**, em 03/10/2026. A primeira vem selecionada. **O endereço diz qual
 * está aberta** (critério 16): compartilhar a configuração não manda todo mundo para a primeira.
 *
 * Mora fora do componente para ter teste: o produto não tem teste de componente React.
 */
export type AbaDaConfiguracao = "ocorrencias" | "participantes" | "historico";

export const ABAS_DA_CONFIGURACAO: readonly { valor: AbaDaConfiguracao; rotulo: string }[] = [
  { valor: "ocorrencias", rotulo: "Configurações de ocorrências" },
  { valor: "participantes", rotulo: "Configurações de participantes" },
  { valor: "historico", rotulo: "Histórico" },
];

/** **Ausente, desconhecida ou fora do alcance de quem lê vale a primeira** — nunca uma aba vazia. */
export function lerAba(
  valor: string | string[] | undefined,
  disponiveis: readonly AbaDaConfiguracao[],
): AbaDaConfiguracao {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  const achada = disponiveis.find((aba) => aba === bruto);
  return achada ?? disponiveis[0] ?? "ocorrencias";
}

/** A primeira não escreve parâmetro: o endereço limpo é o da aba padrão. */
export function consultaDaAba(aba: AbaDaConfiguracao): string {
  return aba === "ocorrencias" ? "" : `?aba=${aba}`;
}
