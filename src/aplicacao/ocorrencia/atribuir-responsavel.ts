import { comandoPermitido } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { podeLerOcorrencia } from "./consultas";
import { OcorrenciaNaoEncontrada, ResponsavelSemVinculoAtivo } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * O que o comando devolve.
 *
 * **`reatribuicao` não entra em `OcorrenciaLida`**: ele é campo do **envelope** desta resposta, e
 * `GET /ocorrencias/{id}` não o tem (`openapi.yaml`, o `allOf`).
 *
 * **O nome é `AtribuicaoAplicada`, e não `ResultadoDeAtribuicao`**, de propósito: a porta já tem
 * `ResultadoDaAtribuicao`, e dois tipos separados por uma letra no mesmo módulo é erro esperando
 * acontecer. Este é o que **sai** do comando; aquele é o que **entra** nele.
 */
export type AtribuicaoAplicada = {
  ocorrencia: OcorrenciaLida;
  reatribuicao: boolean;
};

/**
 * ============================================================================
 *  `atribuir-responsavel` — o primeiro comando que NÃO transiciona
 * ============================================================================
 *
 * **O agregado não participa, e isso é decisão escrita em três documentos** (spec §3.1):
 *
 * - a **invariante 9** está classificada como *"do comando de aplicação, porque atravessa outra tabela no
 *   momento em que o comando roda"*, e a frase que a justifica nomeia a dependência: *"Depende de
 *   `atribuicoes`"* (`arquitetura.md` §4);
 * - *"um responsável ativo por ocorrência"* é garantia **classe B** do `modelo-de-dados.md` §8 — *"regras
 *   sobre um conjunto de linhas, que nenhum agregado consegue garantir sozinho"*;
 * - o comando **não toca `status` nem a trilha**, então a invariante 1 continua intacta sem que ele
 *   participe.
 *
 * **Por que o agregado é lido, então.** Para responder duas perguntas que só ele responde: *esta
 * ocorrência existe nesta organização e eu a alcanço?* e *este estado admite este comando?* **Ler estado
 * para decidir não é escrever estado.** `carregar` é a leitura mais barata das duas que existem — duas
 * consultas, sem `join` de nome e sem anexos.
 *
 * **A ordem das recusas** (§3.8): o `403` já aconteceu no `comContexto`, e o `422 CAMPO_NAO_SUPORTADO`
 * também — os dois antes de o recurso ser lido. Aqui é `404` → `409` → `422 RESPONSAVEL_SEM_VINCULO_ATIVO`,
 * e o último é por último de propósito: conferir a pessoa antes do estado diria, a quem não pode agir
 * sobre uma ocorrência resolvida, que o zelador escolhido está inativo — um fato sobre a organização,
 * dado a quem o comando ia recusar de qualquer forma.
 */
export async function atribuirResponsavel(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; responsavelPessoaId: string },
): Promise<AtribuicaoAplicada> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  // **O agregado sai do envelope; o fato fica nele.** Atribuir não usa `temResponsavel` para decidir
  // nada — ele o repassa a `recusaDeTransicao`, que é quem monta `acoesDisponiveis`.
  const agregado = carregada.ocorrencia;

  // **A conferência de visibilidade continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.atribuir` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura à atribuição por
  // coincidência de mapa é o tipo de acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  if (!podeLerOcorrencia({ autor: { pessoaId: agregado.autorPessoaId } }, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  /**
   * **`comandoPermitido`, e não `transicaoPermitida`.** A segunda consulta só a tabela com coluna `Para`,
   * e responde `false` para este comando nos **seis** estados — usá-la aqui o recusaria sempre.
   *
   * **O `409` continua sendo `TRANSICAO_NAO_PERMITIDA`**, e não um código novo: é o que o contrato declara
   * para este endpoint, mesmo não havendo transição. O nome do código é do contrato; a pergunta que o
   * produz é nossa.
   */
  if (!comandoPermitido(agregado.status, "atribuir-responsavel")) {
    throw recusaDeTransicao(carregada, ctx);
  }

  const resultado = await repositorio.atribuirResponsavel(entrada.ocorrenciaId, {
    responsavelPessoaId: entrada.responsavelPessoaId,
    // **Quem atribuiu é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    atribuidoPorPessoaId: ctx.pessoaId,
    // **O relógio é lido UMA vez**, e o mesmo instante carimba `atribuido_em`, o `encerrada_em` da
    // anterior e `ocorrencias.atualizada_em`.
    em: ctx.agora ?? new Date().toISOString(),
  });

  if (resultado.desfecho === "atribuida") {
    return { ocorrencia: resultado.ocorrencia, reatribuicao: resultado.reatribuicao };
  }

  if (resultado.desfecho === "responsavel-sem-vinculo-ativo") {
    throw new ResponsavelSemVinculoAtivo();
  }

  /**
   * **A corrida entre dois Gestores.** O `23505` em `atribuicoes_vigente_uk` diz que alguém atribuiu entre
   * a nossa leitura e a nossa escrita. **Relemos** para dizer onde a ocorrência está *agora* — que é o que
   * `statusAtual` significa para a tela que vai montar a frase. Mesmo tratamento que `analisarOcorrencia`
   * dá ao `desfecho: "conflito"`.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
