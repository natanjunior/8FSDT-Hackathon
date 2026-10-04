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

/**
 * `409 CONVITE_INDISPONIVEL` — este participante não recebe convite pessoal (item 121). A tela esconde o
 * botão; a API recusa o mesmo.
 */
export class ConviteIndisponivel extends ErroDeDominio {
  constructor(motivo: "encarregado" | "ja-tem-conta") {
    super(
      "CONVITE_INDISPONIVEL",
      "Convite indisponível",
      motivo === "encarregado" ? "Encarregados não usam o aplicativo." : "Esta pessoa já usa o aplicativo.",
    );
  }
}

/** `404 CONVITE_PESSOAL_NAO_VALE` — o convite não leva a lugar nenhum. Não diz por quê (item 121). */
export class ConvitePessoalNaoVale extends ErroDeDominio {
  constructor() {
    super("CONVITE_PESSOAL_NAO_VALE", "Convite não vale", "Este convite não vale mais.");
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
 * `404 ETIQUETA_NAO_ENCONTRADA` — a etiqueta não existe **nesta** organização (item 115). Etiqueta de outra
 * organização responde igual, pela §6.3: o `where organizacao_id = $1` já a tirou da consulta.
 */
export class EtiquetaNaoEncontrada extends ErroDeDominio {
  constructor() {
    super("ETIQUETA_NAO_ENCONTRADA", "Etiqueta não encontrada", "Esta etiqueta não existe mais.");
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

/**
 * `404 CATEGORIA_NAO_ENCONTRADA` — e **a resposta é idêntica** para categoria inexistente e para
 * categoria de outra organização (contrato §6.3). Não é discrição: distinguir transformaria o endpoint
 * num verificador de existência entre condomínios.
 */
export class CategoriaNaoEncontrada extends ErroDeDominio {
  constructor() {
    super(
      "CATEGORIA_NAO_ENCONTRADA",
      "Categoria não encontrada",
      "Esta categoria não existe nesta organização.",
    );
  }
}

/**
 * `409 CATEGORIA_NOME_DUPLICADO` — `UNIQUE (organizacao_id, nome)`.
 *
 * **Não é capricho:** duas categorias com o mesmo nome quebrariam o indicador de recorrência, que é o
 * número mais importante do dashboard (D19).
 */
export class NomeDeCategoriaDuplicado extends ErroDeDominio {
  constructor() {
    super("CATEGORIA_NOME_DUPLICADO", "Nome já usado", "Já existe uma categoria com este nome.");
  }
}

/** `404 AREA_NAO_ENCONTRADA` — mesma doutrina da categoria (contrato §6.3). */
export class AreaNaoEncontrada extends ErroDeDominio {
  constructor() {
    super("AREA_NAO_ENCONTRADA", "Área não encontrada", "Esta área não existe nesta organização.");
  }
}

/** `409 AREA_NOME_DUPLICADO` — `UNIQUE (organizacao_id, nome)`, pela mesma razão da categoria. */
export class NomeDeAreaDuplicado extends ErroDeDominio {
  constructor() {
    super("AREA_NOME_DUPLICADO", "Nome já usado", "Já existe uma área com este nome.");
  }
}

/**
 * `409 LISTA_DESATUALIZADA` — o conjunto de `ids` de uma reordenação não é o conjunto atual da lista
 * (item 50, spec §4.1).
 *
 * **A mesma resposta para os quatro casos**: faltando item, sobrando item, id de outra organização e id
 * inexistente. O repositório escopado não enxerga outra organização (ADR-0003), então os dois últimos são
 * o mesmo fato para ele, e a doutrina do `404` idêntico (contrato §6.3) continua de pé dentro do `409`.
 *
 * **`409` e não `400`:** o caso comum é outro Gestor ter criado um item entre a leitura e a escrita. O
 * pedido estava certo quando foi montado; o que mudou foi o estado. O `detail` é a frase que o toast do
 * 44k mostra, e o cliente recarrega a lista ao ver o código.
 */
export class ListaDesatualizada extends ErroDeDominio {
  constructor() {
    super("LISTA_DESATUALIZADA", "Lista desatualizada", "A lista mudou desde que você a abriu.");
  }
}

/**
 * `409 VINCULO_COM_HISTORICO` — o vínculo tem linha dependente, e o histórico não se apaga.
 *
 * **É tradução do `ON DELETE RESTRICT`**, não de checagem prévia — a mesma doutrina de
 * `PedidoDeEntradaPendente` e de `ContatoDuplicado`. São **nove** as tabelas que apontam para
 * `vinculos (pessoa_id, organizacao_id)`, e a recusa é do banco em todas.
 *
 * **O texto é cópia literal do exemplo `comHistorico` do `DELETE /vinculos/{pessoaId}` no
 * `openapi.yaml`**, e os dois mudaram juntos no item 84: a segunda frase passou a apontar o caminho que
 * existe (`POST /vinculos/{pessoaId}/revogar`), e a primeira deixou de nomear um só dos nove rastros —
 * o achado A-1 do item 10, que esperava exatamente um commit que tocasse os dois arquivos.
 *
 * **A tela nunca mostra este `detail`**: quem tem rastro recebe a confirmação de encerrar o acesso, e a
 * linha de recusa usa a frase de `frases-da-remocao.ts`.
 */
export class VinculoComHistorico extends ErroDeDominio {
  constructor() {
    super(
      "VINCULO_COM_HISTORICO",
      "Este vínculo já tem histórico",
      "A pessoa já deixou rastro nesta organização, e o vínculo não pode ser apagado. Para encerrar o acesso dela, revogue o vínculo.",
    );
  }
}

/**
 * `409 ULTIMO_GESTOR` — **a única regra deste endpoint que o banco não garante** (contrato §8.2).
 *
 * Sem ela o `DELETE` abriria um caminho **novo** para o **PA-24**: numa organização recém-criada o Gestor
 * inicial não tem histórico e poderia remover a si mesmo, deixando a organização sem ninguém que possa
 * aprovar entrada nenhuma.
 *
 * **Vem antes do `VINCULO_COM_HISTORICO`, e a ordem não é gosto** (spec §3.2): o Gestor inicial **tem**
 * dependente — `organizacoes.criada_por_pessoa_id` aponta para o vínculo dele desde a POL-01 —, então
 * traduzir a recusa do banco primeiro faria o critério 10.3 ler falso no cenário que ele nomeia. Por isso
 * a guarda mora no `where` do próprio `delete`.
 *
 * Texto literal de `openapi.yaml:726-729`.
 */
export class UltimoGestor extends ErroDeDominio {
  constructor() {
    super(
      "ULTIMO_GESTOR",
      "Esta organização ficaria sem Gestor",
      "Aprove outra pessoa como Gestor antes de remover este vínculo.",
    );
  }
}
