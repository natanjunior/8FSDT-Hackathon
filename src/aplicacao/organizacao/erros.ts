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

/**
 * `404 PEDIDO_NAO_ENCONTRADO` — não há pedido com aquele identificador **nesta** organização.
 *
 * **Pedido de outra organização responde exatamente isto** (contrato §6.3): a resposta não distingue
 * *"não existe"* de *"não é seu"*, porque distinguir transformaria o endpoint num verificador de
 * existência de pedidos alheios.
 */
export class PedidoNaoEncontrado extends ErroDeDominio {
  constructor() {
    super("PEDIDO_NAO_ENCONTRADO", "Pedido não encontrado", "Este pedido de entrada não existe.");
  }
}

/**
 * `409 PEDIDO_JA_DECIDIDO` — outro Gestor chegou primeiro.
 *
 * **É tradução do `update … where situacao = 'pendente'` devolvendo zero linhas**, não de uma leitura
 * prévia — que perderia exatamente a corrida que este erro existe para cobrir. O texto de tela é do
 * inventário §7: *"Este pedido já foi decidido por outro Gestor."*
 */
export class PedidoJaDecidido extends ErroDeDominio {
  constructor() {
    super("PEDIDO_JA_DECIDIDO", "Pedido já decidido", "Este pedido já foi decidido por outro Gestor.");
  }
}

/**
 * `422 AREA_INVALIDA` — a Área informada não é desta organização, ou está inativa.
 *
 * **A mesma resposta para os dois casos** (contrato §6.3). Um deles o banco recusa sozinho — a FK composta
 * `(area_id, organizacao_id)` —, o outro nenhuma constraint alcança.
 */
export class AreaInvalida extends ErroDeDominio {
  constructor() {
    super("AREA_INVALIDA", "Área inválida", "Esta área não existe nesta organização ou está desativada.");
  }
}

/**
 * `404 VINCULO_NAO_ENCONTRADO` — não há vínculo com esta Pessoa **nesta** organização.
 *
 * **A resposta é a mesma quando a Pessoa não existe, quando o vínculo é de outra organização e quando ele
 * foi revogado** (contrato §6.3). Um `403` aqui confirmaria que aquele identificador existe em algum
 * lugar, e isso é vazamento pelo código de status.
 */
export class VinculoNaoEncontrado extends ErroDeDominio {
  constructor() {
    super(
      "VINCULO_NAO_ENCONTRADO",
      "Vínculo não encontrado",
      "Não há vínculo com esta pessoa nesta organização.",
    );
  }
}

/**
 * `409 PESSOA_COM_CONTA_NAO_EDITAVEL` — o cadastro de quem tem conta vale em **todas** as organizações.
 *
 * **A guarda nomeia campos, não o endpoint** (contrato §8.2, precisão de 22/08/2026): `nome` é da
 * `Pessoa`, que é global; `areaId` é do `Vínculo`, que é escopado, e continua editável.
 */
export class PessoaComContaNaoEditavel extends ErroDeDominio {
  constructor() {
    super(
      "PESSOA_COM_CONTA_NAO_EDITAVEL",
      "Esta pessoa tem conta",
      "Quem tem conta edita os próprios dados; o cadastro vale em outras organizações.",
    );
  }
}

/**
 * `409 CONTATO_DUPLICADO` — o mesmo par (`tipo`, `valor`) repetido na mesma Pessoa.
 *
 * **É tradução da `contatos_par_uk`** (modelo §6.17), não de checagem prévia — a mesma doutrina de
 * `PedidoDeEntradaPendente`. E como a escrita é **substituição**, o estado final é a lista enviada: um par
 * repetido só pode vir de dentro do próprio corpo, e é por isso que a tela consegue vê-lo antes de enviar.
 * **Este erro é a rede, não o caminho.**
 *
 * O texto é o da §6.2 do `prototipo-low-fi.md`, e ele aparece **no campo do contato repetido**.
 */
export class ContatoDuplicado extends ErroDeDominio {
  constructor() {
    super("CONTATO_DUPLICADO", "Contato repetido", "Este contato já está na lista.");
  }
}
