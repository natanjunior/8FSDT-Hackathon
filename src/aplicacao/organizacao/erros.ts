/**
 * O `codigoPublico` sorteado já pertence a outra organização.
 *
 * **Não estende `ErroDeDominio`, e a diferença é o que ela significa:** o catálogo da §6.4 do contrato é a
 * lista de recusas que **chegam ao cliente**, e esta nunca chega — a Aplicação a captura e sorteia de
 * novo. Dar-lhe um código estável seria publicar no contrato um evento interno de colisão de sorteio.
 *
 * Se ela escapar — todas as tentativas colidiram —, cai na tradução genérica e vira `500 ERRO_INTERNO`,
 * que é a resposta certa: com 32⁸ códigos, isso não é colisão, é o banco em outro estado.
 */
export class CodigoPublicoEmUso extends Error {
  constructor(readonly codigoPublico: string) {
    super(`O código público sorteado já está em uso: ${codigoPublico}`);
    this.name = "CodigoPublicoEmUso";
  }
}
