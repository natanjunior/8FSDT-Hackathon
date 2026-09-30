import { transicaoPermitida } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { participaDaOcorrencia, recusaDeQuemNaoParticipa } from "./consultas";
import { OcorrenciaNaoEncontrada, SolucaoObrigatoria } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `resolver` — a quarta porta de comando, e a primeira que fecha a ocorrência
 * ============================================================================
 *
 * **`resolvida` é terminal de verdade: não existe `reabrir`** (D24). O que se escreve aqui não se corrige
 * depois — `alterar-prioridade` cai pela invariante 7 e `registrar-solucao-aplicada` é recusado em
 * `resolvida` de propósito, *"porque a consequência é permanente"* (`arquitetura.md` §4).
 *
 * **São QUATRO recusas desde o item 99.** A invariante 9 é do `iniciarAtendimento`; a invariante 10 —
 * *"`resolver` **não** exige solução aplicada; depende da configuração da `Organização`"* — deixou de ser
 * evolução prevista: o interruptor chegou, lido do envelope de `carregar`, e a coluna que existia desde a
 * migração `001` passou a ter quem a leia. Com a regra desligada, que é o valor de toda organização ao
 * nascer, o critério 25.4 continua valendo palavra por palavra.
 *
 * ```
 * 403 (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA       — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA     — status ≠ em_atendimento
 *          └─ 422 SOLUCAO_OBRIGATORIA     — regra ligada e nenhuma solução
 *              └─ escrita
 * ```
 *
 * **O critério 26.3 sai de graça, e é o ponto de o produto ter permissão como LISTA.**
 * `comContexto({ exige: "ocorrencia.resolver" })` recusa antes de ler o recurso, e `ocorrencia.resolver`
 * está em `SO_DO_GESTOR`, fora de `DO_SOLICITANTE`. **O Solicitante autor leva `403` sem um único `if`
 * sobre autoria** — ser autor dá `ler_propria` e `cancelar_propria`, nunca `resolver`. É a diferença
 * entre este critério e o 18.3, que é sobre autoria e precisa de código.
 *
 * **Nenhum registro é criado em nenhuma das recusas** (critério 26.2), e isso é estrutural: o `insert` do
 * registro só existe dentro de `aplicarTransicao`, que só é chamado depois das três portas.
 *
 * **O critério 26.5 não custa código nenhum:** o segundo `resolver` encontra `status = 'resolvida'`,
 * `transicaoPermitida` responde `false`, e o `409` sai com `acoesDisponiveis: []`. **A máquina de estados
 * é a chave de idempotência** (contrato §7.10).
 *
 * **`solucaoAplicada` viaja no MESMO corpo** (contrato §8.4): enviada aqui, *"equivale a chamar
 * `/registrar-solucao-aplicada` antes — e o registro de transição é um só"*. Quem decide o valor gravado
 * é o **agregado**, porque a coluna é da raiz dele; este comando só apara.
 */
export async function resolverOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; observacao?: string | null; solucaoAplicada?: string | null },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  // **O agregado sai do envelope; o fato fica nele.** `resolver` não usa `temResponsavel` para decidir
  // nada — ele o repassa a `recusaDeTransicao`, que é quem monta `acoesDisponiveis`.
  const agregado = carregada.ocorrencia;

  // **A conferência de participação continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.resolver` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao comando por
  // coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  // Quem participa age; quem só recebeu leva `403`, e quem não alcança leva `404` (item 87).
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw await recusaDeQuemNaoParticipa(repositorio, entrada.ocorrenciaId, quem.pessoaId);
  }

  if (!transicaoPermitida(agregado.status, "resolver")) throw recusaDeTransicao(carregada, ctx);

  const observacao = entrada.observacao?.trim();
  const solucao = entrada.solucaoAplicada?.trim();

  /**
   * **A invariante 10 com a regra ligada** (item 99). Passa quem manda solução no corpo **ou** já tem
   * solução gravada (`/registrar-solucao-aplicada`, item 25). Vem depois do `409` de estado: numa
   * ocorrência que não está em atendimento, a resposta útil é onde ela está, não o que falta.
   */
  const temSolucao =
    (solucao !== undefined && solucao !== "") || (agregado.solucaoAplicada ?? "").trim() !== "";
  if (carregada.regras.exigirSolucaoAoResolver && !temSolucao) throw new SolucaoObrigatoria();

  const resolvida = agregado.resolver({
    // **O autor da transição é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    autorPessoaId: ctx.pessoaId,
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
    // Mesmo tratamento do `analisar`: string vazia gravada numa trilha append-only é ruído que não se
    // apaga depois — e aqui vale duplamente, porque o estado terminal congela o que ficou.
    observacao: observacao === undefined || observacao === "" ? null : observacao,
    /**
     * **Vazio é AUSENTE, não apagamento**, e a diferença importa: `null` chega ao agregado e ele
     * **preserva** a solução que já houvesse. Apagar solução aplicada não é capacidade de endpoint
     * nenhum — e em `resolvida` não haveria conserto.
     */
    solucaoAplicada: solucao === undefined || solucao === "" ? null : solucao,
  });

  const resultado = await repositorio.aplicarTransicao(entrada.ocorrenciaId, resolvida);
  if (resultado.desfecho === "aplicada") return resultado.ocorrencia;

  /**
   * **A corrida entre dois Gestores** (contrato §7.9). O `update … where status = 'em_atendimento'` não
   * achou linha: alguém moveu a ocorrência entre a nossa leitura e a nossa escrita. **Relemos** para
   * dizer onde ela está *agora*, e não onde estava quando começamos.
   *
   * **Desde o item 25 há um segundo escritor de `solucao_aplicada`**, e o predicado otimista daqui **não o
   * vê**: `/registrar-solucao-aplicada` não muda `status`. O que sobra é a corrida que a §7.9 do contrato
   * aceita por escrito — última escrita vence, no mesmo estado —, e a metade grande dela foi fechada do
   * lado do cliente: `ModalDeResolucao` só envia `solucaoAplicada` quando o campo difere do
   * pré-preenchido (achado A-2 da spec do 26, respondido pela §3.4 da spec do 25).
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
