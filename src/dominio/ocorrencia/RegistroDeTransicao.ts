import { type MotivoCancelamento, type MotivoPausa } from "./Motivos";
import { type StatusOcorrencia } from "./StatusOcorrencia";

/** Os oito campos, como o banco os devolve. */
export type DadosDeRegistroDeTransicao = {
  sequencia: number;
  statusAnterior: StatusOcorrencia | null;
  statusNovo: StatusOcorrencia;
  ocorreuEm: string;
  autorPessoaId: string;
  observacao: string | null;
  motivoPausa: MotivoPausa | null;
  motivoCancelamento: MotivoCancelamento | null;
};

/** Uma transição de avanço rotineiro: sem motivo codificado, e com observação opcional (D23). */
export type DadosDeAvanco = {
  sequencia: number;
  statusAnterior: StatusOcorrencia;
  statusNovo: StatusOcorrencia;
  ocorreuEm: string;
  autorPessoaId: string;
  observacao: string | null;
};

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

  /**
   * **A volta do banco.** Transcreve os oito campos sem julgar: quem os gravou foi um comando, e os
   * `CHECK` da migração 005 já os conferiram nos dois sentidos. Reconferir aqui seria a terceira cópia
   * da mesma regra.
   */
  static reconstituir(dados: DadosDeRegistroDeTransicao): RegistroDeTransicao {
    return new RegistroDeTransicao(
      dados.sequencia,
      dados.statusAnterior,
      dados.statusNovo,
      dados.ocorreuEm,
      dados.autorPessoaId,
      dados.observacao,
      dados.motivoPausa,
      dados.motivoCancelamento,
    );
  }

  /**
   * **A transição de avanço rotineiro** — `analisar`, e depois `iniciar-atendimento`, `retomar` e
   * `resolver`. Sem motivo codificado, com observação opcional (D23: *"campo obrigatório em momento
   * rotineiro é preenchido com 'ok' e o dado morre"*).
   *
   * **Ela recusa `pausada` e `cancelada`**, e isso é o `CHECK` `registros_transicao_motivo_ck` expresso
   * em fábrica: nesses dois destinos o banco exige motivo **e** observação, e um registro construído por
   * esta porta não os teria. Os itens 18 e 23 ganham as fábricas próprias.
   */
  static avanco(dados: DadosDeAvanco): RegistroDeTransicao {
    if (dados.statusNovo === "pausada" || dados.statusNovo === "cancelada") {
      throw new Error(
        `avanco não constrói registro para '${dados.statusNovo}': esse destino exige motivo codificado.`,
      );
    }

    return new RegistroDeTransicao(
      dados.sequencia,
      dados.statusAnterior,
      dados.statusNovo,
      dados.ocorreuEm,
      dados.autorPessoaId,
      dados.observacao,
      null,
      null,
    );
  }
}
