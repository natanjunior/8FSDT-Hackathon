/**
 * **Onde o VLibras aparece** (item 85, ADR-0017): em toda tela do produto, e nunca na documentação, que
 * tem casca própria (ADR-0009). Arquivo sem diretiva para o teste alcançar sem carregar o Next.
 */
export function vlibrasNaRota(caminho: string): boolean {
  return !(caminho === "/documentacao" || caminho.startsWith("/documentacao/"));
}
