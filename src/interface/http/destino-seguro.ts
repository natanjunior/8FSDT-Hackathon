/**
 * **O `?destino=` que pode ser seguido** — `/entrar` e `/criar-conta` (item 86).
 *
 * Até o item 86 a guarda era `startsWith("/")`, escrita duas vezes, e ela deixava passar `//site` e
 * `/\site`, que o navegador lê como endereço de outra origem. Agora ela é uma só, e recusa também o
 * caractere de controle: o navegador apaga tabulação e quebra de linha de uma URL, e `/\t/site` vira
 * `//site` depois da limpeza.
 */
export function destinoSeguro(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/")) return null;
  if (/[\u0000-\u001f\u007f]/u.test(valor)) return null;
  const segundo = valor[1];
  if (segundo === "/" || segundo === "\\") return null;
  return valor;
}
