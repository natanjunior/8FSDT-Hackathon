import { ErroDeDominio } from "@/dominio/erros";

import { type Comando } from "./Comando";
import { type StatusOcorrencia } from "./StatusOcorrencia";

/**
 * ============================================================================
 *  `409 TRANSICAO_NAO_PERMITIDA` — a recusa deste agregado
 * ============================================================================
 *
 * **Nasce aqui, e não em `aplicacao/`, porque é recusa da máquina de estados** — não erro transversal
 * como `PermissaoInsuficiente`. `aplicacao/ocorrencia/erros.ts` a **reexporta**, o mesmo idioma que
 * `AreaInvalida` já usa ali, na direção oposta.
 *
 * **O construtor recebe os dois campos do corpo, e por isso não existe forma de construí-la incompleta**
 * (contrato §8.4): `statusAtual` diz onde a ocorrência está, `acoesDisponiveis` diz o que dá para fazer a
 * partir dali — *"para que o cliente descubra pelo próprio erro o que pode fazer"*.
 *
 * **`detalhe` não nomeia o comando, de propósito.** Nomeá-lo exigiria um mapa de verbos — texto de
 * produto para dez comandos que ainda não existem —, e quem monta a frase para gente é a tela, a partir
 * de `statusAtual` (`inventario-de-telas.md`). `titulo` e `detalhe` são texto para humano e podem mudar;
 * o `codigo` é o contrato.
 */
export class TransicaoNaoPermitida extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "TRANSICAO_NAO_PERMITIDA",
      "Transição não permitida",
      "O estado atual desta ocorrência não permite esta ação.",
      { statusAtual, acoesDisponiveis },
    );
  }
}

/**
 * ============================================================================
 *  `409 PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL` — a SEGUNDA recusa deste agregado
 * ============================================================================
 *
 * **É a primeira recusa de estado do produto que não é `TRANSICAO_NAO_PERMITIDA`**, e o contrato a declara
 * nominalmente para uma operação só (`openapi.yaml:1657-1669`, `contrato-de-api.md:1205-1207`).
 *
 * **Nasce aqui, ao lado da irmã, pelo mesmo argumento dela:** é recusa da máquina de estados. A
 * **invariante 7** — *"`prioridade` é imutável em `Resolvida` e `Cancelada` (D6), para que o dashboard seja
 * reproduzível"* (`arquitetura.md:287`) — é normatizada pela tabela companheira, que mora no Domínio.
 * `aplicacao/ocorrencia/erros.ts` a **reexporta**, no mesmo idioma da `TransicaoNaoPermitida`.
 *
 * **NÃO é o caso de `ResponsavelNaoAtribuido`**, que nasceu em `aplicacao/` porque a invariante 9
 * *"atravessa outra tabela no momento em que o comando roda"*. Esta não atravessa nada: `status` é coluna
 * da raiz.
 *
 * **`titulo` e `detalhe` são os do `openapi.yaml:1664` e `:1666`, literais** — `detail` publicado é
 * contrato, não frase nova. Ao contrário da irmã, este `detalhe` **nomeia o fato** em vez de ser vago: só
 * existe um comando com este código, então não há mapa de verbos a inventar.
 *
 * **As extensões são as DUAS, como nas duas irmãs.** O exemplo publicado da operação mostra só
 * `statusAtual`, e isso é falta de exemplo, não de schema: o `Problema` (`openapi.yaml:2420-2426`) declara
 * `statusAtual` e `acoesDisponiveis` como extensões *"em conflitos de estado"*. Enviar só uma criaria a
 * **terceira** forma de corpo de `409` no produto.
 *
 * **O `codigo` já está mapeado para 409** em `interface/http/problema.ts:41`. **Nada muda lá.**
 */
export class PrioridadeImutavelEmEstadoTerminal extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL",
      "Prioridade congelada",
      "A prioridade não muda depois de resolvida ou cancelada, para o dashboard não mudar o passado.",
      { statusAtual, acoesDisponiveis },
    );
  }
}

