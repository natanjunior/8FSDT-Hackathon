import { transicaoPermitida } from "@/dominio/ocorrencia";

import { recusaDeTransicao, recusaPorFaltaDeResponsavel, type ContextoDoComando } from "./comando";
import { participaDaOcorrencia, recusaDeQuemNaoParticipa } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `iniciar-atendimento` — a terceira porta de comando, e a primeira com DUAS recusas de estado
 * ============================================================================
 *
 * **A invariante 9 mora aqui, e não no agregado** (`arquitetura.md` §4): ela *"atravessa outra tabela no
 * momento em que o comando roda"*. O agregado continua sem conhecer `atribuicoes` — ele recebe o comando
 * já autorizado, e a guarda de `status` dele é a rede estrutural, não a decisão.
 *
 * **O fato chega junto do agregado**, no envelope de `carregar`, apurado por um `exists` dentro do mesmo
 * `select`. Nenhuma consulta a mais, e nenhuma janela entre duas leituras.
 *
 * **A ordem das quatro recusas, e a fonte de cada uma:**
 *
 * ```
 * 403 (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA          — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA        — status ≠ em_analise
 *          └─ 409 RESPONSAVEL_NAO_ATRIBUIDO  — não há atribuição vigente
 *              └─ escrita
 * ```
 *
 * **O `409` de estado vem ANTES do de responsável, e a fonte é o contrato publicado:** o exemplo
 * `semResponsavel` do `openapi.yaml` traz `statusAtual: "em_analise"` — para chegar naquele erro, a
 * ocorrência já passou pela conferência de status. É também o argumento de ordem do item 19: conferir a
 * pessoa antes do estado contaria, a quem o comando ia recusar de qualquer jeito, um fato sobre a
 * organização.
 *
 * **Nenhum registro é criado em nenhuma das recusas** (critério 22.2), e isso é estrutural: o `insert` do
 * registro só existe dentro de `aplicarTransicao`, que só é chamado depois das quatro portas.
 *
 * **A corrida do responsável não existe nesta entrega, e a razão é escrita e não suposta:** não há
 * endpoint que **remova** atribuição — `motivo_encerramento = 'recusa'` *"não tem, nesta entrega, nenhum
 * caminho que o produza"* (migração 008) —, e reatribuir encerra a vigente e insere a nova no mesmo
 * `COMMIT`. **`temResponsavel` é monotônico: uma vez `true`, sempre `true`.** O único desencontro possível
 * é o inverso — recusar quem teria sucesso um milissegundo depois —, e a resposta a isso é o `409`
 * correto, com `atribuir-responsavel` em `acoesDisponiveis`. Se um dia a recusa de atribuição existir,
 * esta frase deixa de valer.
 */
export async function iniciarAtendimento(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; observacao?: string | null },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  const agregado = carregada.ocorrencia;

  // **A conferência de participação continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.iniciar_atendimento` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao
  // comando por coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  // Quem participa age; quem só recebeu leva `403`, e quem não alcança leva `404` (item 87).
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw await recusaDeQuemNaoParticipa(repositorio, entrada.ocorrenciaId, quem.pessoaId);
  }

  if (!transicaoPermitida(agregado.status, "iniciar-atendimento")) {
    throw recusaDeTransicao(carregada, ctx);
  }

  // **A invariante 9, e ela é a única precondição de comando do contrato que não é sobre `status`.**
  if (!carregada.temResponsavel) throw recusaPorFaltaDeResponsavel(agregado, ctx);

  const observacao = entrada.observacao?.trim();

  const iniciada = agregado.iniciarAtendimento({
    // **O autor da transição é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    autorPessoaId: ctx.pessoaId,
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
    // Mesmo tratamento do `analisar`: string vazia gravada numa trilha append-only é ruído que não se
    // apaga depois.
    observacao: observacao === undefined || observacao === "" ? null : observacao,
  });

  const resultado = await repositorio.aplicarTransicao(entrada.ocorrenciaId, iniciada);
  if (resultado.desfecho === "aplicada") return resultado.ocorrencia;

  /**
   * **A corrida entre dois Gestores** (contrato §7.9). O `update … where status = 'em_analise'` não achou
   * linha: alguém moveu a ocorrência entre a nossa leitura e a nossa escrita. **Relemos** para dizer onde
   * ela está *agora*, e não onde estava quando começamos.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
