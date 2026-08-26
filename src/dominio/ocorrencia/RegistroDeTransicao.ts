import { type MotivoCancelamento, type MotivoPausa } from "./Motivos";
import { type StatusOcorrencia } from "./StatusOcorrencia";

/**
 * ============================================================================
 *  O `HistoricoTransicao` da ADR-0001 — objeto de valor **imutável**
 * ============================================================================
 *
 * **A imutabilidade *é* o requisito de auditoria** (`arquitetura.md` §4). Nasce como efeito de um comando
 * e nunca é editado nem apagado: não há `PATCH`, não há `DELETE`, e não pode haver.
 *
 * Os **cinco campos do enunciado (F5)**, um por propriedade, sem serialização: `statusAnterior` ·
 * `statusNovo` · `ocorreuEm` · `autorPessoaId` · `observacao`. O nome do campo de autor é **autor da
 * transição**, e não *"usuário responsável"*, por decisão do glossário — a colisão nº 2 quebrou
 * *"responsável"* em três termos.
 */
export class RegistroDeTransicao {
  private constructor(
    /** A ordem da trilha. `1` é a origem, e **só** a origem tem `statusAnterior` nulo (P1). */
    readonly sequencia: number,
    readonly statusAnterior: StatusOcorrencia | null,
    readonly statusNovo: StatusOcorrencia,
    /** ISO 8601. O agregado não lê relógio: quem chama informa o instante. */
    readonly ocorreuEm: string,
    readonly autorPessoaId: string,
    readonly observacao: string | null,
    readonly motivoPausa: MotivoPausa | null,
    readonly motivoCancelamento: MotivoCancelamento | null,
  ) {
    Object.freeze(this);
  }

  /**
   * **A origem da trilha — a premissa P1.** `statusAnterior` nulo, `sequencia` 1, destino `aberta`.
   * É o registro que a criação da ocorrência grava, e é a razão de `status_anterior` ser anulável.
   */
  static origem(entrada: { ocorreuEm: string; autorPessoaId: string }): RegistroDeTransicao {
    return new RegistroDeTransicao(
      1,
      null,
      "aberta",
      entrada.ocorreuEm,
      entrada.autorPessoaId,
      null,
      null,
      null,
    );
  }
}
