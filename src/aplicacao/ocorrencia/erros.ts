import { AreaInvalida } from "@/aplicacao/organizacao";
import { ErroDeDominio } from "@/dominio/erros";
import {
  AvaliacaoExigeResolvida,
  JaAvaliada,
  PrioridadeImutavelEmEstadoTerminal,
  TransicaoNaoPermitida,
  type Comando,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";

/** Reexportadas, nao redefinidas — ver as notas abaixo. */
export {
  AreaInvalida,
  AvaliacaoExigeResolvida,
  JaAvaliada,
  PrioridadeImutavelEmEstadoTerminal,
  TransicaoNaoPermitida,
};

/**
 * `422 CATEGORIA_INVALIDA` — inexistente **nesta** organização **ou** desativada.
 *
 * **A mesma resposta para os dois casos**, e é a §6.3 do contrato: confirmar que a categoria existe mas
 * está em outra organização é exatamente o vazamento que o `404` genérico existe para impedir.
 */
export class CategoriaInvalida extends ErroDeDominio {
  constructor() {
    super(
      "CATEGORIA_INVALIDA",
      "Categoria inválida",
      "Esta categoria não existe nesta organização ou não está mais ativa.",
    );
  }
}

/**
 * **`AreaInvalida` NAO nasce aqui — ela ja existe**, em `src/aplicacao/organizacao/erros.ts`, com o mesmo
 * codigo `AREA_INVALIDA` e o mesmo argumento (*"a mesma resposta para os dois casos"*, contrato §6.3).
 * Foi escrita pelo item 9a, para o `areaId` do cadastro de vinculo.
 *
 * **Reescreve-la aqui criaria duas classes com o mesmo codigo de contrato e textos divergentes** — e e o
 * `codigo` que o cliente compara. Este modulo a **reexporta** (a linha do topo deste arquivo), e o
 * `index.ts` a repassa.
 *
 * O lint permite: `@/aplicacao/organizacao` e superficie publica de modulo irmao da mesma camada, e nao
 * cria ciclo — `aplicacao/organizacao` nao importa `aplicacao/ocorrencia`.
 */

/**
 * **`TransicaoNaoPermitida` também não nasce aqui**, e por outro motivo: ela é do **Domínio**
 * (`src/dominio/ocorrencia/erros.ts`), porque é recusa da máquina de estados — não erro transversal.
 * Redefini-la aqui criaria duas classes com o mesmo `codigo` de contrato e textos divergentes, e é o
 * `codigo` que o cliente compara. Este módulo a reexporta e o `index.ts` a repassa: mesmo caminho de
 * `AreaInvalida`, na direção oposta.
 *
 * **E `PrioridadeImutavelEmEstadoTerminal` chega pelo mesmo caminho, no item 17.** Ela é a **segunda**
 * recusa da máquina de estados, e a primeira do produto que não é `TRANSICAO_NAO_PERMITIDA`: a invariante 7
 * é normatizada pela tabela companheira, que mora no Domínio. **Não é o caso de `ResponsavelNaoAtribuido`**,
 * logo abaixo, que nasceu aqui porque a invariante 9 atravessa outra tabela.
 *
 * **E `AvaliacaoExigeResolvida` e `JaAvaliada` chegam pelo mesmo caminho, no item 27.** São a terceira e
 * a quarta recusas da máquina de estados, e as duas metades da **invariante 8** — que a
 * `arquitetura.md:495` nomeia, em letra, como do **Domínio**. **Não é o caso de
 * `SomenteOAutorPodeAvaliar`**, logo abaixo, que nasce aqui porque depende de quem chamou.
 */

/**
 * `404 OCORRENCIA_NAO_ENCONTRADA` — **não existe nesta organização OU não é visível a quem pediu**.
 *
 * As duas causas dão a mesma resposta, de propósito (§6.3): *"não confirmar a existência do que você não
 * pode alcançar"*. É a mesma escolha que T-05 faz ao não mostrar ação indisponível.
 */
export class OcorrenciaNaoEncontrada extends ErroDeDominio {
  constructor() {
    super(
      "OCORRENCIA_NAO_ENCONTRADA",
      "Ocorrência não encontrada",
      "Não há ocorrência com este identificador nesta organização.",
    );
  }
}

/**
 * `422 RESPONSAVEL_SEM_VINCULO_ATIVO` — a pessoa indicada **não tem vínculo ativo nesta organização**.
 *
 * **Três casos, uma resposta**, e é a §6.3: nunca teve vínculo · teve e foi revogado · tem vínculo em
 * **outra** organização. Separar o terceiro dos dois primeiros confirmaria que a pessoa existe em algum
 * lugar do sistema — que é exatamente o vazamento que o `404` genérico existe para impedir.
 *
 * **O texto é o do `openapi.yaml`**, literal: o `detail` é contrato publicado, não frase nova.
 */
export class ResponsavelSemVinculoAtivo extends ErroDeDominio {
  constructor() {
    super(
      "RESPONSAVEL_SEM_VINCULO_ATIVO",
      "Pessoa sem vínculo ativo",
      "Só é possível atribuir a quem tem vínculo ativo nesta organização.",
    );
  }
}

/**
 * `409 RESPONSAVEL_NAO_ATRIBUIDO` — a **invariante 9** recusando (critério 22.2).
 *
 * **Nasce aqui e não no Domínio, ao contrário de `TransicaoNaoPermitida`.** Aquela mora em
 * `dominio/ocorrencia/erros.ts` *"porque é recusa da máquina de estados"*. **Esta não é**: é a recusa da
 * invariante que a `arquitetura.md` §4 classifica como *do comando de aplicação*, *"porque atravessa
 * outra tabela no momento em que o comando roda"*. O lugar dela é ao lado de `ResponsavelSemVinculoAtivo`,
 * que nasceu aqui pela mesma razão, no item 19.
 *
 * **É a única recusa do produto que não olha `status`** — e mesmo assim carrega `statusAtual`, porque a
 * tela que monta a frase precisa dele tanto quanto no outro `409`.
 *
 * **Os textos são os do `openapi.yaml:1782-1784`, literais**: `detail` publicado é contrato, não frase
 * nova. E o `codigo` **já está mapeado para 409** em `problema.ts` — nada muda lá.
 */
export class ResponsavelNaoAtribuido extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "RESPONSAVEL_NAO_ATRIBUIDO",
      "Ninguém atribuído",
      "Atribua um responsável antes de iniciar o atendimento.",
      { statusAtual, acoesDisponiveis },
    );
  }
}

