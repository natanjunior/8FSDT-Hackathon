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
