import { transicaoPermitida } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { participaDaOcorrencia, recusaDeQuemNaoParticipa } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `retomar` — a sexta porta de comando, e a mais curta das seis
 * ============================================================================
 *
 * **Pelo molde do `pausar`, menos a validação de motivo.** Sem motivo codificado para conferir, sem
 * invariante 9 para checar, sem campo extra para transcrever — e por isso a cadeia é a mesma:
 *
 * ```
 * 403 (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA      — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA    — status ≠ pausada
 *          └─ escrita
 *              └─ 409 TRANSICAO_NAO_PERMITIDA — a corrida, relendo para dizer onde ela está AGORA
 * ```
 *
 * **Nenhum erro novo nasce** — `TransicaoNaoPermitida` já está no Domínio e já é `409` em `problema.ts`.
 * É a terceira fatia seguida em que isso acontece.
 *
 * **Este comando NÃO consulta `temResponsavel` para decidir**, e a ausência é a decisão (spec §3.4).
 * A invariante 9 é de `iniciarAtendimento`, nominalmente (`arquitetura.md` §4); `retomar` pode devolver
 * a ocorrência a `em_atendimento` sem conferir responsável, porque para ter chegado lá antes ela já
 * passou pelo `iniciarAtendimento` — e não existe endpoint que desatribua. O envelope é repassado a
 * `recusaDeTransicao`, que monta o corpo do `409`, e só para isso.
 *
 * **O destino não aparece neste arquivo, e é o critério 24.2 na camada certa.** Quem sabe para onde a
 * ocorrência volta é o agregado, porque é ele que tem a trilha na mão. A Aplicação pergunta *"pode
 * transicionar?"* e entrega o resultado; a resposta HTTP é a ocorrência relida, e é ali que o cliente
 * descobre.
 *
 * **A conferência de participação continua rodando**, mesmo sendo hoje redundante — quem tem
 * `ocorrencia.retomar` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao comando por
 * coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
 */
export async function retomarOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; observacao?: string | null },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  const agregado = carregada.ocorrencia;

  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  // Quem participa age; quem só recebeu leva `403`, e quem não alcança leva `404` (item 87).
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw await recusaDeQuemNaoParticipa(repositorio, entrada.ocorrenciaId, quem.pessoaId);
  }

  if (!transicaoPermitida(agregado.status, "retomar")) {
    throw recusaDeTransicao(carregada, ctx);
  }

  const observacao = entrada.observacao?.trim();

  const retomada = agregado.retomar({
    // **O autor da transição é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    autorPessoaId: ctx.pessoaId,
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
    // Mesmo tratamento do `analisar`, do `iniciarAtendimento` e do `resolver` — e ao contrário do
    // `pausar`, onde o vazio já foi recusado pelo schema. String vazia gravada numa trilha append-only
    // é ruído que não se apaga depois.
    observacao: observacao === undefined || observacao === "" ? null : observacao,
  });

  const resultado = await repositorio.aplicarTransicao(entrada.ocorrenciaId, retomada);
  if (resultado.desfecho === "aplicada") return resultado.ocorrencia;

  /**
   * **A corrida entre dois Gestores** (contrato §7.9), e aqui ela é literalmente o momento 6 do
   * protótipo: *"o Gestor tocou em Retomar; outro Gestor já tinha retomado"*. O `update … where status
   * = 'pausada'` não achou linha. **Relemos** para dizer onde ela está *agora*.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
