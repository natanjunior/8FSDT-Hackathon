import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  NOME_DA_ORGANIZACAO_A,
  NOME_DA_ORGANIZACAO_B,
  PERFIL_DA_DEMONSTRACAO,
  PERFIL_DE_TESTE,
} from "@semente/plano";
import { apagarADemonstracao, hostDoBanco, organizacoesDaDemonstracao } from "@semente/remocao";

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
  /** A Fundadora, gestora e autora das ocorrências. Exposta desde o item 87, que compartilha uma delas. */
  readonly pessoaId: string;
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

  return { organizacaoId, codigoPublico, pessoaId, ocorrencias };
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

// ---------------------------------------------------------------------------

/** Todas as tabelas com `organizacao_id` que a remoção precisa esvaziar, mais as duas do fim. */
const TABELAS_COM_ORGANIZACAO = [
  "compartilhamentos",
  "mensagens",
  "canais_conversa",
  "anexos",
  "atribuicoes",
  "registros_transicao",
  "ocorrencias",
  "pedidos_de_entrada",
  "mudancas_de_configuracao",
  "categorias",
  "areas",
  "vinculos",
] as const;

async function nadaSobrou(organizacaoId: string): Promise<void> {
  for (const tabela of TABELAS_COM_ORGANIZACAO) {
    expect(await contar(tabela, organizacaoId), tabela).toBe(0);
  }
  const [linha] = await consulta<{ n: number }>(`select count(*)::int as n from organizacoes where id = $1`, [
    organizacaoId,
  ]);
  expect(linha!.n).toBe(0);
}