/**
 * `403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO` — o critério **18.3**, e a **primeira recusa do produto
 * que depende de quem chamou E do estado ao mesmo tempo**.
 *
 * **Nasce aqui e não no Domínio**, ao lado de `ResponsavelSemVinculoAtivo` e `ResponsavelNaoAtribuido`,
 * e pela mesma razão que as duas: **ela atravessa a identidade de quem chama**. `TransicaoNaoPermitida`
 * e `PrioridadeImutavelEmEstadoTerminal` moram no Domínio porque são recusa da máquina de estados — a
 * mesma resposta para todo mundo; esta muda de resposta conforme as permissões, e o agregado não sabe
 * quem chamou (nem deve: é o que o mantém testável sem contexto de requisição).
 *
 * **`cancelar` é o único comando do produto em que duas pessoas diferentes chamam o mesmo endpoint com
 * regras diferentes**, e este erro é a metade *"de estado"* da diferença. A outra metade é
 * `MotivoNaoPermitidoParaOPapel`, logo abaixo.
 *
 * **Os textos são os do `openapi.yaml:2011-2013`, literais** — `detail` publicado é contrato, não frase
 * nova, como as três classes anteriores fizeram. E o `codigo` **já está mapeado para 403** em
 * `problema.ts:28`: nada nasce lá.
 *
 * **Carrega `statusAtual` e `acoesDisponiveis`, como `ResponsavelNaoAtribuido`**, porque é recusa sobre
 * o **recurso**: quem levou este `403` precisa saber o que ainda lhe resta — e, para o Solicitante autor
 * em `em_atendimento`, resta `[]`.
 */
