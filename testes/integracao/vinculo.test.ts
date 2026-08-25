import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeVinculos } from "@/infraestrutura/repositorios/organizacao";

import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O cadastro e a correção contra Postgres — item 9a
 * ============================================================================
 *
 * **É aqui que este item é provado**, porque tudo que ele promete é garantia do banco: a CTE que impede
 * Pessoa órfã, a FK composta da Área, e o `where usuario_id is null` que faz a guarda ser por campo.
 * Contra um duplo, nada disso seria testado — seria testado o duplo.
 */
const URL_DO_BANCO = process.env.BANCO_URL_TESTE ?? process.env.BANCO_URL;
const SUFIXO = `9a-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

let idOrganizacao = "";
let idGestora = "";
let AREA_ATIVA = "";
let AREA_INATIVA = "";
let AREA_DE_OUTRA_ORGANIZACAO = "";

beforeAll(async () => {
  if (URL_DO_BANCO === undefined || URL_DO_BANCO === "") {
    throw new Error(
      "BANCO_URL_TESTE não definida. Este teste exige Postgres — o que ele mede é a CTE, a FK composta " +
        "e o `where usuario_id is null`. Suba com `npm run local` e rode `npm run teste:integracao`.",
    );
  }

  // `criarTransacao` lê `BANCO_URL`; o teste aponta pela `BANCO_URL_TESTE`. Amarrar as duas é o que faz
  // este arquivo exercer a função de verdade, em vez de uma cópia dela montada à mão.
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);

  // `auth.users` **não é nossa para derrubar**, então o e-mail leva sufixo de execução — e o `id` vai
  // explícito, porque no provedor de verdade aquela coluna não tem `default`.
  const usuarios = await consulta<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`gestora-${SUFIXO}@exemplo.test`],
  );
  const pessoas = await consulta<{ id: string }>(
    `insert into pessoas (usuario_id, nome) values ($1, 'Marina Gestora') returning id`,
    [usuarios[0]!.id],
  );
  idGestora = pessoas[0]!.id;

  const organizacoes = await consulta<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico)
          values ('Condomínio do 9a', $1), ('Outra Organização do 9a', $2)
       returning id`,
    [`A${SUFIXO.slice(-7).toUpperCase()}`, `B${SUFIXO.slice(-7).toUpperCase()}`],
  );
  idOrganizacao = organizacoes[0]!.id;
  const idOutraOrganizacao = organizacoes[1]!.id;

  await consulta(
    `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
    [idGestora, idOrganizacao],
  );

  const areas = await consulta<{ id: string }>(
    `insert into areas (organizacao_id, nome, tipo, ativa, ordem)
          values ($1, 'Bloco A', 'privativa', true,  1),
                 ($1, 'Bloco Z', 'privativa', false, 2)
       returning id`,
    [idOrganizacao],
  );
  AREA_ATIVA = areas[0]!.id;
  AREA_INATIVA = areas[1]!.id;

  const daOutra = await consulta<{ id: string }>(
    `insert into areas (organizacao_id, nome, tipo, ativa, ordem)
          values ($1, 'Sala da outra', 'privativa', true, 1)
       returning id`,
    [idOutraOrganizacao],
  );
  AREA_DE_OUTRA_ORGANIZACAO = daOutra[0]!.id;
});

afterAll(async () => {
  if (pool !== undefined) {
    await consulta(`delete from auth.users where email like $1`, [`%-${SUFIXO}@exemplo.test`]).catch(
      () => undefined,
    );
    await pool.end();
  }
});

function repositorio() {
  return repositorioEscopadoDeVinculos(
    escoparConsulta(consulta, idOrganizacao),
    escoparTransacao(criarTransacao(), idOrganizacao),
  );
}

async function contarPessoas(): Promise<number> {
  const linhas = await consulta<{ total: string }>(`select count(*) as total from pessoas`);
  return Number(linhas[0]!.total);
}

describe("POST /vinculos — Pessoa e Vínculo na mesma transação", () => {
  it("cria as duas linhas e devolve o vínculo, com temConta false", async () => {
    const resultado = await repositorio().cadastrar({
      nome: "Sebastião Alves de Moura",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });

    expect(resultado.desfecho).toBe("cadastrado");
    if (resultado.desfecho !== "cadastrado") return;

    expect(resultado.vinculo.pessoa.nome).toBe("Sebastião Alves de Moura");
    expect(resultado.vinculo.papel).toBe("encarregado");
    expect(resultado.vinculo.temConta).toBe(false);
    expect(resultado.vinculo.area).toBeNull();
    expect(resultado.vinculo.pessoa.contatos).toStrictEqual([]);

    const linhas = await consulta<{ usuario_id: string | null }>(
      `select usuario_id from pessoas where id = $1`,
      [resultado.vinculo.pessoa.pessoaId],
    );
    expect(linhas[0]?.usuario_id).toBeNull();
  });

  it("dois cadastros com o mesmo nome produzem DUAS Pessoas — nunca reaproveita", async () => {
    const repos = repositorio();
    const um = await repos.cadastrar({ nome: "Antônio Ferreira", papel: "encarregado", areaId: null, contatos: [] });
    const dois = await repos.cadastrar({ nome: "Antônio Ferreira", papel: "encarregado", areaId: null, contatos: [] });

    expect(um.desfecho).toBe("cadastrado");
    expect(dois.desfecho).toBe("cadastrado");
    if (um.desfecho !== "cadastrado" || dois.desfecho !== "cadastrado") return;
    expect(um.vinculo.pessoa.pessoaId).not.toBe(dois.vinculo.pessoa.pessoaId);

    const contagem = await consulta<{ contagem: string }>(
      `select count(*) as contagem from pessoas where nome = $1`,
      ["Antônio Ferreira"],
    );
    expect(contagem[0]?.contagem).toBe("2");
  });

  it("grava a unidade quando ela é informada", async () => {
    const resultado = await repositorio().cadastrar({
      nome: "Zelador com unidade",
      papel: "encarregado",
      areaId: AREA_ATIVA,
      contatos: [],
    });
    expect(resultado.desfecho).toBe("cadastrado");
    if (resultado.desfecho !== "cadastrado") return;
    expect(resultado.vinculo.area?.id).toBe(AREA_ATIVA);
  });

  /**
   * Área inválida e Pessoa órfã são a mesma pergunta.
   *
   * **E o que este caso prova é a conferência prévia, não a CTE** — precisão da revisão de 23/08/2026:
   * `areaVale` roda **antes** do `INSERT` e devolve `area-invalida` sem escrever nada, então a Área
   * inativa nunca chega à instrução. O `rollback` da CTE cobre a corrida — a Área desativada entre o
   * `select` e o `insert` —, que nenhum teste alcança. **A propriedade medida aqui continua sendo a que o
   * critério 1 pede** (`422` não deixa Pessoa órfã); só não é a CTE que a produz neste caminho.
   */
  it("área inativa recusa, e NÃO deixa Pessoa órfã", async () => {
    const antes = await contarPessoas();
    const resultado = await repositorio().cadastrar({
      nome: "Nunca deveria existir",
      papel: "encarregado",
      areaId: AREA_INATIVA,
      contatos: [],
    });

    expect(resultado.desfecho).toBe("area-invalida");
    expect(await contarPessoas()).toBe(antes);
  });

  it("área de outra organização recusa com a MESMA resposta da inativa", async () => {
    const resultado = await repositorio().cadastrar({
      nome: "Também não",
      papel: "encarregado",
      areaId: AREA_DE_OUTRA_ORGANIZACAO,
      contatos: [],
    });
    expect(resultado.desfecho).toBe("area-invalida");
  });
});

describe("PATCH /vinculos/{pessoaId} — a guarda nomeia campos, não o endpoint", () => {
  it("corrige nome e unidade de quem NÃO tem conta", async () => {
    const criado = await repositorio().cadastrar({
      nome: "Nome errado",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error("cenário não montou");

    const resultado = await repositorio().corrigir({
      pessoaId: criado.vinculo.pessoa.pessoaId,
      nome: "Nome certo",
      areaId: AREA_ATIVA,
    });

    expect(resultado.desfecho).toBe("corrigido");
    if (resultado.desfecho !== "corrigido") return;
    expect(resultado.vinculo.pessoa.nome).toBe("Nome certo");
    expect(resultado.vinculo.area?.id).toBe(AREA_ATIVA);
  });

  it("nome de quem TEM conta é recusado", async () => {
    const resultado = await repositorio().corrigir({ pessoaId: idGestora, nome: "Outro nome" });
    expect(resultado.desfecho).toBe("pessoa-com-conta");
  });

  /** **O critério 3, na metade que surpreende.** `areaId` não está sob a guarda. */
  it("unidade de quem TEM conta é aceita — areaId pertence ao Vínculo", async () => {
    const resultado = await repositorio().corrigir({ pessoaId: idGestora, areaId: AREA_ATIVA });

    expect(resultado.desfecho).toBe("corrigido");
    if (resultado.desfecho !== "corrigido") return;
    expect(resultado.vinculo.area?.id).toBe(AREA_ATIVA);
    expect(resultado.vinculo.temConta).toBe(true);
  });

  it("areaId null tira a unidade", async () => {
    await repositorio().corrigir({ pessoaId: idGestora, areaId: AREA_ATIVA });
    const resultado = await repositorio().corrigir({ pessoaId: idGestora, areaId: null });

    expect(resultado.desfecho).toBe("corrigido");
    if (resultado.desfecho !== "corrigido") return;
    expect(resultado.vinculo.area).toBeNull();
  });

  it("Pessoa sem vínculo nesta organização é nao-encontrado", async () => {
    const resultado = await repositorio().corrigir({
      pessoaId: "00000000-0000-4000-8000-000000000000",
      nome: "Ninguém",
    });
    expect(resultado.desfecho).toBe("nao-encontrado");
  });

  it("área inválida na correção recusa, e o nome NÃO fica gravado pela metade", async () => {
    const criado = await repositorio().cadastrar({
      nome: "Antes",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error("cenário não montou");

    const resultado = await repositorio().corrigir({
      pessoaId: criado.vinculo.pessoa.pessoaId,
      nome: "Depois",
      areaId: AREA_INATIVA,
    });

    expect(resultado.desfecho).toBe("area-invalida");
    const lido = await repositorio().porPessoa(criado.vinculo.pessoa.pessoaId);
    expect(lido?.pessoa.nome).toBe("Antes");
  });
});

describe("GET /vinculos — a leitura", () => {
  it("traz area, temConta, criadoEm e contatos, ordenado por nome", async () => {
    const ativos = await repositorio().ativos();

    expect(ativos.length).toBeGreaterThan(0);
    for (const vinculo of ativos) {
      expect(vinculo).toHaveProperty("area");
      expect(typeof vinculo.temConta).toBe("boolean");
      expect(typeof vinculo.criadoEm).toBe("string");
      expect(Array.isArray(vinculo.pessoa.contatos)).toBe(true);
    }

    // **Cuidado ao acrescentar nomes a este cenário.** `pessoas.nome` é `varchar(120)` **sem `collate`**
    // — ao contrário de `areas.nome` e `organizacoes.nome`, que são `pt-BR-x-icu` —, então o `order by
    // p.nome` usa a colação padrão do banco, e ela **não** é `localeCompare("pt-BR")`. Com os nomes deste
    // cenário as duas ordens coincidem; um par como "Álvaro"/"Bruno" as separaria sob colação `C`. Se
    // esta asserção começar a falhar, o defeito é o `collate` que falta na coluna — achado, não o teste.
    const nomes = ativos.map((v) => v.pessoa.nome);
    expect(nomes).toStrictEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("porPessoa devolve null para quem não tem vínculo aqui", async () => {
    expect(await repositorio().porPessoa("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
