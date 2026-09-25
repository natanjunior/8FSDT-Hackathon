import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O `--apagar` da demonstração, e a porta nomeada do gatilho da trilha (item 74)
 * ============================================================================
 *
 * **O que só o banco prova.** O gatilho `registros_transicao_append_only_tg` recusa `update` e `delete`, e a
 * migração 013 lhe deu uma exceção: `delete` passa quando a transação liga
 * `resolveai.remocao_da_demonstracao = 'sim'` com `set_config(..., true)`. Que o valor morra com a
 * transação, no `commit` e no `rollback`, é comportamento do Postgres, e duplo nenhum o afirma.
 *
 * **O pool de uma conexão só é o ponto dos casos do gatilho.** Com `max: 1`, a transação seguinte roda
 * obrigatoriamente na mesma conexão da anterior, que é onde um `set_config` de sessão vazaria.
 *
 * **As organizações nascem por `insert`, não pelo agregado**, como em `dashboard.test.ts`: o que se
 * prova aqui é a remoção, e quem prova transição é `ocorrencia.test.ts`. A trilha de cada ocorrência é um
 * registro só, o de criação (premissa P1).
 */

const URL_DO_BANCO = urlDoBancoDeTeste();

/** `auth.users` não é nossa para derrubar, e o e-mail tem índice único: sufixo de execução e contador. */
const SUFIXO = `${Date.now()}`;
let contador = 0;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

beforeAll(async () => {
  // `criarTransacao` lê `BANCO_URL`. Amarrar as duas é o que faz o teste exercer a remoção de verdade.
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);
});

afterAll(async () => {
  if (pool !== undefined) {
    await consulta(`delete from auth.users where email like $1`, [`%-${SUFIXO}@exemplo.test`]).catch(
      () => undefined,
    );
    await pool.end();
  }
});

/** Um e-mail novo por chamada, que nenhuma execução anterior deixou em `auth.users`. */
function emailNovo(quem: string): string {
  contador += 1;
  return `${quem}-${String(contador)}-${SUFIXO}@exemplo.test`;
}

type Fundada = {
  readonly organizacaoId: string;
  readonly codigoPublico: string;
  readonly ocorrencias: readonly string[];
};

/**
 * Uma organização com fundador de conta, área, categoria e `quantas` ocorrências, cada uma com o seu
 * registro de criação na trilha.
 *
 * `email === null` funda **sem** `criada_por_pessoa_id`: a coluna é anulável (migração 001), e é o homônimo
 * sem fundador do foco de revisão 3.
 */