export class SomenteOGestorCancelaNesteEstado extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO",
      "Só o Gestor cancela agora",
      "O atendimento já começou. Peça o cancelamento pelo comentário.",
      { statusAtual, acoesDisponiveis },
    );
  }
}

/**
 * `422 MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL` — o critério **18.4**, e a metade *"de valor"* da diferença
 * entre os dois papéis que chamam `/cancelar`.
 *
 * **O conjunto de motivos é do Domínio** (`motivosPermitidos`, em `Motivos.ts`); **a recusa é daqui**,
 * porque é aqui que a identidade de quem chama existe. É a mesma repartição de `PERMISSAO_DO_COMANDO`:
 * o mapa é do Domínio, a recusa é da Aplicação.
 *
 * **As extensões são diferentes das da irmã, e de propósito:** esta carrega **só** `erros[]`, porque é
 * recusa de **valor de campo** — como `CampoNaoSuportado` faz. Pôr `acoesDisponiveis` aqui diria que o
 * problema é o estado, quando o estado está certo e o que está errado é o valor enviado: quem levou
 * este `422` conserta reescrevendo o corpo, e não é verdade do `403`.
 *
 * **O `detail` é texto novo, e não literal do YAML**, e a diferença é declarada: a `description` do
 * `422` publicado cita os **dois** casos e traz `example` de **um** só — o do campo não suportado —, sem
 * `detail` para este. É a metade de código do achado **A-6**, e ela **não espera o documento**: o
 * `Problema` exige `detail`, e um erro sem frase chegaria à tela como texto vazio. O conserto do YAML
 * está na fila de documentação.
 *
 * **O `codigo` já está mapeado para 422** em `problema.ts:60`: nada nasce lá.
 */
export class MotivoNaoPermitidoParaOPapel extends ErroDeDominio {
  constructor() {
    super(
      "MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL",
      "Motivo não disponível",
      "Este motivo não está disponível para você.",
      { erros: [{ campo: "motivo", codigo: "MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL" }] },
    );
  }
}

/**
 * `422 SOLUCAO_OBRIGATORIA` — a invariante 10 com a regra ligada (item 99, resposta P3).
 *
 * **`422`, e não `409`:** o que falta está no corpo, não no recurso — o mesmo pedido com a solução passa
 * sem ninguém mexer na ocorrência. Um `409` listaria `resolver` em `acoesDisponiveis` no corpo que o
 * recusa. O precedente é o `MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL`, logo acima: valor do corpo recusado por um
 * fato de contexto.
 */
export class SolucaoObrigatoria extends ErroDeDominio {
  constructor() {
    super(
      "SOLUCAO_OBRIGATORIA",
      "Solução obrigatória",
      "Esta organização exige a solução aplicada para resolver.",
      { erros: [{ campo: "solucaoAplicada", codigo: "SOLUCAO_OBRIGATORIA" }] },
    );
  }
}

