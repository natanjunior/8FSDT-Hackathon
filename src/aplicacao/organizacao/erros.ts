import { ErroDeDominio } from "@/dominio/erros";

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

/**
 * `404 CODIGO_PUBLICO_NAO_ENCONTRADO` — nenhuma organização usa aquele código.
 *
 * O texto de tela é do inventário §7 e diz o que a pessoa pode fazer: *"Confira as letras e os números."*
 * O código vem de um cartaz de elevador, digitado à mão, e errar é o caso comum.
 */
export class CodigoPublicoNaoEncontrado extends ErroDeDominio {
  constructor() {
    super(
      "CODIGO_PUBLICO_NAO_ENCONTRADO",
      "Código não encontrado",
      "Nenhuma organização usa este código.",
    );
  }
}

/** `409 JA_VINCULADO` — a Pessoa já tem vínculo ativo naquela organização. */
export class JaVinculado extends ErroDeDominio {
  constructor() {
    super(
      "JA_VINCULADO",
      "Você já está nesta organização",
      "Você já tem vínculo ativo nesta organização.",
    );
  }
}

/**
 * `409 PEDIDO_DE_ENTRADA_PENDENTE` — já há pedido pendente daquela Pessoa naquela organização.
 *
 * **É tradução do índice único parcial** `pedidos_de_entrada_pendente_uk` (modelo §6.15), não de uma
 * checagem prévia — que perderia a corrida entre dois envios do mesmo formulário.
 */
export class PedidoDeEntradaPendente extends ErroDeDominio {
  constructor() {
    super(
      "PEDIDO_DE_ENTRADA_PENDENTE",
      "Pedido já enviado",
      "Seu pedido já foi enviado e está aguardando a decisão de um Gestor.",
    );
  }
}