async function fundar(nome: string, email: string | null, quantas: number): Promise<Fundada> {
  contador += 1;
  const codigoPublico = `REM${String(contador)}${SUFIXO.slice(-6)}`;

  const organizacaoId = (
    await consulta<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [nome, codigoPublico],
    )
  )[0]!.id;

  const usuarioId = (
    await consulta<{ id: string }>(
      `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
      [email ?? emailNovo("sem-fundador")],
    )
  )[0]!.id;

  const pessoaId = (
    await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, 'Fundadora') returning id`,
      [usuarioId],
    )
  )[0]!.id;

  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`, [
    pessoaId,
    organizacaoId,
  ]);

  // A FK composta para `vinculos` é diferida: com o vínculo já gravado, o `update` passa no seu `commit`.
  if (email !== null) {
    await consulta(`update organizacoes set criada_por_pessoa_id = $1 where id = $2`, [
      pessoaId,
      organizacaoId,
    ]);
  }

  const areaId = (
    await consulta<{ id: string }>(
      `insert into areas (organizacao_id, nome, tipo, ordem) values ($1, 'Hall', 'comum', 1) returning id`,
      [organizacaoId],
    )
  )[0]!.id;

  const categoriaId = (
    await consulta<{ id: string }>(
      `insert into categorias (organizacao_id, nome, icone, ativa, ordem)
            values ($1, 'Vazamento', 'tag', true, 1) returning id`,
      [organizacaoId],
    )
  )[0]!.id;

  const ocorrencias: string[] = [];
  for (let i = 1; i <= quantas; i += 1) {
    const ocorrenciaId = (
      await consulta<{ id: string }>(
        `insert into ocorrencias
              (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id)
              values ($1, $2, $3, 'comum', $4, 'Mundo da remoção.', $5) returning id`,
        [organizacaoId, categoriaId, areaId, `Goteira ${String(i)}`, pessoaId],
      )
    )[0]!.id;

    await consulta(
      `insert into registros_transicao
            (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
            values ($1, $2, 1, null, 'aberta', $3)`,
      [organizacaoId, ocorrenciaId, pessoaId],
    );
    ocorrencias.push(ocorrenciaId);
  }

  return { organizacaoId, codigoPublico, ocorrencias };
}

/** Quantas linhas de `tabela` ainda carregam `organizacaoId`. */
async function contar(tabela: string, organizacaoId: string): Promise<number> {
  const [linha] = await consulta<{ n: number }>(
    `select count(*)::int as n from ${tabela} where organizacao_id = $1`,
    [organizacaoId],
  );
  return linha!.n;
}

// ---------------------------------------------------------------------------

describe("o gatilho da trilha: a porta nomeada, e só ela", () => {
  let mundo: Fundada;
  /** Uma conexão só: a transação seguinte é obrigatoriamente na mesma conexão da anterior. */
  let umaConexao: Pool;

  beforeAll(async () => {
    mundo = await fundar("Condomínio do Gatilho", emailNovo("gatilho"), 3);
    umaConexao = new Pool({ connectionString: URL_DO_BANCO, max: 1 });
  });

  afterAll(async () => {
    await umaConexao.end();
  });

  it("1.1 · com a variável ligada na transação, o delete na trilha passa", async () => {
    const cliente = await umaConexao.connect();
    try {
      await cliente.query("begin");
      await cliente.query(`select set_config('resolveai.remocao_da_demonstracao', 'sim', true)`);
      const apagadas = await cliente.query(`delete from registros_transicao where ocorrencia_id = $1`, [
        mundo.ocorrencias[0],
      ]);
      await cliente.query("commit");
      expect(apagadas.rowCount).toBe(1);
    } finally {
      cliente.release();
    }
  });

  it("1.2 · depois do commit, na MESMA conexão, o delete volta a ser recusado", async () => {
    const cliente = await umaConexao.connect();
    try {
      const { rows } = await cliente.query<{ valor: string | null }>(
        `select current_setting('resolveai.remocao_da_demonstracao', true) as valor`,
      );
      expect(rows[0]?.valor).not.toBe("sim");

      await expect(
        cliente.query(`delete from registros_transicao where ocorrencia_id = $1`, [mundo.ocorrencias[1]]),
      ).rejects.toThrow(/append-only/u);
    } finally {
      cliente.release();
    }
    expect(await contar("registros_transicao", mundo.organizacaoId)).toBe(2);
  });

  it("1.3 · a transação que liga a variável e falha no meio volta atrás, e a recusa continua", async () => {
    const cliente = await umaConexao.connect();
    try {
      await cliente.query("begin");
      await cliente.query(`select set_config('resolveai.remocao_da_demonstracao', 'sim', true)`);
      await expect(cliente.query("select 1 / 0")).rejects.toThrow();
      await cliente.query("rollback");

      await expect(
        cliente.query(`delete from registros_transicao where ocorrencia_id = $1`, [mundo.ocorrencias[1]]),
      ).rejects.toThrow(/append-only/u);
    } finally {
      cliente.release();
    }
    expect(await contar("registros_transicao", mundo.organizacaoId)).toBe(2);
  });

  it("1.4 · com a variável ligada, update na trilha continua recusado", async () => {
    const cliente = await umaConexao.connect();
    try {
      await cliente.query("begin");
      await cliente.query(`select set_config('resolveai.remocao_da_demonstracao', 'sim', true)`);
      await expect(
        cliente.query(`update registros_transicao set observacao = 'editado' where ocorrencia_id = $1`, [
          mundo.ocorrencias[2],
        ]),
      ).rejects.toThrow(/append-only/u);
      await cliente.query("rollback");
    } finally {
      cliente.release();
    }
  });

  it("1.5 · com a variável em outro valor, o delete é recusado", async () => {
    const cliente = await umaConexao.connect();
    try {
      await cliente.query("begin");
      await cliente.query(`select set_config('resolveai.remocao_da_demonstracao', 'talvez', true)`);
      await expect(
        cliente.query(`delete from registros_transicao where ocorrencia_id = $1`, [mundo.ocorrencias[2]]),
      ).rejects.toThrow(/append-only/u);
      await cliente.query("rollback");
    } finally {
      cliente.release();
    }
  });
});
