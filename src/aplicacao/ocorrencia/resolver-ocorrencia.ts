import { transicaoPermitida } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { podeLerOcorrencia } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
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
 * **São TRÊS recusas, e não quatro: `resolver` não tem precondição fora do `status`.** A invariante 9 é do
 * `iniciarAtendimento`; a invariante 10 diz o contrário de uma precondição — *"`resolver` **não** exige
 * solução aplicada; depende da configuração da `Organização`"* —, e o interruptor por organização é
 * evolução prevista, sem coluna e sem `PATCH /organizacao` (critério 25.4).
 *
 * ```
 * 403 (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA       — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA     — status ≠ em_atendimento
 *          └─ escrita
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

  // **A conferência de visibilidade continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.resolver` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao comando por
  // coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  if (!podeLerOcorrencia({ autor: { pessoaId: agregado.autorPessoaId } }, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  if (!transicaoPermitida(agregado.status, "resolver")) throw recusaDeTransicao(carregada, ctx);

  const observacao = entrada.observacao?.trim();
  const solucao = entrada.solucaoAplicada?.trim();

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
   * **Hoje `/resolver` é o único escritor de `solucao_aplicada`**, então o predicado otimista protege a
   * coluna junto com o status. **Quando o item 25 criar o segundo escritor, esta frase deixa de valer** —
   * `/registrar-solucao-aplicada` não muda `status` e por isso o predicado não o vê (achado A-2).
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
