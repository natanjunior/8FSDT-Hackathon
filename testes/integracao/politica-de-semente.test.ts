import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CodigoPublicoEmUso } from "@/aplicacao/organizacao";
import { criarTransacao } from "@/infraestrutura/clientes";
import { repositorioDeOrganizacoes } from "@/infraestrutura/repositorios/organizacao";
import { AREAS_SEMENTE, CATEGORIAS_SEMENTE } from "@/dominio/organizacao";

import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  A POL-01 contra Postgres — e a única coisa que só o banco prova
 * ============================================================================
 *
 * A ADR-0008 diz que o grupo 2 — *uma prova por garantia estrutural* — **cresce com migração nova e com
 * porta nova**. Esta linha traz as duas, e o que ela precisa provar não cabe em duplo:
 *
 * 1. **A FK diferida funciona.** `organizacoes.criada_por_pessoa_id` referencia `vinculos`, que é inserido
 *    DEPOIS. Só o `COMMIT` diz se a ordem está certa.
 * 2. **Semente que falha não deixa organização nascer** (critério 2.4). Rollback não tem duplo.
 * 3. **`criado_por_pessoa_id` fica nulo nas linhas de semente** — quem as criou foi a política.
 */

const URL_DO_BANCO = process.env.BANCO_URL_TESTE ?? process.env.BANCO_URL;
const SUFIXO = `${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let idDaSindica: string;

beforeAll(async () => {
  if (URL_DO_BANCO === undefined || URL_DO_BANCO === "") {
    throw new Error(
      "BANCO_URL_TESTE não definida. Este teste exige Postgres — o que ele mede é o COMMIT. " +
        "Suba com `npm run local` e rode `npm run teste:integracao`.",
    );
  }

  // `criarTransacao` lê `BANCO_URL`, e o teste pode estar apontando para outro banco pela
  // `BANCO_URL_TESTE`. Amarrar as duas aqui é o que faz o teste exercer a função de verdade, em vez de
  // uma cópia dela montada à mão sobre o pool do próprio arquivo.
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);

  // A Pessoa que funda. `auth.users` NÃO é nossa para derrubar, então o e-mail leva sufixo de execução.
  const usuarios = await consulta<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`sindica-${SUFIXO}@exemplo.test`],
  );
  const pessoas = await consulta<{ id: string }>(
    `insert into pessoas (usuario_id, nome) values ($1, $2) returning id`,
    [usuarios[0]!.id, "Helena Rocha"],
  );
  idDaSindica = pessoas[0]!.id;
});

afterAll(async () => {
  if (pool !== undefined) {
    await consulta(`delete from auth.users where email like $1`, [`%-${SUFIXO}@exemplo.test`]).catch(
      () => undefined,
    );
    await pool.end();
  }
});

// ---------------------------------------------------------------------------

describe("a POL-01 cria as quatro coisas juntas", () => {
  it("devolve as duas contagens, e o banco tem exatamente o que elas dizem", async () => {
    const repositorio = repositorioDeOrganizacoes(criarTransacao());

    const criada = await repositorio.criar({
      nome: `Condomínio Recanto Azul ${SUFIXO}`,
      codigoPublico: "RECANT79",
      criadaPorPessoaId: idDaSindica,
      categorias: CATEGORIAS_SEMENTE,
      areas: AREAS_SEMENTE,
    });

    expect(criada.categoriasSemeadas).toBe(7);
    expect(criada.areasSemeadas).toBe(2);
    expect(criada.codigoPublico).toBe("RECANT79");

    const categorias = await consulta<{ nome: string; icone: string; ativa: boolean; ordem: number }>(
      `select nome, icone, ativa, ordem from categorias where organizacao_id = $1 order by ordem`,
      [criada.id],
    );
    expect(categorias.map((c) => c.nome)).toStrictEqual(CATEGORIAS_SEMENTE.map((c) => c.nome));
    expect(categorias.map((c) => c.icone)).toStrictEqual(CATEGORIAS_SEMENTE.map((c) => c.icone));
    expect(categorias.every((c) => c.ativa)).toBe(true);

    const areas = await consulta<{ nome: string; tipo: string; ativa: boolean }>(
      `select nome, tipo, ativa from areas where organizacao_id = $1 order by ordem`,
      [criada.id],
    );
    expect(areas.map((a) => a.tipo)).toStrictEqual(["comum", "privativa"]);
    expect(areas.every((a) => a.ativa)).toBe(true);
  });

  /** Critério 1.2, do lado do banco: quem chamou passa a ter vínculo `gestor`. */
  it("dá a quem chamou o vínculo de Gestor, e grava quem fundou", async () => {
    const repositorio = repositorioDeOrganizacoes(criarTransacao());

    const criada = await repositorio.criar({
      nome: `Edifício Aurora ${SUFIXO}`,
      codigoPublico: "AURORA47",
      criadaPorPessoaId: idDaSindica,
      categorias: CATEGORIAS_SEMENTE,
      areas: AREAS_SEMENTE,
    });

    const vinculos = await consulta<{ papel: string; revogado_em: Date | null }>(
      `select papel, revogado_em from vinculos where organizacao_id = $1`,
      [criada.id],
    );
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0]!.papel).toBe("gestor");
    expect(vinculos[0]!.revogado_em).toBeNull();

    // A FK composta DIFERIDA passou no COMMIT — é a única prova de que a ordem das inserções está certa.
    const organizacoes = await consulta<{ criada_por_pessoa_id: string }>(
      `select criada_por_pessoa_id from organizacoes where id = $1`,
      [criada.id],
    );
    expect(organizacoes[0]!.criada_por_pessoa_id).toBe(idDaSindica);
  });

  /** Critério 2.4, segunda metade: quem criou a semente foi a política, não uma pessoa clicando. */
  it("deixa a autoria nula nas linhas de semente", async () => {
    const repositorio = repositorioDeOrganizacoes(criarTransacao());

    const criada = await repositorio.criar({
      nome: `Residencial Cerejeiras ${SUFIXO}`,
      codigoPublico: "CEREJA52",
      criadaPorPessoaId: idDaSindica,
      categorias: CATEGORIAS_SEMENTE,
      areas: AREAS_SEMENTE,
    });

    const soltas = await consulta<{ contagem: string }>(
      `select count(*) as contagem
         from (select criado_por_pessoa_id, atualizado_por_pessoa_id from categorias where organizacao_id = $1
               union all
               select criado_por_pessoa_id, atualizado_por_pessoa_id from areas where organizacao_id = $1) as s
        where criado_por_pessoa_id is not null or atualizado_por_pessoa_id is not null`,
      [criada.id],
    );
    expect(soltas[0]!.contagem).toBe("0");
  });
});

describe("a atomicidade — critério 2.4, primeira metade", () => {
  /**
   * **Não existe organização com zero categorias.** A semente com nome repetido viola
   * `categorias_organizacao_nome_uk` no meio da transação; o que este teste mede é se a organização
   * inserida ANTES some junto.
   */
  it("semente que falha não deixa organização nascer", async () => {
    const repositorio = repositorioDeOrganizacoes(criarTransacao());
    const codigo = "FALHAR22";

    await expect(
      repositorio.criar({
        nome: `Organização Fantasma ${SUFIXO}`,
        codigoPublico: codigo,
        criadaPorPessoaId: idDaSindica,
        categorias: [
          { nome: "Repetida", icone: "shield", ordem: 1 },
          { nome: "Repetida", icone: "wrench", ordem: 2 },
        ],
        areas: AREAS_SEMENTE,
      }),
    ).rejects.toThrow();

    const sobrou = await consulta<{ contagem: string }>(
      `select count(*) as contagem from organizacoes where codigo_publico = $1`,
      [codigo],
    );
    expect(sobrou[0]!.contagem).toBe("0");
  });

  it("código repetido vira a recusa nomeada, e nada fica para trás", async () => {
    const repositorio = repositorioDeOrganizacoes(criarTransacao());

    await repositorio.criar({
      nome: `Primeira ${SUFIXO}`,
      codigoPublico: "DUPLIC33",
      criadaPorPessoaId: idDaSindica,
      categorias: CATEGORIAS_SEMENTE,
      areas: AREAS_SEMENTE,
    });

    await expect(
      repositorio.criar({
        nome: `Segunda ${SUFIXO}`,
        codigoPublico: "DUPLIC33",
        criadaPorPessoaId: idDaSindica,
        categorias: CATEGORIAS_SEMENTE,
        areas: AREAS_SEMENTE,
      }),
    ).rejects.toBeInstanceOf(CodigoPublicoEmUso);

    const comOCodigo = await consulta<{ contagem: string }>(
      `select count(*) as contagem from organizacoes where codigo_publico = $1`,
      ["DUPLIC33"],
    );
    expect(comOCodigo[0]!.contagem).toBe("1");
  });
});
