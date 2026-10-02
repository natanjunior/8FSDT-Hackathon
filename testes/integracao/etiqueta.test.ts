import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  As etiquetas dos participantes — item 115
 * ============================================================================
 *
 * **O que o banco garante, provado no banco** (critérios 2, 3, 8 e 9): a unicidade por grafia, o teto de
 * 30, a chave composta que recusa etiqueta de outra organização, e as três cascatas. A porta vem na
 * Tarefa 2, neste mesmo arquivo.
 */

const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `115-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

let idOrganizacao = "";
let idOutraOrganizacao = "";
let idGestora = "";
let idEletricista = "";

beforeAll(async () => {
  process.env.BANCO_URL = URL_DO_BANCO;
  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);

  const usuarios = await consulta<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`gestora-${SUFIXO}@exemplo.test`],
  );
  idGestora = (
    await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, 'Gestora do 115') returning id`,
      [usuarios[0]!.id],
    )
  )[0]!.id;
  idEletricista = (
    await consulta<{ id: string }>(`insert into pessoas (nome) values ('Encarregado do 115') returning id`)
  )[0]!.id;

  const organizacoes = await consulta<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico) values ('Condomínio do 115', $1), ('Outra do 115', $2)
     returning id`,
    [`E${SUFIXO.slice(-7).toUpperCase()}`, `F${SUFIXO.slice(-7).toUpperCase()}`],
  );
  idOrganizacao = organizacoes[0]!.id;
  idOutraOrganizacao = organizacoes[1]!.id;

  await consulta(
    `insert into vinculos (pessoa_id, organizacao_id, papel)
          values ($1, $3, 'gestor'), ($2, $3, 'encarregado'), ($1, $4, 'gestor')`,
    [idGestora, idEletricista, idOrganizacao, idOutraOrganizacao],
  );
});

afterAll(async () => {
  await pool.end();
});

async function criarEtiqueta(organizacaoId: string, nome: string): Promise<string> {
  const linhas = await consulta<{ id: string }>(
    `insert into etiquetas_participante (organizacao_id, nome) values ($1, $2) returning id`,
    [organizacaoId, nome],
  );
  return linhas[0]!.id;
}

describe("o banco garante a etiqueta (critérios 2 e 3)", () => {
  it("maiúscula não faz outra etiqueta, nem fora do ASCII", async () => {
    await criarEtiqueta(idOrganizacao, "ÉLETRICISTA");
    await expect(criarEtiqueta(idOrganizacao, "életricista")).rejects.toThrow(/etiquetas_participante_nome_uq/u);
  });

  it("acento conta: Elétrica e Eletrica são duas", async () => {
    await criarEtiqueta(idOrganizacao, "Elétrica");
    await expect(criarEtiqueta(idOrganizacao, "Eletrica")).resolves.toBeTypeOf("string");
  });

  it("a mesma grafia em outra organização é outra etiqueta", async () => {
    await criarEtiqueta(idOrganizacao, "Pintor");
    await expect(criarEtiqueta(idOutraOrganizacao, "Pintor")).resolves.toBeTypeOf("string");
  });

  it("31 caracteres, vazio e espaço nas pontas são recusados pelo check", async () => {
    await expect(criarEtiqueta(idOrganizacao, "a".repeat(31))).rejects.toThrow(/etiquetas_participante_nome_ck/u);
    await expect(criarEtiqueta(idOrganizacao, "")).rejects.toThrow(/etiquetas_participante_nome_ck/u);
    await expect(criarEtiqueta(idOrganizacao, " Pedreiro")).rejects.toThrow(/etiquetas_participante_aparado_ck/u);
    await expect(criarEtiqueta(idOrganizacao, "a".repeat(30))).resolves.toBeTypeOf("string");
  });
});

describe("a junção (critérios 7, 8 e 9)", () => {
  it("recusa etiqueta de outra organização, pela chave composta", async () => {
    const daOutra = await criarEtiqueta(idOutraOrganizacao, "Só da outra");
    await expect(
      consulta(
        `insert into vinculos_etiquetas (pessoa_id, organizacao_id, etiqueta_id, atribuido_por_pessoa_id)
              values ($1, $2, $3, $4)`,
        [idEletricista, idOrganizacao, daOutra, idGestora],
      ),
    ).rejects.toThrow(/vinculos_etiquetas_etiqueta_fk/u);
  });

  it("grava quem atribuiu e quando, e os dois são obrigatórios", async () => {
    const id = await criarEtiqueta(idOrganizacao, "Encanador");
    const [linha] = await consulta<{ atribuido_por_pessoa_id: string; atribuido_em: Date }>(
      `insert into vinculos_etiquetas (pessoa_id, organizacao_id, etiqueta_id, atribuido_por_pessoa_id)
            values ($1, $2, $3, $4)
         returning atribuido_por_pessoa_id, atribuido_em`,
      [idEletricista, idOrganizacao, id, idGestora],
    );
    expect(linha?.atribuido_por_pessoa_id).toBe(idGestora);
    expect(linha?.atribuido_em).toBeInstanceOf(Date);
  });

  it("apagar a etiqueta tira de todo mundo, por cascata", async () => {
    const id = await criarEtiqueta(idOrganizacao, "Prestador");
    await consulta(
      `insert into vinculos_etiquetas (pessoa_id, organizacao_id, etiqueta_id, atribuido_por_pessoa_id)
            values ($1, $3, $4, $1), ($2, $3, $4, $1)`,
      [idGestora, idEletricista, idOrganizacao, id],
    );
    await consulta(`delete from etiquetas_participante where id = $1`, [id]);
    const restantes = await consulta(`select 1 from vinculos_etiquetas where etiqueta_id = $1`, [id]);
    expect(restantes).toHaveLength(0);
  });

  it("remover o vínculo leva as etiquetas dele, por cascata", async () => {
    const pessoa = (
      await consulta<{ id: string }>(`insert into pessoas (nome) values ('Removível do 115') returning id`)
    )[0]!.id;
    await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`, [
      pessoa,
      idOrganizacao,
    ]);
    const id = await criarEtiqueta(idOrganizacao, "Temporário");
    await consulta(
      `insert into vinculos_etiquetas (pessoa_id, organizacao_id, etiqueta_id, atribuido_por_pessoa_id)
            values ($1, $2, $3, $4)`,
      [pessoa, idOrganizacao, id, idGestora],
    );
    await consulta(`delete from vinculos where pessoa_id = $1 and organizacao_id = $2`, [pessoa, idOrganizacao]);
    expect(await consulta(`select 1 from vinculos_etiquetas where pessoa_id = $1`, [pessoa])).toHaveLength(0);
  });

  it("quem atribuiu não sai por remoção: a chave dele é restrict", async () => {
    const gestorB = (
      await consulta<{ id: string }>(`insert into pessoas (nome) values ('Gestor B do 115') returning id`)
    )[0]!.id;
    await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`, [
      gestorB,
      idOrganizacao,
    ]);
    const id = await criarEtiqueta(idOrganizacao, "Atribuída por B");
    await consulta(
      `insert into vinculos_etiquetas (pessoa_id, organizacao_id, etiqueta_id, atribuido_por_pessoa_id)
            values ($1, $2, $3, $4)`,
      [idEletricista, idOrganizacao, id, gestorB],
    );
    await expect(
      consulta(`delete from vinculos where pessoa_id = $1 and organizacao_id = $2`, [gestorB, idOrganizacao]),
    ).rejects.toThrow(/vinculos_etiquetas_atribuido_por_fk/u);
  });
});
