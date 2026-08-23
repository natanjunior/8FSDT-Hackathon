import { describe, expect, it } from "vitest";

import type { Consulta, Transacao } from "@/infraestrutura/clientes";
import { ConsultaSemEscopo, escoparTransacao } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  A trava do `$1`, na forma transacional
 * ============================================================================
 *
 * `escoparConsulta` já garante que **toda** consulta escopada referencia `$1` — a organização ativa. A
 * transação escopada precisa da mesma garantia, e o risco é maior: uma escrita sem escopo não devolve
 * dado de outra organização, ela **grava** numa.
 *
 * **Sem banco, e é o ponto:** o que está sob teste é o embrulho, não o Postgres. A `Transacao` recebida
 * é um duplo que executa o trabalho passando a própria função de consulta.
 */

/**
 * Uma `Transacao` de mentira: executa o trabalho e registra o que passou pela consulta.
 *
 * **Ela é `async`, e isso não é estilo.** A trava do escopo lança **sincronamente**, dentro do `trabalho`;
 * numa função que não é `async`, a exceção sobe pela pilha em vez de virar promessa rejeitada, e
 * `expect(...).rejects` nunca chega a receber o valor — o teste falha ao avaliar o argumento. A
 * `criarTransacao` de verdade é `async` (`clientes/banco.ts`), então o duplo síncrono seria mais frágil
 * que o original: provaria uma diferença do duplo.
 */
function transacaoFalsa(registro: Array<{ sql: string; valores: readonly unknown[] }>): Transacao {
  const consulta: Consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) => {
    registro.push({ sql, valores });
    return [] as L[];
  };
  return async <T>(trabalho: (c: Consulta) => Promise<T>) => trabalho(consulta);
}

describe("escoparTransacao", () => {
  it("amarra a organização ao $1 de toda consulta feita dentro dela", async () => {
    const registro: Array<{ sql: string; valores: readonly unknown[] }> = [];
    const emTransacao = escoparTransacao(transacaoFalsa(registro), "org-a");

    await emTransacao(async (consulta) => {
      await consulta(
        `update pedidos_de_entrada set situacao = 'aprovado'
                       where organizacao_id = $1 and id = $2`,
        ["pedido-1"],
      );
      await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($2, $1, $3)`, [
        "pessoa-1",
        "gestor",
      ]);
    });

    expect(registro).toHaveLength(2);
    expect(registro[0]!.valores).toStrictEqual(["org-a", "pedido-1"]);
    expect(registro[1]!.valores).toStrictEqual(["org-a", "pessoa-1", "gestor"]);
  });

  it("recusa consulta que não referencia o escopo", async () => {
    const emTransacao = escoparTransacao(transacaoFalsa([]), "org-a");

    await expect(
      emTransacao((consulta) => consulta(`update vinculos set papel = 'gestor' where pessoa_id = $2`, [])),
    ).rejects.toThrow(ConsultaSemEscopo);
  });

  it("devolve o que o trabalho devolveu", async () => {
    const emTransacao = escoparTransacao(transacaoFalsa([]), "org-a");
    const resultado = await emTransacao(async (consulta) => {
      await consulta(`select 1 from organizacoes where id = $1`);
      return "pronto";
    });

    expect(resultado).toBe("pronto");
  });
});
