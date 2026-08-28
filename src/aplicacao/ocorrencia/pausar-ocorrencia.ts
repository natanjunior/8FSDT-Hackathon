import { transicaoPermitida, type MotivoPausa } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { podeLerOcorrencia } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `pausar` — a quinta porta de comando, e a primeira fora do trilho do ciclo
 * ============================================================================
 *
 * **Pelo molde do `iniciar-atendimento`, menos a invariante 9.** `pausar` não exige responsável — a
 * tabela de transições é a única regra de estado dele —, e por isso a cadeia tem uma recusa a menos:
 *
 * ```
 * 403 (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA      — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA    — status ∉ { em_analise, em_atendimento }
 *          └─ escrita
 *              └─ 409 TRANSICAO_NAO_PERMITIDA — a corrida, relendo para dizer onde ela está AGORA
 * ```
 *
 * **Nenhum erro novo nasce** — `TransicaoNaoPermitida` já está no Domínio e já é `409` em
 * `problema.ts`. É a segunda fatia seguida em que isso acontece.
 *
 * **`carregar` devolve o envelope e ele é usado por inteiro:** `recusaDeTransicao` recebe
 * `OcorrenciaCarregada` desde o item 22, e é isso que faz o corpo do `409` desta fatia listar
 * `iniciar-atendimento` quando há responsável e escondê-lo quando não há. **Nenhuma linha nova em
 * `comando.ts`.**
 *
 * **A `observacao` é aparada e NÃO pode virar `null`**, e é o oposto dos três comandos anteriores. Eles
 * fazem `vazio → null` porque a observação deles é opcional (D23); aqui o vazio **já foi recusado pelo
 * schema com `400`**, e o `trim` existe só para não gravar espaços em volta. Se o resultado for vazio,
 * quem estoura é `RegistroDeTransicao.pausa` — e chegar lá é defeito, não caminho.
 */
export async function pausarOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; motivo: MotivoPausa; observacao: string },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  const agregado = carregada.ocorrencia;

  // **A conferência de visibilidade continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.pausar` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao comando por
  // coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  if (!podeLerOcorrencia({ autor: { pessoaId: agregado.autorPessoaId } }, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  if (!transicaoPermitida(agregado.status, "pausar")) {
    throw recusaDeTransicao(carregada, ctx);
  }

  const pausada = agregado.pausar({
    // **O autor da transição é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    autorPessoaId: ctx.pessoaId,
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
    motivo: entrada.motivo,
    observacao: entrada.observacao.trim(),
  });

  const resultado = await repositorio.aplicarTransicao(entrada.ocorrenciaId, pausada);
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
