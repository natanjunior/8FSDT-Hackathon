import { comandoPermitido, type Prioridade } from "@/dominio/ocorrencia";

import { recusaPorPrioridadeImutavel, type ContextoDoComando } from "./comando";
import { participaDaOcorrencia, recusaDeQuemNaoParticipa } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `alterar-prioridade` — o terceiro comando que não transiciona, e o PRIMEIRO
 *  cuja recusa de estado não é `TRANSICAO_NAO_PERMITIDA`
 * ============================================================================
 *
 * **O agregado participa, e não é escolha deste arquivo.** `prioridade` é coluna de `ocorrencias`, dentro
 * do limite — como `solucao_aplicada`, e ao contrário de `atribuicoes`. A doutrina do projeto (aula 5, p.9:
 * *"somente a lógica do agregado pode alterar o seu estado"*) obriga o agregado a participar de uma escrita
 * que **não** é transição, e é por isso que este comando o atravessa em vez de mandar um DTO à porta.
 *
 * **Três recusas, e a terceira é nova no produto:**
 *
 * ```
 * 403 PERMISSAO_INSUFICIENTE (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA                    — não existe nesta organização, ou não é visível
 *      └─ 409 PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL   — status ∈ { resolvida, cancelada }
 *          └─ escrita
 * ```
 *
 * **`comandoPermitido`, nunca `transicaoPermitida`.** A segunda só consulta a tabela com coluna `Para` e
 * responde `false` nos **seis** estados para este comando — usá-la aqui o recusaria sempre. Os dois estados
 * recusados saem de **uma** fonte: `SEM_TRANSICAO["alterar-prioridade"]`, que a `arquitetura.md` §4
 * normatiza. **Não há segunda lista.**
 *
 * **O `409` é OUTRO, e é o contrato que decide o nome.** `openapi.yaml:1657-1669` e
 * `contrato-de-api.md:1205-1207` declaram `PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL` nominalmente para esta
 * operação — é a **invariante 7** falando com o próprio nome. Os sete comandos anteriores, inclusive os dois
 * sem transição, recusam com o código único; este é a primeira exceção.
 *
 * **A permissão é do Gestor.** `ocorrencia.alterar_prioridade` está em `SO_DO_GESTOR`, e
 * `PERMISSOES_POR_PAPEL.encarregado` é `[]` por decisão declarada do contrato §4.5. **Quem executa não
 * prioriza** — quem prioriza é o Gestor, lendo a descrição (D7).
 *
 * **Este comando não deixa rastro em lugar nenhum**, e é o único do produto do qual as três coisas são
 * verdade: não gera registro de transição (critério 17.3), não aparece na linha do tempo (**PA-21**), e a
 * última escrita vence sem aviso (contrato §7.9). O que o produto tem contra o toque errado é a **janela de
 * conserto** do critério 17.7, na tela — não uma defesa aqui.
 */
export async function alterarPrioridade(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; prioridade: Prioridade },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  // **O agregado sai do envelope; o fato fica nele.** Este comando não usa `temResponsavel` para decidir
  // nada — ele o repassa a `recusaPorPrioridadeImutavel`, que é quem monta `acoesDisponiveis`.
  const agregado = carregada.ocorrencia;

  // **A conferência de participação continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.alterar_prioridade` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao comando
  // por coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  // Quem participa age; quem só recebeu leva `403`, e quem não alcança leva `404` (item 87).
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw await recusaDeQuemNaoParticipa(repositorio, entrada.ocorrenciaId, quem.pessoaId);
  }

  if (!comandoPermitido(agregado.status, "alterar-prioridade")) {
    throw recusaPorPrioridadeImutavel(carregada, ctx);
  }

  // **O agregado decide o valor gravado**, e a porta transcreve. A instância NOVA é a que viaja: dela sai a
  // prioridade do `set`. **O status dela NÃO é o predicado** — a porta compara com `TERMINAIS`.
  const alterada = agregado.alterarPrioridade({ prioridade: entrada.prioridade });

  const resultado = await repositorio.alterarPrioridade(
    entrada.ocorrenciaId,
    alterada,
    // **O relógio é lido UMA vez.** Ele viaja ao lado porque `atualizada_em` não é campo da raiz — em
    // `aplicarTransicao` ele sai do registro, e aqui não há registro.
    ctx.agora ?? new Date().toISOString(),
  );

  if (resultado.desfecho === "alterada") return resultado.ocorrencia;

  /**
   * **A corrida.** O `update … where status <> all(TERMINAIS)` não achou linha, e há **um** caso possível:
   * a ocorrência **virou terminal** entre a nossa leitura e a nossa escrita. Relemos para dizer onde ela
   * está *agora* — e lançamos a **mesma** recusa, sem `if` de escolha, porque não há segundo motivo.
   *
   * **O que isto impede não é prioridade sobrescrita** — a §7.9 aceita isso, com três razões escritas. É
   * escrita em **registro fechado**: sem o predicado, este comando cairia numa ocorrência já `resolvida`,
   * mudando o dado que o dashboard soma **sem nada em lugar nenhum** dizendo quando nem por quem — e este é
   * o único comando do qual "lugar nenhum" é literal, porque ele não entra nem na trilha nem na linha do
   * tempo.
   *
   * **Se a releitura devolver `null`, é `404`**, como nos outros cinco comandos.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaPorPrioridadeImutavel(atual, ctx);
}
