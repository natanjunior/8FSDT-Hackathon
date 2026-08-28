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
