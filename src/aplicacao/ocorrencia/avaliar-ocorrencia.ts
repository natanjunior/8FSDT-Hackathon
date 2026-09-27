import { comandoPermitido } from "@/dominio/ocorrencia";

import {
  recusaPorAvaliacaoExigeResolvida,
  recusaPorJaAvaliada,
  recusaPorNaoSerOAutor,
  type ContextoDoComando,
} from "./comando";
import { participaDaOcorrencia, recusaDeQuemNaoParticipa } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `avaliar` — o DÉCIMO comando do produto, e o último
 * ============================================================================
 *
 * **É o único comando que o Solicitante executa sobre uma ocorrência encerrada.** Os outros nove são do
 * Gestor ou do autor **antes** do fim; este age sobre `resolvida`, que é terminal, **sem tirá-la de lá**
 * (D1: *"não é um sexto estado"*). É a **única medida de qualidade que o produto tem**, e o objetivo
 * **O4** — *"≥ 60% das resolvidas avaliadas"* — depende inteiro de ela ser fácil de dar.
 *
 * **Cinco recusas, e é a maior escada do produto** — `cancelar` tem quatro:
 *
 * ```
 * 403 PERMISSAO_INSUFICIENTE (no comContexto, antes de ler o recurso — só o Encarregado)
 *  └─ 404 OCORRENCIA_NAO_ENCONTRADA        — não existe nesta organização, ou não é visível
 *      └─ 403 SOMENTE_O_AUTOR_PODE_AVALIAR — lê, mas não é o autor
 *          └─ 409 AVALIACAO_EXIGE_RESOLVIDA — status ≠ resolvida
 *              └─ 409 JA_AVALIADA           — a avaliação já existe
 *                  └─ escrita
 * ```
 *
 * **A ordem é a §6.2 do contrato lida de cima para baixo**, com o `404` do que não se pode ler **antes**
 * do `403` do que não é seu (§6.3). Um Solicitante que tente avaliar a ocorrência de outra pessoa leva
 * `404`; um **Gestor** que tente leva `403`, porque ele **pode** ler.
 *
 * **`comandoPermitido`, nunca `transicaoPermitida`.** `TRANSICOES.resolvida` é vazia, e a segunda
 * responderia `false` nos seis estados. Os cinco estados recusados saem de **uma** fonte:
 * `SEM_TRANSICAO.avaliar`, que a `arquitetura.md:238` normatiza. **Não há segunda lista.**
 *
 * **A autoria é conferida DUAS vezes, e as duas são necessárias.** Aqui, para produzir o `403` com código
 * de contrato; e dentro do agregado, como guarda `Error` — porque `autorPessoaId` é campo dele e a
 * invariante 8 o inclui (`arquitetura.md:288`). **Não é duplicação de regra:** é a repartição que o
 * produto pratica em todos os comandos — o agregado guarda, a Aplicação recusa. A diferença deste é que
 * o agregado tem o fato na mão e não precisa recebê-lo de fora.
 *
 * **Quem transforma `""` em `null` é este arquivo**, e é onde o produto pôs isso desde o `analisar`:
 * *"string vazia gravada é ruído que não se apaga depois"* — e aqui vale mais, porque a coluna congela
 * junto com o estado terminal.
 *
 * **O relógio é lido UMA vez** e vai para os dois usos — o objeto de valor e o `atualizada_em`. Dois
 * relógios produziriam uma ocorrência atualizada milissegundos **antes** da avaliação que a atualizou, e
 * aqui isso é pior que feio: o `CHECK (avaliada_em >= registrada_em)` transforma relógio errado em erro
 * de banco.
 */
export async function avaliarOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; nota: number; comentario?: string | null },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  const agregado = carregada.ocorrencia;

  /**
   * **A conferência de participação, e aqui ela NÃO é redundante** — como em `cancelar`, e ao contrário
   * dos comandos do Gestor. Quem tem `ocorrencia.avaliar` pode ser um Solicitante **sem** `ler_todas`:
   * ele tenta avaliar a ocorrência de outra pessoa e leva `404`, nunca `403`, e nunca a confirmação de
   * que ela existe (§6.3).
   */
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  // Quem participa age; quem só recebeu leva `403`, e quem não alcança leva `404` (item 87).
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw await recusaDeQuemNaoParticipa(repositorio, entrada.ocorrenciaId, quem.pessoaId);
  }

  // **O degrau que só o Gestor alcança.** Quem chega aqui pôde LER a ocorrência; se não é o autor, a
  // recusa tem código próprio — é a §4.5 do contrato, camada "relação com o recurso".
  if (agregado.autorPessoaId !== ctx.pessoaId) {
    throw recusaPorNaoSerOAutor(carregada, ctx);
  }

  if (!comandoPermitido(agregado.status, "avaliar")) {
    throw recusaPorAvaliacaoExigeResolvida(carregada, ctx);
  }

  // **A metade "uma vez só" da invariante 8.** O fato está na raiz desde o item 27, e é o mesmo que
  // `acoesQueRestam` lê para tirar `avaliar` do corpo dos `409`.
  if (agregado.avaliacao !== null) {
    throw recusaPorJaAvaliada(carregada, ctx);
  }

  const agora = ctx.agora ?? new Date().toISOString();

  // **O agregado decide o valor gravado**, e a porta transcreve. A instância NOVA é a que viaja: dela
  // saem as três colunas do `set` e o status do predicado, que este comando preserva.
  // **A normalização mora aqui, num lugar só, e é a MESMA forma do `analisar`** (`:47-56`): apara
  // primeiro, decide depois. `""` e `"   "` viram `null`, e o que sobra vai **aparado** — escrever
  // `entrada.comentario?.trim() === "" ? null : entrada.comentario` gravaria `"  texto  "` com as bordas,
  // e a única defesa seria o `.trim()` do schema, que só existe no caminho HTTP.
  const comentario = entrada.comentario?.trim();

  const avaliada = agregado.avaliar({
    autorPessoaId: ctx.pessoaId,
    nota: entrada.nota,
    comentario: comentario === undefined || comentario === "" ? null : comentario,
    avaliadaEm: agora,
  });

  const resultado = await repositorio.avaliar(entrada.ocorrenciaId, avaliada, agora);
  if (resultado.desfecho === "avaliada") return resultado.ocorrencia;

  /**
   * **A corrida das duas abas.** O `update … and avaliacao_nota is null` não achou linha: alguém avaliou
   * entre a nossa leitura e a nossa escrita. **Relemos** para dizer o que é verdade *agora*.
   *
   * **Hoje só o primeiro ramo é alcançável** — `resolvida` é terminal, e nada tira a ocorrência de lá. O
   * segundo existe porque a tradução sai de **um lugar só**: escrever `throw recusaPorJaAvaliada(...)`
   * direto embutiria no `catch` de corrida um fato que vem de outro módulo, e o dia em que um sétimo
   * estado nascer o erro passaria a mentir.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  if (atual.ocorrencia.avaliacao !== null) throw recusaPorJaAvaliada(atual, ctx);
  throw recusaPorAvaliacaoExigeResolvida(atual, ctx);
}
