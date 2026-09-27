import { transicaoPermitida } from "@/dominio/ocorrencia";

import { recusaDeTransicao, type ContextoDoComando } from "./comando";
import { participaDaOcorrencia } from "./consultas";
import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias } from "./portas";

/**
 * ============================================================================
 *  `analisar` — o primeiro comando do produto, e o molde dos outros dez
 * ============================================================================
 *
 * **Função, não objeto de caso de uso** (`arquitetura.md` §5.4). Recebe **a porta** como argumento — uma
 * só, ao contrário de `registrarOcorrencia`, que coordena quatro.
 *
 * **As duas guardas não são duas cópias da regra: são a mesma `transicaoPermitida` com dois chamadores.**
 * A daqui existe porque o **corpo** do `409` depende de quem pergunta — `acoesDisponiveis` deriva das
 * permissões do chamador, e o agregado não conhece permissão. A do agregado existe porque a invariante 1
 * é estrutural: sem ela, qualquer chamador futuro que esqueça a conferência move o status.
 *
 * **A ordem das recusas é `404` antes de `409`**; o `403` já aconteceu no `comContexto`, antes de o
 * recurso ser lido (critério 16.4).
 */
export async function analisarOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  ctx: ContextoDoComando,
  entrada: { ocorrenciaId: string; observacao?: string | null },
): Promise<OcorrenciaLida> {
  const carregada = await repositorio.carregar(entrada.ocorrenciaId);
  if (carregada === null) throw new OcorrenciaNaoEncontrada();
  // **O agregado sai do envelope; o fato fica nele.** `analisar` não usa `temResponsavel` para decidir
  // nada — ele o repassa a `recusaDeTransicao`, que é quem monta `acoesDisponiveis`.
  const agregado = carregada.ocorrencia;

  // **A conferência de visibilidade continua rodando, mesmo sendo hoje redundante** — quem tem
  // `ocorrencia.analisar` tem `ocorrencia.ler_todas` no mesmo papel. Amarrar a leitura à análise por
  // coincidência de mapa é o tipo de acoplamento que some quando o mapa muda (contrato §4.5).
  const quem = {
    pessoaId: ctx.pessoaId,
    podeLerTodas: ctx.permissoes.includes("ocorrencia.ler_todas"),
  };
  if (!participaDaOcorrencia(agregado.autorPessoaId, quem)) {
    throw new OcorrenciaNaoEncontrada();
  }

  if (!transicaoPermitida(agregado.status, "analisar")) throw recusaDeTransicao(carregada, ctx);

  const observacao = entrada.observacao?.trim();

  const analisada = agregado.analisar({
    // **O autor da transição é quem chamou.** Nunca vem do corpo, e não há campo para ele no schema.
    autorPessoaId: ctx.pessoaId,
    ocorreuEm: ctx.agora ?? new Date().toISOString(),
    // Mesmo tratamento de `localizacaoComplemento` no registro: string vazia gravada numa trilha
    // append-only é ruído que não se apaga depois.
    observacao: observacao === undefined || observacao === "" ? null : observacao,
  });

  const resultado = await repositorio.aplicarTransicao(entrada.ocorrenciaId, analisada);
  if (resultado.desfecho === "aplicada") return resultado.ocorrencia;

  /**
   * **A corrida entre dois Gestores** (contrato §7.9). O `update … where status = 'aberta'` não achou
   * linha: alguém analisou entre a nossa leitura e a nossa escrita. **Relemos** para dizer onde a
   * ocorrência está *agora*, e não onde estava quando começamos — que é o que `statusAtual` significa
   * para a tela que vai montar a frase.
   */
  const atual = await repositorio.carregar(entrada.ocorrenciaId);
  if (atual === null) throw new OcorrenciaNaoEncontrada();
  throw recusaDeTransicao(atual, ctx);
}
