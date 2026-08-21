import type { Consulta } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  O ponto único de estrangulamento, no lado de fora
 * ============================================================================
 *
 * A ADR-0003 divide o isolamento em dois pontos e **somente dois**:
 *
 * 1. **Resolução** — quem descobre em qual organização se está. Mora na camada de **Aplicação**
 *    (`aplicacao/contexto/resolver-contexto.ts`), porque exige consultar `vinculos`.
 * 2. **Aplicação do filtro** — o `organizacao_id` entrando na consulta. Mora **aqui**, e é o que a
 *    ADR-0006 reservou para `infraestrutura/contexto/`.
 *
 * O compromisso da ADR-0003 é *"o filtro é aplicado em uma função"*. Esta é a função:
 * `escoparConsulta` amarra a organização ativa a **`$1` de toda consulta escopada**, e o repositório
 * escopado não recebe o identificador — ele não tem como escrever o filtro errado, porque não tem o valor.
 */

/**
 * Uma consulta em que **`$1` é sempre a organização ativa**. Os parâmetros de quem chama começam em `$2`.
 */
export interface ConsultaEscopada {
  <L extends object>(sql: string, valores?: readonly unknown[]): Promise<L[]>;
}

/** Recusa de uma consulta escopada que não referencia o escopo. */
export class ConsultaSemEscopo extends Error {
  constructor(sql: string) {
    super(
      "Consulta escopada que não referencia $1 — a organização ativa. " +
        "Toda consulta que sai do repositório escopado tem de filtrar pela organização (ADR-0003). " +
        `SQL recusado: ${sql.replace(/\s+/gu, " ").trim().slice(0, 200)}`,
    );
    this.name = "ConsultaSemEscopo";
  }
}

/**
 * Amarra a organização ativa ao `$1` de toda consulta feita através do valor devolvido.
 *
 * **A trava, e o que ela alcança.** A consulta que não mencionar `$1` é **recusada em tempo de execução**,
 * aqui, com erro nomeado. Isso é alarme, não garantia: prova que `$1` é referenciado, não que ele está no
 * `where` da coluna certa. A garantia continua sendo estrutural — o repositório escopado **não recebe** o
 * identificador da organização, e portanto não consegue escrever um filtro com outro valor. É a mesma
 * assimetria da ADR-0005: estrutura garante, mecanismo avisa.
 */
export function escoparConsulta(consulta: Consulta, organizacaoId: string): ConsultaEscopada {
  return <L extends object>(sql: string, valores: readonly unknown[] = []): Promise<L[]> => {
    if (!/\$1\b/u.test(sql)) throw new ConsultaSemEscopo(sql);
    return consulta<L>(sql, [organizacaoId, ...valores]);
  };
}
