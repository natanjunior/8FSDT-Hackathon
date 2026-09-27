import {
  ESTADOS_DE_CANCELAMENTO_DO_AUTOR,
  motivosPermitidos,
  transicaoPermitida,
  type MotivoCancelamento,
} from "@/dominio/ocorrencia";

import {
  recusaDeTransicao,
  recusaPorEstadoDeCancelamento,
  type ContextoDoComando,
} from "./comando";
import { participaDaOcorrencia } from "./consultas";
import { MotivoNaoPermitidoParaOPapel, OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `cancelar` — a sétima porta de comando, e a CADEIA MAIS LONGA do produto
 * ============================================================================
 *
 * **Pelo molde do `pausar-ocorrencia.ts`, com dois degraus a mais no miolo.** Os quatro extremos —
 * o `403` do portão, o `404`, o `409` de estado e o `409` da corrida — são herdados sem uma linha nova.
 *
 * ```
 * 403 PERMISSAO_INSUFICIENTE             (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA      — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA    — status ∉ { aberta, em_analise, em_atendimento, pausada }
 *          └─ 403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO
 *              └─ 422 MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL
 *                  └─ escrita
 *                      └─ 409 TRANSICAO_NAO_PERMITIDA — a corrida, relendo onde ela está AGORA
 * ```
 *
 * **`cancelar` é o único comando do produto em que duas pessoas diferentes chamam o mesmo endpoint com
 * regras diferentes**, e é daí que saem os dois degraus do meio: a permissão restringe o **estado**
 * (`403`) e restringe o **valor do motivo** (`422`). **As duas perguntas só podem ser feitas com o
 * recurso carregado** — é por isso que nenhuma delas cabe no `comContexto`, que decide antes de ler.
 *
 * **Por que o `409` vem ANTES do `403`.** Uma ocorrência `resolvida` responderia *"só o Gestor cancela
 * neste estado"* — e é falso: ali **ninguém** cancela. A ordem inversa daria ao Solicitante a impressão
 * de que existe alguém que pode.
 *
 * **Por que o `403` vem ANTES do `422`.** O motivo é dado do **corpo**; o estado é fato do **recurso**.
 * A resposta útil é a que não se contorna reescrevendo o corpo — quem está em `em_atendimento` e não é
 * Gestor não passa nem trocando o motivo, e dizer-lhe primeiro *"este motivo não é seu"* o mandaria
 * tentar de novo com outro.
 *
 * **Nenhum erro novo em `problema.ts`** — os dois códigos já estão mapeados (`:28` e `:60`) — e
 * **nenhuma porta nova**: `aplicarTransicao` é genérica e já grava as dez colunas, `motivo_cancelamento`
 * inclusive.
 *
 * **A `observacao` é aparada e NUNCA vira `null`** — é o oposto dos comandos de avanço rotineiro, e é a
 * mesma nota do `pausar`: o vazio já foi recusado pelo schema com `400`, e o `trim` existe só para não
 * gravar espaços em volta. Se o resultado for vazio, quem estoura é `RegistroDeTransicao.cancelamento` —
 * e chegar lá é defeito, não caminho.
 */
export async function cancelarOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; motivo: MotivoCancelamento; observacao: string },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  const agregado = carregada.ocorrencia;

  /**
   * **A conferência de visibilidade, e aqui ela NÃO é redundante.** Nos comandos anteriores quem tinha a
   * permissão do comando tinha `ocorrencia.ler_todas` no mesmo papel; este é chamado também pelo
   * Solicitante, que tem `cancelar_propria` e **não** tem `ler_todas`. Quem tenta cancelar a ocorrência
   * de outra pessoa leva `404` — nunca `403`, e nunca a confirmação de que ela existe (§6.3).
   */
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  if (!transicaoPermitida(agregado.status, "cancelar")) {
    throw recusaDeTransicao(carregada, ctx);
  }

  /** Derivado **uma vez**, e lido pelos dois degraus do meio. */
  const ehGestor = ctx.permissoes.includes("ocorrencia.cancelar_qualquer");

  // **A metade de ESTADO do critério 18.3.** A lista é a mesma que `comandosDisponiveis` consulta para
  // esconder o botão — duas listas divergiriam, e a divergência seria um botão que responde `403` no
  // clique.
  if (!ehGestor && !ESTADOS_DE_CANCELAMENTO_DO_AUTOR.includes(agregado.status)) {
    throw recusaPorEstadoDeCancelamento(carregada, ctx);
  }

  // **A metade de VALOR do critério 18.4.** O conjunto vem do Domínio; a checagem é daqui.
  if (!motivosPermitidos(ctx.permissoes).includes(entrada.motivo)) {
    throw new MotivoNaoPermitidoParaOPapel();
  }

  const cancelada = agregado.cancelar({
    // **O autor da transição é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    autorPessoaId: ctx.pessoaId,
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
    motivo: entrada.motivo,
    observacao: entrada.observacao.trim(),
  });

  const resultado = await repositorio.aplicarTransicao(entrada.ocorrenciaId, cancelada);
  if (resultado.desfecho === "aplicada") return resultado.ocorrencia;

  /**
   * **A corrida entre dois Gestores** (contrato §7.9). O `update … where status = <anterior>` não achou
   * linha: alguém moveu a ocorrência entre a nossa leitura e a nossa escrita. **Relemos** para dizer
   * onde ela está *agora*, e não onde estava quando começamos.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
