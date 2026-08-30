import { comandoPermitido } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { podeLerOcorrencia } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `registrar-solucao-aplicada` — o segundo comando que não transiciona, e o
 *  primeiro que escreve DENTRO do limite do agregado sem tocar a trilha
 * ============================================================================
 *
 * **O agregado participa, e não é escolha deste arquivo.** `solucao_aplicada` é coluna de `ocorrencias`,
 * dentro do limite — ao contrário de `atribuicoes`, que a spec do item 19 pôs fora de propósito. A doutrina
 * do projeto (aula 5, p.9: *"somente a lógica do agregado pode alterar o seu estado"*) obriga o agregado a
 * participar de uma escrita que **não** é transição, e é por isso que este comando o atravessa em vez de
 * mandar um DTO à porta.
 *
 * **Três recusas, e nenhuma delas é nova:**
 *
 * ```
 * 403 PERMISSAO_INSUFICIENTE (no comContexto, antes de ler o recurso)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA       — não existe nesta organização, ou não é visível
 *      └─ 409 TRANSICAO_NAO_PERMITIDA     — status ∉ { em_atendimento, pausada }
 *          └─ escrita
 * ```
 *
 * **`comandoPermitido`, nunca `transicaoPermitida`.** A segunda só consulta a tabela com coluna `Para` e
 * responde `false` nos **seis** estados para este comando — usá-la aqui o recusaria sempre. Os quatro
 * estados recusados saem de **uma** fonte: `SEM_TRANSICAO["registrar-solucao-aplicada"]`, que a
 * `arquitetura.md` §4 normatiza. **Não há segunda lista.**
 *
 * **O `409` continua sendo `TRANSICAO_NAO_PERMITIDA`, mesmo sem transição** — é o que o contrato declara
 * para este endpoint (§8.4) e o que o `openapi.yaml` publica. O nome do código é do contrato; a pergunta
 * que o produz é nossa.
 *
 * **A permissão é do Gestor, e o Encarregado não a tem.** `ocorrencia.registrar_solucao` está em
 * `SO_DO_GESTOR`, e `PERMISSOES_POR_PAPEL.encarregado` é `[]` por decisão declarada do contrato §4.5.
 * **Quem faz o trabalho não é quem descreve o trabalho, nesta entrega** — é evolução prevista, não lacuna.
 *
 * **Este comando NÃO apara o texto, e a diferença para o `resolver` é o schema.** Lá `solucaoAplicada` é
 * `.nullish()` sem piso, e `""` significa *ausente*; aqui o `openapi.yaml` declara `minLength: 1` e o
 * schema tem `.trim()`, então o que chega já é texto aparado e não vazio. Aparar de novo seria a segunda
 * regra para o mesmo campo.
 */
export async function registrarSolucaoAplicada(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; solucaoAplicada: string },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  // **O agregado sai do envelope; o fato fica nele.** Este comando não usa `temResponsavel` para decidir
  // nada — ele o repassa a `recusaDeTransicao`, que é quem monta `acoesDisponiveis`.
  const agregado = carregada.ocorrencia;

  // **A conferência de visibilidade continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.registrar_solucao` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura ao comando
  // por coincidência de mapa é o acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  if (!podeLerOcorrencia({ autor: { pessoaId: agregado.autorPessoaId } }, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  if (!comandoPermitido(agregado.status, "registrar-solucao-aplicada")) {
    throw recusaDeTransicao(carregada, ctx);
  }

  // **O agregado decide o valor gravado**, e a porta transcreve. A instância NOVA é a que viaja: dela sai
  // o texto do `set` e o status do predicado, que este comando preserva.
  const gravada = agregado.registrarSolucaoAplicada({ solucaoAplicada: entrada.solucaoAplicada });

  const resultado = await repositorio.registrarSolucaoAplicada(
    entrada.ocorrenciaId,
    gravada,
    // **O relógio é lido UMA vez.** Ele viaja ao lado porque `atualizada_em` não é campo da raiz — em
    // `aplicarTransicao` ele sai do registro, e aqui não há registro.
    ctx.agora ?? new Date().toISOString(),
  );

  if (resultado.desfecho === "gravada") return resultado.ocorrencia;

  /**
   * **A corrida.** O `update … where status = <o que lemos>` não achou linha: alguém moveu a ocorrência
   * entre a nossa leitura e a nossa escrita. **Relemos** para dizer onde ela está *agora*, e não onde
   * estava quando começamos — mesmo tratamento que `resolverOcorrencia` e `atribuirResponsavel` dão.
   *
   * **O que isto impede não é texto sobrescrito** — a §7.9 aceita isso, com três razões escritas. É
   * escrita em **registro fechado**: sem o predicado, este comando cairia numa ocorrência já `resolvida`,
   * mudando o detalhe dela sem nada na linha do tempo dizendo quando nem por quem (contrato §8.4).
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