/**
 * ============================================================================
 *  `409 AVALIACAO_EXIGE_RESOLVIDA` — a TERCEIRA recusa deste agregado
 * ============================================================================
 *
 * **A metade de ESTADO da invariante 8** (`arquitetura.md:288`): *"`avaliar` só é aceito em
 * `Resolvida`"*. Nasce aqui, ao lado das duas irmãs, e a `arquitetura.md:495` a nomeia **em letra** como
 * recusa do **Domínio** — `status` é coluna da raiz e não atravessa nada.
 *
 * **NÃO é `TRANSICAO_NAO_PERMITIDA`, e a diferença é do contrato.** `registrar-solucao-aplicada` recusa
 * com aquele código mesmo sem transicionar, porque é o que o `openapi.yaml` publica para *aquele*
 * endpoint. Para este, o publicado é `AVALIACAO_EXIGE_RESOLVIDA` (`openapi.yaml:2084`). **O nome do
 * código é do contrato; a pergunta que o produz é nossa.**
 *
 * **`titulo` é o do `openapi.yaml:2082`, literal. O `detalhe` é TEXTO NOVO**, e é o achado **A-2** da
 * spec: o YAML publica `title` para os três erros deste endpoint e **`detail` para nenhum**. O `Problema`
 * exige `detail`, e um erro sem frase chega à tela como texto vazio — é o mesmo argumento com que o item
 * 18 escreveu a frase do `MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL` sem esperar o documento.
 *
 * **As extensões são as DUAS**, como nas duas irmãs. O exemplo publicado mostra só `statusAtual`, e isso
 * é falta de exemplo, não de schema: o `Problema` declara as duas *"em conflitos de estado"*. Enviar só
 * uma criaria a **terceira** forma de corpo de `409` no produto.
 *
 * **O `codigo` já está mapeado para 409** em `interface/http/problema.ts:42`. **Nada muda lá.**
 */
export class AvaliacaoExigeResolvida extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super(
      "AVALIACAO_EXIGE_RESOLVIDA",
      "Ainda não dá para avaliar",
      "A avaliação só existe depois que a ocorrência for resolvida.",
      { statusAtual, acoesDisponiveis },
    );
  }
}

/**
 * ============================================================================
 *  `409 JA_AVALIADA` — a QUARTA recusa deste agregado, e a última
 * ============================================================================
 *
 * **A metade *"uma vez só"* da invariante 8**, que o `contrato-de-api.md:1282` nomeia separadamente. O
 * dado está na própria raiz — `avaliacao_nota` é coluna de `ocorrencias` —, então ela é do **Domínio**,
 * como a irmã, e a `arquitetura.md:495` também a nomeia em letra.
 *
 * **O `detalhe` NÃO é texto novo, e é o único dos três que não é:** é literal do
 * `inventario-de-telas.md:1520`, que já escreveu a frase de tela deste erro. E é ele que chega ao modal
 * pelo `problema.detail` do `executarComando` (`comando-de-ocorrencia.ts:63`), **sem uma linha alterada
 * lá**.
 *
 * **Ela não acontece pela tela**, e o inventário diz por quê: *"o convite desaparece com
 * `avaliacao != null`"*. **Acontece com duas abas** — e é exatamente essa corrida que o
 * `and avaliacao_nota is null` do `update` fecha (tarefa 3).
 *
 * **O `codigo` já está mapeado para 409** em `problema.ts:43`.
 */
export class JaAvaliada extends ErroDeDominio {
  constructor(statusAtual: StatusOcorrencia, acoesDisponiveis: readonly Comando[]) {
    super("JA_AVALIADA", "Já avaliada", "Esta ocorrência já foi avaliada.", {
      statusAtual,
      acoesDisponiveis,
    });
  }
}
