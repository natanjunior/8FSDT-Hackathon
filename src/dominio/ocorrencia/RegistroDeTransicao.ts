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
 * Uma transição para `pausada` — **o par de `DadosDeAvanco`**, e a primeira estrutura do Domínio com
 * campo de texto obrigatório.
 *
 * **Não tem `statusNovo`, e a ausência é a decisão.** O destino é sempre `pausada`; recebê-lo abriria
 * a porta para construir um registro de pausa apontando para outro lugar — que é exatamente o que
 * `avanco` **não** consegue fazer para `pausada`, e esta fábrica não deve desfazer.
 *
 * **`observacao` é `string`, não `string | null`** — a **invariante 5** (`arquitetura.md` §4) diz que
 * ela é obrigatória em `pausar` e `cancelar`. Tipo que aceita `null` faria a invariante depender da
 * disciplina de quem chama; assim quem a cobra é o compilador.
 */
export type DadosDePausa = {
  sequencia: number;
  /** **Não é anulável:** só a origem (P1) tem status anterior nulo, e a origem não é uma pausa. */
  statusAnterior: StatusOcorrencia;
  ocorreuEm: string;
  autorPessoaId: string;
  observacao: string;
  motivoPausa: MotivoPausa;
};

/**
 * Uma transição para `cancelada` — **a espelhada de `DadosDePausa`**, e a outra metade do
 * `registros_transicao_motivo_ck` (item 18).
 *
 * **Também não tem `statusNovo`, e pela mesma razão:** o destino é sempre `cancelada`, e recebê-lo
 * abriria a porta para construir um registro de cancelamento apontando para outro lugar.
 *
 * **`observacao` é `string`, não `string | null`** — invariante 5 (`arquitetura.md` §4): ela é
 * obrigatória em `pausar` **e** em `cancelar`. Quem a cobra é o compilador, não a disciplina de quem
 * chama.
 */
export type DadosDeCancelamento = {
  sequencia: number;
  /** **Não é anulável:** só a origem (P1) tem status anterior nulo, e a origem não é um cancelamento. */
  statusAnterior: StatusOcorrencia;
  ocorreuEm: string;
  autorPessoaId: string;
  observacao: string;
  motivoCancelamento: MotivoCancelamento;
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
   * esta porta não os teria. **A de `pausada` existe desde o item 23** — `pausa`, logo abaixo; a de
   * `cancelada` é do item 18 — `cancelamento`, ao fim do arquivo. **As duas recusas continuam aqui, e
   * nenhuma fábrica nova as relaxa.**
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

  /**
   * **A transição para `pausada`** — a segunda fábrica, e a que `avanco` recusa em nome de (item 23).
   *
   * `motivoCancelamento` continua nulo aqui, e é o outro lado do mesmo `CHECK`:
   * `(status_novo = 'cancelada') = (motivo_cancelamento is not null)`. A fábrica espelhada — a do item
   * **18** — existe desde então, logo abaixo: `cancelamento`.
   *
   * **A guarda é `Error`, não `ErroDeDominio`**, pelo mesmo argumento que `avanco` já usa: quem chega
   * aqui passou pelo schema, que recusa `""` com `400`. Alcançá-la é defeito nosso, não caminho de
   * quem usa a API — e sem ela o caminho para a violação seria uma `500` vinda do Postgres em vez de
   * um defeito nomeado.
   */
  static pausa(dados: DadosDePausa): RegistroDeTransicao {
    if (dados.observacao.trim() === "") {
      throw new Error(
        "pausa exige observação não vazia: o CHECK registros_transicao_motivo_ck a cobra, e o tipo " +
          "não distingue '' de texto.",
      );
    }

    return new RegistroDeTransicao(
      dados.sequencia,
      dados.statusAnterior,
      "pausada",
      dados.ocorreuEm,
      dados.autorPessoaId,
      dados.observacao,
      dados.motivoPausa,
      null,
    );
  }

  /**
   * **A transição para `cancelada`** — a terceira fábrica, e a segunda que `avanco` recusa em nome de
   * (item 18). É a **espelhada** de `pausa`, campo a campo.
   *
   * `motivoPausa` é nulo aqui, e `motivoCancelamento` é preenchido: é a outra metade do mesmo `CHECK`,
   * `(status_novo = 'cancelada') = (motivo_cancelamento is not null)`. **Com esta fábrica as duas
   * cláusulas do `registros_transicao_motivo_ck` passam a ter porta em código** — e a terceira, a que
   * proíbe motivo em destino rotineiro, continua sendo `avanco`.
   *
   * **A guarda é `Error`, não `ErroDeDominio`**, pelo mesmo argumento de `avanco` e de `pausa`: quem
   * chega aqui passou pelo `cancelamentoSchema`, que recusa `""` com `400`. Alcançá-la é defeito nosso,
   * não caminho de quem usa a API — e sem ela o caminho para a violação seria uma `500` vinda do
   * Postgres em vez de um defeito nomeado.
   */
  static cancelamento(dados: DadosDeCancelamento): RegistroDeTransicao {
    if (dados.observacao.trim() === "") {
      throw new Error(
        "cancelamento exige observação não vazia: o CHECK registros_transicao_motivo_ck a cobra, e o " +
          "tipo não distingue '' de texto.",
      );
    }

    return new RegistroDeTransicao(
      dados.sequencia,
      dados.statusAnterior,
      "cancelada",
      dados.ocorreuEm,
      dados.autorPessoaId,
      dados.observacao,
      null,
      dados.motivoCancelamento,
    );
  }
}