describe("a remoção da demonstração: nome e autoria, e nada além", () => {
  /** As duas contas desta execução, no lugar das contas reais da demonstração, que existem no local. */
  let emails: readonly [string, string];

  beforeEach(async () => {
    // Os dois nomes são fixos: sem esquema novo, o homônimo de um caso seria homônimo no seguinte.
    await aplicarEsquema(consulta);
    emails = [emailNovo("helena"), emailNovo("marcos")];
  });

  it("2.1 · apaga as duas organizações inteiras, com trilha, e mantém as contas", async () => {
    const recanto = await fundar(NOME_DA_ORGANIZACAO_A, emails[0], 3);
    const aurora = await fundar(NOME_DA_ORGANIZACAO_B, emails[1], 4);

    // **Um compartilhamento no Recanto (item 87).** O mundo de `fundar` tem uma pessoa só por
    // organização, então a vizinha nasce aqui — e sem esta linha a tabela nova nunca teria linha para a
    // remoção esquecer.
    const vizinha = (
      await consulta<{ id: string }>(
        `insert into pessoas (nome) values ('Vizinha da remoção') returning id`,
      )
    )[0]!.id;
    await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`, [
      vizinha,
      recanto.organizacaoId,
    ]);
    await consulta(
      `insert into compartilhamentos (organizacao_id, ocorrencia_id, com_pessoa_id, por_pessoa_id)
       values ($1, $2, $3, $4)`,
      [recanto.organizacaoId, recanto.ocorrencias[0], vizinha, recanto.pessoaId],
    );
    expect(await contar("compartilhamentos", recanto.organizacaoId)).toBe(1);

    const resultado = await apagarADemonstracao(emails);

    expect(resultado.organizacoes).toBe(2);
    expect(resultado.homonimas).toStrictEqual([]);
    await nadaSobrou(recanto.organizacaoId);
    await nadaSobrou(aurora.organizacaoId);

    // As Pessoas com conta sobrevivem: a próxima semeadura as reaproveita (`remocao.ts`, cabeçalho).
    const contas = await consulta<{ n: number }>(
      `select count(*)::int as n from pessoas p join auth.users u on u.id = p.usuario_id
        where u.email = any($1::text[])`,
      [[...emails]],
    );
    expect(contas[0]!.n).toBe(2);
  });

  it("2.2 · depois da remoção, um delete na trilha em transação nova é recusado", async () => {
    await fundar(NOME_DA_ORGANIZACAO_A, emails[0], 1);
    const outra = await fundar("Residencial de Fora", emailNovo("fora"), 1);

    await apagarADemonstracao(emails);

    await expect(
      consulta(`delete from registros_transicao where organizacao_id = $1`, [outra.organizacaoId]),
    ).rejects.toThrow(/append-only/u);
  });

  it("2.3 · uma organização de outro nome, com trilha, fica inteira", async () => {
    await fundar(NOME_DA_ORGANIZACAO_B, emails[1], 2);
    // E-mail novo: `fundar` cria a conta, e `auth.users.email` é único.
    const outra = await fundar("Residencial de Fora", emailNovo("fora"), 2);

    await apagarADemonstracao(emails);

    expect(await contar("ocorrencias", outra.organizacaoId)).toBe(2);
    expect(await contar("registros_transicao", outra.organizacaoId)).toBe(2);
    expect(await contar("vinculos", outra.organizacaoId)).toBe(1);
  });

  it("2.4 · o homônimo fica inteiro, com ou sem fundador, e volta nomeado", async () => {
    const aurora = await fundar(NOME_DA_ORGANIZACAO_B, emails[1], 1);
    const deTerceiro = await fundar(NOME_DA_ORGANIZACAO_B, emailNovo("terceiro"), 2);
    const semFundador = await fundar(NOME_DA_ORGANIZACAO_A, null, 1);

    const resultado = await apagarADemonstracao(emails);

    expect(resultado.organizacoes).toBe(1);
    await nadaSobrou(aurora.organizacaoId);
    expect(await contar("registros_transicao", deTerceiro.organizacaoId)).toBe(2);
    expect(await contar("registros_transicao", semFundador.organizacaoId)).toBe(1);
    expect(new Set(resultado.homonimas.map((o) => o.codigoPublico))).toStrictEqual(
      new Set([deTerceiro.codigoPublico, semFundador.codigoPublico]),
    );
  });

  it("2.5 · rodar duas vezes: a segunda encontra zero e não falha", async () => {
    await fundar(NOME_DA_ORGANIZACAO_A, emails[0], 1);

    expect((await apagarADemonstracao(emails)).organizacoes).toBe(1);
    expect(await apagarADemonstracao(emails)).toStrictEqual({ organizacoes: 0, pessoas: 0, homonimas: [] });
  });

  it("2.6 · o reconhecimento separa a demonstração do homônimo, com a contagem de ocorrências", async () => {
    const recanto = await fundar(NOME_DA_ORGANIZACAO_A, emails[0], 3);
    const deTerceiro = await fundar(NOME_DA_ORGANIZACAO_A, emailNovo("terceiro"), 1);

    const { daDemonstracao, homonimas } = await organizacoesDaDemonstracao(emails);

    expect(daDemonstracao.map((o) => [o.id, o.ocorrencias])).toStrictEqual([[recanto.organizacaoId, 3]]);
    expect(homonimas.map((o) => [o.id, o.ocorrencias])).toStrictEqual([[deTerceiro.organizacaoId, 1]]);
  });

  it("2.9 · apaga a organização cuja configuração já foi editada por um Gestor", async () => {
    const aurora = await fundar(NOME_DA_ORGANIZACAO_B, emails[1], 1);
    // O que `PATCH /organizacao` grava (`organizacao-escopada.ts:37`). A FK da migração 010 não é diferida.
    await consulta(
      `update organizacoes set atualizado_por_pessoa_id = criada_por_pessoa_id where id = $1`,
      [aurora.organizacaoId],
    );
    // **E uma mudança de REGRA (item 99)**, que o gatilho da 017 transforma numa linha da trilha. Sem
    // ela a tabela nova nunca teria linha nesta organização, e o `nadaSobrou` provaria zero contra zero.
    await consulta(
      `update organizacoes
          set exigir_solucao_ao_resolver = true,
              atualizado_por_pessoa_id = criada_por_pessoa_id
        where id = $1`,
      [aurora.organizacaoId],
    );
    expect(await contar("mudancas_de_configuracao", aurora.organizacaoId)).toBe(1);

    expect((await apagarADemonstracao(emails)).organizacoes).toBe(1);
    await nadaSobrou(aurora.organizacaoId);
  });

  it("2.10 · apagar o mundo de teste não toca a demonstração, e o inverso também", async () => {
    const nomesDoTeste = [PERFIL_DE_TESTE.organizacoes.a, PERFIL_DE_TESTE.organizacoes.b];
    const emailsDoTeste = [emailNovo("helena-teste"), emailNovo("marcos-teste")] as const;

    const recanto = await fundar(NOME_DA_ORGANIZACAO_A, emails[0], 2);
    const recantoDoTeste = await fundar(PERFIL_DE_TESTE.organizacoes.a, emailsDoTeste[0], 3);

    const doTeste = await organizacoesDaDemonstracao(emailsDoTeste, nomesDoTeste);
    expect(doTeste.daDemonstracao.map((o) => o.id)).toStrictEqual([recantoDoTeste.organizacaoId]);
    expect(doTeste.homonimas).toStrictEqual([]);

    expect((await apagarADemonstracao(emailsDoTeste, nomesDoTeste)).organizacoes).toBe(1);
    await nadaSobrou(recantoDoTeste.organizacaoId);

    const daDemo = await organizacoesDaDemonstracao(emails);
    expect(daDemo.daDemonstracao.map((o) => [o.id, o.ocorrencias])).toStrictEqual([[recanto.organizacaoId, 2]]);
  });

  it("2.11 · os nomes e as contas anteriores também são da demonstração, e o homônimo antigo fica", async () => {
    // `NOMES_DA_DEMONSTRACAO` (o padrão da remoção) traz os anteriores; as contas vêm do teste, porque
    // as anteriores reais existem no `auth.users` local.
    const nomeAnterior = PERFIL_DA_DEMONSTRACAO.anteriores.organizacoes[1]!;
    const contaAnterior = emailNovo("marcos-anterior");

    const atual = await fundar(NOME_DA_ORGANIZACAO_B, emails[1], 1);
    const antiga = await fundar(nomeAnterior, contaAnterior, 2);
    const homonimaAntiga = await fundar(nomeAnterior, emailNovo("terceiro"), 1);

    const resultado = await apagarADemonstracao([...emails, contaAnterior]);

    expect(resultado.organizacoes).toBe(2);
    await nadaSobrou(atual.organizacaoId);
    await nadaSobrou(antiga.organizacaoId);
    expect(resultado.homonimas.map((o) => o.id)).toStrictEqual([homonimaAntiga.organizacaoId]);
    expect(await contar("registros_transicao", homonimaAntiga.organizacaoId)).toBe(1);
  });
});

describe("hostDoBanco: o que o --apagar imprime antes de apagar", () => {
  it("2.7 · devolve host e porta, sem usuário nem senha", () => {
    const impresso = hostDoBanco("postgresql://postgres:s3gr3d0@db.exemplo.supabase.co:6543/postgres");
    expect(impresso).toBe("db.exemplo.supabase.co:6543");
    expect(impresso).not.toContain("s3gr3d0");
    expect(impresso).not.toContain("postgres@");
  });

  it("2.8 · sem porta na URL, só o host; sem URL, diz que falta", () => {
    expect(hostDoBanco("postgresql://u:p@127.0.0.1/postgres")).toBe("127.0.0.1");
    expect(hostDoBanco(undefined)).toBe("(BANCO_URL não definida)");
    expect(hostDoBanco("isto não é url")).toBe("(BANCO_URL ilegível)");
  });
});
