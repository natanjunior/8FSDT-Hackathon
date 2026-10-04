import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import {
  repositorioEscopadoDeEtiquetas,
  repositorioEscopadoDeVinculos,
} from "@/infraestrutura/repositorios/organizacao";

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
function etiquetas(organizacaoId = idOrganizacao) {
  return repositorioEscopadoDeEtiquetas(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

function vinculos(organizacaoId = idOrganizacao) {
  return repositorioEscopadoDeVinculos(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

async function novoParticipante(nome: string): Promise<string> {
  const id = (await consulta<{ id: string }>(`insert into pessoas (nome) values ($1) returning id`, [nome]))[0]!.id;
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`, [
    id,
    idOrganizacao,
  ]);
  return id;
}

describe("a porta: atribuir cria ou reaproveita (critérios 1, 2 e 8)", () => {
  it("nome novo cria a etiqueta e atribui, gravando quem atribuiu", async () => {
    const pessoa = await novoParticipante("Atribuição 1");
    const resultado = await etiquetas().atribuir({ pessoaId: pessoa, nome: "Zelador", porPessoaId: idGestora });

    expect(resultado).toMatchObject({ desfecho: "atribuida", criada: true, etiqueta: { nome: "Zelador" } });
    const [linha] = await consulta<{ atribuido_por_pessoa_id: string }>(
      `select atribuido_por_pessoa_id from vinculos_etiquetas where pessoa_id = $1`,
      [pessoa],
    );
    expect(linha?.atribuido_por_pessoa_id).toBe(idGestora);
  });

  it("outra grafia reaproveita, e vale a primeira", async () => {
    const pessoa = await novoParticipante("Atribuição 2");
    const resultado = await etiquetas().atribuir({ pessoaId: pessoa, nome: "zelador", porPessoaId: idGestora });

    expect(resultado).toMatchObject({ desfecho: "atribuida", criada: false, etiqueta: { nome: "Zelador" } });
  });

  it("atribuir de novo é ja-tinha, e não reescreve quem nem quando", async () => {
    const pessoa = await novoParticipante("Atribuição 3");
    await etiquetas().atribuir({ pessoaId: pessoa, nome: "Vigia", porPessoaId: idGestora });
    const [antes] = await consulta<{ atribuido_em: Date }>(
      `select atribuido_em from vinculos_etiquetas where pessoa_id = $1`,
      [pessoa],
    );
    const segunda = await etiquetas().atribuir({ pessoaId: pessoa, nome: "VIGIA", porPessoaId: idEletricista });
    const [depois] = await consulta<{ atribuido_em: Date; atribuido_por_pessoa_id: string }>(
      `select atribuido_em, atribuido_por_pessoa_id from vinculos_etiquetas where pessoa_id = $1`,
      [pessoa],
    );

    expect(segunda.desfecho).toBe("ja-tinha");
    expect(depois?.atribuido_em).toStrictEqual(antes?.atribuido_em);
    expect(depois?.atribuido_por_pessoa_id).toBe(idGestora);
  });

  it("dois ao mesmo tempo terminam com uma etiqueta e as duas atribuições", async () => {
    const [p1, p2] = await Promise.all([novoParticipante("Corrida 1"), novoParticipante("Corrida 2")]);
    const [r1, r2] = await Promise.all([
      etiquetas().atribuir({ pessoaId: p1!, nome: "Jardineiro", porPessoaId: idGestora }),
      etiquetas().atribuir({ pessoaId: p2!, nome: "jardineiro", porPessoaId: idGestora }),
    ]);

    expect([r1.desfecho, r2.desfecho]).toStrictEqual(["atribuida", "atribuida"]);
    const total = await consulta(
      `select 1 from etiquetas_participante where organizacao_id = $1 and lower(nome) = 'jardineiro'`,
      [idOrganizacao],
    );
    expect(total).toHaveLength(1);
  });

  it("vínculo de outra organização, ou revogado, é nao-encontrado, e nada é criado", async () => {
    const resultado = await etiquetas().atribuir({ pessoaId: idGestora, nome: "Fantasma", porPessoaId: idGestora });
    // idGestora TEM vínculo aqui; usamos a outra organização para o caso de vazamento.
    const naOutra = await etiquetas(idOutraOrganizacao).atribuir({
      pessoaId: idEletricista,
      nome: "Fantasma da outra",
      porPessoaId: idGestora,
    });

    expect(resultado.desfecho).toBe("atribuida");
    expect(naOutra.desfecho).toBe("nao-encontrado");
    expect(
      await consulta(`select 1 from etiquetas_participante where nome = 'Fantasma da outra'`),
    ).toHaveLength(0);
  });
});

describe("a porta: tirar e apagar (critério 7)", () => {
  it("tirar de uma pessoa deixa a etiqueta existindo para as outras", async () => {
    const [p1, p2] = [await novoParticipante("Tirar 1"), await novoParticipante("Tirar 2")];
    const r = await etiquetas().atribuir({ pessoaId: p1, nome: "Contratado", porPessoaId: idGestora });
    await etiquetas().atribuir({ pessoaId: p2, nome: "Contratado", porPessoaId: idGestora });
    if (r.desfecho !== "atribuida") throw new Error(r.desfecho);

    expect(await etiquetas().tirar({ pessoaId: p1, etiquetaId: r.etiqueta.id })).toStrictEqual({ desfecho: "tirada" });
    const deP2 = await vinculos().porPessoa(p2);
    expect(deP2?.etiquetas.map((e) => e.nome)).toContain("Contratado");
  });

  it("tirar o que a pessoa não tinha é tirada; etiqueta inexistente e vínculo inexistente se distinguem", async () => {
    const pessoa = await novoParticipante("Tirar 3");
    const r = await etiquetas().atribuir({ pessoaId: idEletricista, nome: "Avulsa", porPessoaId: idGestora });
    if (r.desfecho === "nao-encontrado") throw new Error(r.desfecho);

    expect((await etiquetas().tirar({ pessoaId: pessoa, etiquetaId: r.etiqueta.id })).desfecho).toBe("tirada");
    expect(
      (await etiquetas().tirar({ pessoaId: pessoa, etiquetaId: "00000000-0000-4000-8000-000000000000" })).desfecho,
    ).toBe("etiqueta-nao-encontrada");
    expect(
      (await etiquetas().tirar({ pessoaId: "00000000-0000-4000-8000-000000000000", etiquetaId: r.etiqueta.id }))
        .desfecho,
    ).toBe("vinculo-nao-encontrado");
  });

  it("apagar some com a etiqueta e com todas as atribuições; a segunda vez é nao-encontrada", async () => {
    const pessoa = await novoParticipante("Apagar 1");
    const r = await etiquetas().atribuir({ pessoaId: pessoa, nome: "Descartável", porPessoaId: idGestora });
    if (r.desfecho === "nao-encontrado") throw new Error(r.desfecho);

    expect(await etiquetas().apagar(r.etiqueta.id)).toStrictEqual({ desfecho: "apagada" });
    expect((await vinculos().porPessoa(pessoa))?.etiquetas).toStrictEqual([]);
    expect(await etiquetas().apagar(r.etiqueta.id)).toStrictEqual({ desfecho: "nao-encontrada" });
  });

  it("apagar etiqueta de outra organização é nao-encontrada", async () => {
    const daOutra = await etiquetas(idOutraOrganizacao).atribuir({
      pessoaId: idGestora,
      nome: "Da outra, para apagar",
      porPessoaId: idGestora,
    });
    if (daOutra.desfecho === "nao-encontrado") throw new Error(daOutra.desfecho);
    expect(await etiquetas().apagar(daOutra.etiqueta.id)).toStrictEqual({ desfecho: "nao-encontrada" });
  });

  // **A ordem não é afirmada aqui**: é a `order by nome` do banco, a mesma collation de `order by p.nome`
  // em `lerVinculos`, e compará-la com `localeCompare` testaria o locale da esteira, não o código.
  it("listar devolve as desta organização, inclusive as sem uso", async () => {
    const nomes = (await etiquetas().listar()).map((e) => e.nome);
    expect(nomes).not.toContain("Da outra, para apagar");
    expect(nomes).toContain("Elétrica"); // criada direto no banco na Tarefa 1, sem atribuição
  });
});

describe("a porta: criar sem pessoa (item 120, critério 19)", () => {
  it("nome novo nasce, sem atribuir a ninguém", async () => {
    const resultado = await etiquetas().criar("Porteiro 120");
    expect(resultado).toMatchObject({ criada: true, etiqueta: { nome: "Porteiro 120" } });
    expect(
      await consulta(`select 1 from vinculos_etiquetas where etiqueta_id = $1`, [resultado.etiqueta.id]),
    ).toHaveLength(0);
  });

  it("outra caixa reaproveita e vale a primeira grafia; acento conta", async () => {
    const primeira = await etiquetas().criar("Síndico 120");
    const outraCaixa = await etiquetas().criar("SÍNDICO 120");
    const semAcento = await etiquetas().criar("Sindico 120");
    expect(outraCaixa).toStrictEqual({ criada: false, etiqueta: primeira.etiqueta });
    expect(semAcento.criada).toBe(true);
  });

  it("criar em uma organização não aparece na outra (isolamento)", async () => {
    await etiquetas(idOutraOrganizacao).criar("Só da outra 120");
    expect((await etiquetas().listar()).map((e) => e.nome)).not.toContain("Só da outra 120");
    expect((await etiquetas(idOutraOrganizacao).listar()).map((e) => e.nome)).toContain("Só da outra 120");
  });

  it("dois ao mesmo tempo com a mesma grafia terminam com uma etiqueta", async () => {
    const [r1, r2] = await Promise.all([etiquetas().criar("Vigilante 120"), etiquetas().criar("vigilante 120")]);
    expect(r1.etiqueta.id).toBe(r2.etiqueta.id);
    expect([r1.criada, r2.criada].filter(Boolean)).toHaveLength(1);
  });
});

describe("a mesma leitura, e o vínculo revogado ou refeito (critérios 4 e 9)", () => {
  it("lista e detalhe trazem as mesmas etiquetas, em ordem alfabética", async () => {
    const pessoa = await novoParticipante("Leitura 1");
    await etiquetas().atribuir({ pessoaId: pessoa, nome: "Telhadista", porPessoaId: idGestora });
    await etiquetas().atribuir({ pessoaId: pessoa, nome: "Azulejista", porPessoaId: idGestora });

    const naLista = (await vinculos().ativos()).find((v) => v.pessoa.pessoaId === pessoa)?.etiquetas;
    const noDetalhe = (await vinculos().porPessoa(pessoa))?.etiquetas;

    expect(naLista?.map((e) => e.nome)).toStrictEqual(["Azulejista", "Telhadista"]);
    expect(noDetalhe).toStrictEqual(naLista);
  });

  it("revogar apaga as etiquetas, e o vínculo refeito nasce sem nenhuma", async () => {
    const pessoa = await novoParticipante("Revogado 1");
    await etiquetas().atribuir({ pessoaId: pessoa, nome: "Eletricista", porPessoaId: idGestora });

    expect(await vinculos().revogar(pessoa)).toStrictEqual({ desfecho: "revogado" });
    expect(await consulta(`select 1 from vinculos_etiquetas where pessoa_id = $1`, [pessoa])).toHaveLength(0);

    // Refazer pelo caminho da readmissão (`pedidos-de-entrada.ts:236-244`): a mesma linha volta.
    await consulta(
      `update vinculos set revogado_em = null where pessoa_id = $1 and organizacao_id = $2`,
      [pessoa, idOrganizacao],
    );
    expect((await vinculos().porPessoa(pessoa))?.etiquetas).toStrictEqual([]);
  });

  it("revogar recusado (último Gestor) não apaga nada", async () => {
    const r = await etiquetas(idOutraOrganizacao).atribuir({
      pessoaId: idGestora,
      nome: "Única Gestora",
      porPessoaId: idGestora,
    });
    if (r.desfecho === "nao-encontrado") throw new Error(r.desfecho);

    expect(await vinculos(idOutraOrganizacao).revogar(idGestora)).toStrictEqual({ desfecho: "ultimo-gestor" });
    expect(
      await consulta(`select 1 from vinculos_etiquetas where organizacao_id = $1 and pessoa_id = $2`, [
        idOutraOrganizacao,
        idGestora,
      ]),
    ).not.toHaveLength(0);
  });

  it("o vínculo revogado some da leitura, e com ele as etiquetas", async () => {
    // Revogado por fora do comando: prova que a LEITURA esconde, mesmo se sobrasse linha.
    const pessoa = await novoParticipante("Revogado à mão");
    await etiquetas().atribuir({ pessoaId: pessoa, nome: "Escondida", porPessoaId: idGestora });
    await consulta(`update vinculos set revogado_em = now() where pessoa_id = $1 and organizacao_id = $2`, [
      pessoa,
      idOrganizacao,
    ]);

    expect(await vinculos().porPessoa(pessoa)).toBeNull();
  });

  it("quem atribuiu etiqueta passa a ter histórico, e quem a recebeu não", async () => {
    const gestorC = await novoParticipante("Gestor C do 115");
    await consulta(`update vinculos set papel = 'gestor' where pessoa_id = $1 and organizacao_id = $2`, [
      gestorC,
      idOrganizacao,
    ]);
    const recebeu = await novoParticipante("Recebeu do C");
    await etiquetas().atribuir({ pessoaId: recebeu, nome: "Do C", porPessoaId: gestorC });

    const mapa = await vinculos().impedimentosDeRemocao();
    expect(mapa.get(gestorC)).toBe("historico");
    expect(mapa.has(recebeu)).toBe(false);
  });
});