/**
 * `403 SOMENTE_O_AUTOR_PODE_AVALIAR` — o critério **27.3**, e a **segunda** recusa do produto que
 * depende de quem chamou.
 *
 * **Nasce aqui e não no Domínio**, ao lado de `SomenteOGestorCancelaNesteEstado`, e pela mesma razão que
 * ela: **atravessa a identidade de quem chama**. As duas irmãs de `409` moram no Domínio porque são
 * recusa da máquina de estados — a mesma resposta para todo mundo; esta muda de resposta conforme quem
 * pergunta.
 *
 * **E a tabela do Domínio confirma pela ausência:** a `arquitetura.md:495` nomeia
 * `AVALIACAO_EXIGE_RESOLVIDA` e `JA_AVALIADA` como do Domínio, e **não nomeia esta**. O
 * `contrato-de-api.md:435-438` a classifica do outro lado: *"relação com o recurso … responde `403` com
 * código próprio (`SOMENTE_O_AUTOR_PODE_AVALIAR`)"*.
 *
 * > **`avaliar` é o primeiro endpoint do produto em que as DUAS camadas de `403` são observáveis.** O
 * > Encarregado leva `PERMISSAO_INSUFICIENTE` no `comContexto`, antes de o recurso ser lido; o Gestor
 * > não-autor leva **este**, depois de ler. É a §4.5 do contrato ganhando um caso.
 *
 * **`titulo` é o do `openapi.yaml:2072`, literal. O `detalhe` é TEXTO NOVO** — achado **A-2** da spec,
 * pelo mesmo argumento das duas irmãs.
 *
 * **Carrega `statusAtual` e `acoesDisponiveis`**, como `SomenteOGestorCancelaNesteEstado`: quem levou
 * este `403` precisa saber o que ainda lhe resta — e, para o Gestor não-autor em `resolvida`, resta `[]`.
 *
 * **O `codigo` já está mapeado para 403** em `problema.ts:27`: nada nasce lá.
 */
export class SomenteOAutorPodeAvaliar extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "SOMENTE_O_AUTOR_PODE_AVALIAR",
      "Só quem registrou pode avaliar",
      "Só quem registrou a ocorrência pode avaliar a resolução.",
      { statusAtual, acoesDisponiveis },
    );
  }
}

/**
 * `403` a quem recebeu a ocorrência compartilhada e tentou agir sobre ela (item 87).
 *
 * **O `codigo` é `PERMISSAO_INSUFICIENTE`, de propósito, e é a segunda classe com ele.** O openapi
 * descreve esse código como *"ou a operação depende de uma relação com o recurso que o chamador não
 * tem"* (`SemPermissao`), que é exatamente este caso; um código novo obrigaria todo cliente a aprender
 * uma palavra para a mesma decisão. **O que muda é o texto**, porque *"o seu papel não permite"* seria
 * falso: o papel dela permite comentar, cancelar a própria e avaliar — só não nesta ocorrência.
 */
export class SoParaLeitura extends ErroDeDominio {
  constructor() {
    super(
      "PERMISSAO_INSUFICIENTE",
      "Sem permissão",
      "Esta ocorrência foi compartilhada com você só para leitura.",
    );
  }
}

/**
 * `403` a quem tenta desfazer o compartilhamento que outra pessoa fez, sem `ler_todas` (item 87).
 *
 * O mesmo código da `SoParaLeitura`, pela mesma razão; o texto diz o que é verdade aqui.
 */
export class CompartilhamentoDeOutraPessoa extends ErroDeDominio {
  constructor() {
    super(
      "PERMISSAO_INSUFICIENTE",
      "Sem permissão",
      "Só quem compartilhou, ou um Gestor, desfaz este compartilhamento.",
    );
  }
}

export type MotivoDoDestinatarioInvalido = "JA_VE_A_OCORRENCIA" | "FORA_DO_ALCANCE";

const DETALHE_DO_DESTINATARIO: Readonly<Record<MotivoDoDestinatarioInvalido, string>> = {
  JA_VE_A_OCORRENCIA: "Esta pessoa já vê esta ocorrência.",
  FORA_DO_ALCANCE: "Você só compartilha com quem pode registrar ocorrências.",
};

/**
 * `422` do destino que existe e não serve (item 87). **Carrega o campo**, como
 * `MotivoNaoPermitidoParaOPapel`. Destino que não existe NESTA organização não chega aqui: é `404` da
 * ocorrência (critério 87.4).
 */
export class DestinatarioInvalido extends ErroDeDominio {
  constructor(motivo: MotivoDoDestinatarioInvalido) {
    super(
      "DESTINATARIO_INVALIDO",
      "Não dá para compartilhar com esta pessoa",
      DETALHE_DO_DESTINATARIO[motivo],
      { erros: [{ campo: "pessoaId", codigo: motivo }] },
    );
  }
}
