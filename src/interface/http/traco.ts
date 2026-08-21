import { randomBytes } from "node:crypto";

/**
 * O `traceId` do corpo de erro (contrato §6.1): *"o identificador que liga a resposta à linha de log do
 * servidor"*. É ele que compensa a decisão da §6.3 — o `404` que não distingue *"não existe"* de *"é de
 * outra organização"* mantém a distinção **no log**.
 *
 * Formato do exemplo do contrato: base32 de Crockford, ordenável no tempo. É um ULID sem dependência —
 * 48 bits de milissegundo, 80 bits de aleatoriedade, 26 caracteres.
 */
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function novoTraceId(): string {
  const agora = Date.now();
  let saida = "";

  for (let i = 9; i >= 0; i -= 1) {
    saida += ALFABETO[Math.floor(agora / 32 ** i) % 32] ?? "0";
  }

  const aleatorio = randomBytes(10);
  let acumulado = 0n;
  for (const octeto of aleatorio) acumulado = (acumulado << 8n) | BigInt(octeto);
  for (let i = 15; i >= 0; i -= 1) {
    saida += ALFABETO[Number((acumulado >> BigInt(5 * i)) & 31n)] ?? "0";
  }

  return saida;
}
