/**
 * ============================================================================
 *  A tela atual na barra lateral — item 44h, critério 1
 * ============================================================================
 *
 * **A regra, em uma frase:** o item marcado é o de destino mais longo que seja o caminho atual ou um
 * prefixo dele por segmento inteiro; se nenhum for, nada é marcado.
 *
 * - *Por segmento inteiro:* `/ocorrencias` alcança `/ocorrencias/abc` e não alcança `/ocorrenciasx`.
 * - *Mais longo:* em `/configuracao/categorias/nova`, `/configuracao` e `/configuracao/categorias`
 *   alcançam, e ganha o segundo.
 *
 * **A disputa corre sobre a lista inteira, e não só sobre os itens que o papel vê.** Correndo só sobre os
 * visíveis, quem visse *Configuração* e não visse *Categorias* ganharia a marca errada em
 * `/configuracao/categorias`. Com a lista inteira, ganha *Categorias*, que não está desenhado, e nada se
 * marca. Nenhum papel de hoje produz o caso; a regra é a que continua certa quando um papel novo
 * aparecer.
 *
 * **Uma fonte só para o que se desenha e para o que se compara.** `casca/navegacao.tsx` desenha cada item
 * com um `DestinoDaBarra`, então nenhum item existe fora desta lista, e a guarda de
 * `testes/interface/casca.test.ts` confere o outro sentido: toda entrada daqui é desenhada, uma vez.
 *
 * **A barra final é aceita**, embora o Next já a remova do caminho: o teste é mais barato que a dúvida.
 */
export const DESTINOS_DA_BARRA = [
  "/ocorrencias",
  "/configuracao",
  "/vinculos",
  "/configuracao/categorias",
  "/configuracao/areas",
  "/dashboard",
] as const;

export type DestinoDaBarra = (typeof DESTINOS_DA_BARRA)[number];

function alcanca(destino: DestinoDaBarra, caminho: string): boolean {
  return caminho === destino || caminho.startsWith(`${destino}/`);
}

export function destinoAtual(caminho: string): DestinoDaBarra | null {
  const semBarraFinal = caminho.length > 1 ? caminho.replace(/\/+$/u, "") : caminho;

  let vencedor: DestinoDaBarra | null = null;
  for (const destino of DESTINOS_DA_BARRA) {
    if (!alcanca(destino, semBarraFinal)) continue;
    if (vencedor === null || destino.length > vencedor.length) vencedor = destino;
  }
  return vencedor;
}

/** O item de `destino` é o marcado em `caminho`. É o que a barra pergunta, item por item. */
export function estaMarcado(destino: DestinoDaBarra, caminho: string): boolean {
  return destinoAtual(caminho) === destino;
}
