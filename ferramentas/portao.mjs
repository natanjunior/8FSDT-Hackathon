/**
 * A última etapa do `npm run verificar` (item 95).
 *
 * Ela não confere nada. Chegar até aqui prova que lint, tipos, teste, docs e estilo fecharam, porque a
 * corrente do `verificar` é `&&` e cada elo só roda se o anterior saiu zero. A prova de que o portão
 * rodou é esta linha na saída, e não o código de saída de quem chamou: um `| tail` sem `pipefail`
 * devolve zero mesmo quando o npm devolveu um.
 *
 * O texto é único no código executável do repositório, e `testes/interface/formulario.test.ts` prende
 * isso, junto com a posição desta etapa no fim da corrente.
 */
console.log("✓ Portão verde · lint, tipos, teste, docs e estilo rodaram até o fim");
