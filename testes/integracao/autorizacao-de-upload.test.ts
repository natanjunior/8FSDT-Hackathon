import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { livroDeAutorizacoesDeUpload } from "@/infraestrutura/repositorios/anexo";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O que só o `COMMIT` prova
 * ============================================================================
 *
 * Este arquivo existe por um motivo e um só: a tabela `autorizacoes_de_upload` é **global de propósito**,
 * e o duplo em memória do teste de aplicação não prova nada sobre isso — ele obedeceria a um escopo se
 * houvesse um. O que se prova aqui é que **não há**: a mesma Pessoa, gravando por duas organizações
 * diferentes, gasta **um** orçamento de 30.
 *
 * **Não é entrada na suíte de isolamento — é o oposto dela.** A suíte prova que A não vê B; aqui se prova
 * que A e B compartilham, e que isso é decisão. Sem este arquivo, a ausência de `organizacao_id` é
 * indistinguível de esquecimento, e a próxima revisão a chama de furo.
 *
 * **A janela deslizante mora no SQL**, e nenhum duplo a exerce: `now() - interval` é do Postgres, e é ele
 * quem decide o que ainda conta.
 */

const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `13a-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let livro: ReturnType<typeof livroDeAutorizacoesDeUpload>;

let pessoaId = "";
let outraPessoaId = "";

beforeAll(async () => {
  // `criarTransacao` lê `BANCO_URL`; a suíte aponta pela `BANCO_URL_TESTE`. Amarrar as duas é o que faz
  // este arquivo exercer a função de verdade, em vez de uma cópia dela montada à mão.
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, [...valores])).rows as L[];

  await aplicarEsquema(consulta);

  livro = livroDeAutorizacoesDeUpload(criarTransacao());

  const [uma] = await consulta<{ id: string }>(
    `insert into pessoas (nome) values ($1) returning id`,
    [`Quem reclama ${SUFIXO}`],
  );
  const [outra] = await consulta<{ id: string }>(
    `insert into pessoas (nome) values ($1) returning id`,
    [`Quem também reclama ${SUFIXO}`],
  );

  pessoaId = uma!.id;
  outraPessoaId = outra!.id;
});

afterAll(async () => {
  await pool?.end();
});

describe("livroDeAutorizacoesDeUpload", () => {
  it("concede até o limite e recusa a próxima, com o tempo até liberar", async () => {
    for (let i = 0; i < 3; i += 1) {
      expect(await livro.registrarSeCouber(pessoaId, 3, 3600)).toEqual({ concedida: true });
    }

    const recusada = await livro.registrarSeCouber(pessoaId, 3, 3600);

    expect(recusada.concedida).toBe(false);
    if (!recusada.concedida) {
      expect(recusada.segundosAteLiberar).toBeGreaterThan(0);
      expect(recusada.segundosAteLiberar).toBeLessThanOrEqual(3600);
    }
  });

  it("a recusa NÃO grava linha — o orçamento não se afunda sozinho", async () => {
    // **`linhas[0]?.total` e não `const [{ total }]`**: com `noUncheckedIndexedAccess` a desestruturação
    // de objeto sobre `L[0]` é erro TS2339 (`Property 'total' does not exist on type '… | undefined'`).
    const linhas = await consulta<{ total: string }>(
      `select count(*)::text as total from autorizacoes_de_upload where pessoa_id = $1`,
      [pessoaId],
    );

    expect(linhas[0]?.total).toBe("3");
  });

  it("pessoas diferentes têm orçamentos independentes", async () => {
    expect(await livro.registrarSeCouber(outraPessoaId, 3, 3600)).toEqual({ concedida: true });
  });

  it("a tabela não tem coluna de organização — o orçamento é da Pessoa e da conta de storage", async () => {
    const colunas = await consulta<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'autorizacoes_de_upload'`,
    );

    expect(colunas.map((c) => c.column_name).sort()).toEqual(["emitida_em", "id", "pessoa_id"]);
  });

  it("a janela é deslizante: o que envelheceu sai da conta e da tabela", async () => {
    await consulta(
      `update autorizacoes_de_upload set emitida_em = now() - interval '2 hours' where pessoa_id = $1`,
      [pessoaId],
    );

    expect(await livro.registrarSeCouber(pessoaId, 3, 3600)).toEqual({ concedida: true });

    const linhas = await consulta<{ total: string }>(
      `select count(*)::text as total from autorizacoes_de_upload where pessoa_id = $1`,
      [pessoaId],
    );

    // As três velhas foram recolhidas pela limpeza oportunista; sobrou a que acabou de entrar.
    expect(linhas[0]?.total).toBe("1");
  });
});
