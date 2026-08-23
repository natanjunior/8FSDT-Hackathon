import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import {
  repositorioDePedidosDeEntrada,
  repositorioGlobalDePedidosDeEntrada,
} from "@/infraestrutura/repositorios/organizacao";

import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  `POST /pedidos-de-entrada` contra Postgres
 * ============================================================================
 *
 * Três coisas que **nenhum duplo em memória prova**:
 *
 * 1. **O caso A4 escrito à mão** — código de A não produz pedido em B. É a verificação que a ADR-0003
 *    encomenda por nome para uma das duas escritas que rodam fora do funil de escopo.
 * 2. **O `409 PEDIDO_DE_ENTRADA_PENDENTE`**, que é tradução do índice único **parcial**
 *    `WHERE situacao = 'pendente'` — e um duplo que o simulasse provaria que o duplo simula.
 * 3. **A atomicidade** — pedido recusado não deixa `pessoas.nome` corrigido.
 *
 * **O mundo é o da §7.2:** duas organizações e duas Pessoas, a segunda existindo para provar que a
 * leitura de contexto não devolve pedido de quem não pediu.
 */
const URL_DO_BANCO = process.env.BANCO_URL_TESTE ?? process.env.BANCO_URL;
const SUFIXO = `7a-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let escrita: ReturnType<typeof repositorioDePedidosDeEntrada>;
let leitura: ReturnType<typeof repositorioGlobalDePedidosDeEntrada>;

let organizacaoA = "";
let organizacaoB = "";
let helena = "";
let outra = "";

beforeAll(async () => {
  if (URL_DO_BANCO === undefined || URL_DO_BANCO === "") {
    throw new Error(
      "BANCO_URL_TESTE não definida. Este teste exige Postgres — o que ele mede é o índice parcial e o " +
        "ROLLBACK. Suba com `npm run local` e rode `npm run teste:integracao`.",
    );
  }

  // `criarTransacao` lê `BANCO_URL`; o teste aponta pela `BANCO_URL_TESTE`. Amarrar as duas é o que faz
  // este arquivo exercer a função de verdade, em vez de uma cópia dela montada à mão.
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  escrita = repositorioDePedidosDeEntrada(criarTransacao());
  leitura = repositorioGlobalDePedidosDeEntrada(consulta);

  await aplicarEsquema(consulta);

  // `auth.users` **não é nossa para derrubar**, então o e-mail leva sufixo de execução — e o `id` vai
  // explícito, porque no provedor de verdade aquela coluna não tem `default`.
  const usuarios = await consulta<{ id: string }>(
    `insert into auth.users (id, email)
          values (gen_random_uuid(), $1), (gen_random_uuid(), $2)
       returning id`,
    [`helena-${SUFIXO}@exemplo.test`, `outra-${SUFIXO}@exemplo.test`],
  );
  const pessoas = await consulta<{ id: string }>(
    `insert into pessoas (usuario_id, nome) values ($1, 'Helena Rocha'), ($2, 'Outra Pessoa')
       returning id`,
    [usuarios[0]!.id, usuarios[1]!.id],
  );
  helena = pessoas[0]!.id;
  outra = pessoas[1]!.id;

  const organizacoes = await consulta<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico)
          values ('Condomínio Recanto Azul', 'K7QMX3TD'), ('Edifício Aurora', 'P4NHY9WB')
       returning id`,
  );
  organizacaoA = organizacoes[0]!.id;
  organizacaoB = organizacoes[1]!.id;
});

afterAll(async () => {
  if (pool !== undefined) {
    await consulta(`delete from auth.users where email like $1`, [`%-${SUFIXO}@exemplo.test`]).catch(
      () => undefined,
    );
    await pool.end();
  }
});

describe("pedir entrada", () => {
  /**
   * **O caso do critério A4, escrito à mão.** É a verificação que a ADR-0003 encomenda para a escrita que
   * roda fora do funil: *"o pedido só pode nascer na Organização cujo código foi apresentado. Código de A
   * não cria pedido em B."*
   */
  it("o código de A produz pedido em A, e nenhuma linha em B", async () => {
    const resultado = await escrita.registrar({
      pessoaId: helena,
      codigoPublico: "K7QMX3TD",
      nome: null,
      telefone: null,
    });

    expect(resultado.desfecho).toBe("registrado");

    const emA = await consulta<{ total: string }>(
      `select count(*) as total from pedidos_de_entrada where organizacao_id = $1`,
      [organizacaoA],
    );
    const emB = await consulta<{ total: string }>(
      `select count(*) as total from pedidos_de_entrada where organizacao_id = $1`,
      [organizacaoB],
    );

    expect(emA[0]?.total).toBe("1");
    expect(emB[0]?.total).toBe("0");
  });

  /** **Nunca cria vínculo** — a invariante inteira da D25, conferida na tabela. */
  it("não cria vínculo nenhum", async () => {
    const vinculos = await consulta<{ total: string }>(`select count(*) as total from vinculos`);
    expect(vinculos[0]?.total).toBe("0");
  });

  /** A recusa é do índice único **parcial**, não de uma checagem prévia. */
  it("recusa o segundo pedido pendente da mesma Pessoa na mesma organização", async () => {
    const segundo = await escrita.registrar({
      pessoaId: helena,
      codigoPublico: "K7QMX3TD",
      nome: null,
      telefone: null,
    });

    expect(segundo.desfecho).toBe("ja-pendente");
  });

  it("recusa código inexistente sem escrever nada", async () => {
    const antes = await consulta<{ total: string }>(`select count(*) as total from pedidos_de_entrada`);

    const resultado = await escrita.registrar({
      pessoaId: outra,
      codigoPublico: "ZZZZZZZZ",
      nome: "Nome Corrigido",
      telefone: "+5511999990000",
    });

    const depois = await consulta<{ total: string }>(`select count(*) as total from pedidos_de_entrada`);
    const pessoa = await consulta<{ nome: string }>(`select nome from pessoas where id = $1`, [outra]);
    const contatos = await consulta<{ total: string }>(
      `select count(*) as total from contatos where pessoa_id = $1`,
      [outra],
    );

    expect(resultado.desfecho).toBe("codigo-nao-encontrado");
    expect(depois[0]?.total).toBe(antes[0]?.total);
    // **A atomicidade:** a correção do nome é *a última*, e um código digitado errado não a gasta.
    expect(pessoa[0]?.nome).toBe("Outra Pessoa");
    expect(contatos[0]?.total).toBe("0");
  });

  it("grava o telefone como primeiro contato pessoal, e corrige o nome", async () => {
    const resultado = await escrita.registrar({
      pessoaId: outra,
      codigoPublico: "P4NHY9WB",
      nome: "Outra P. Pessoa",
      telefone: "+5511999990000",
    });

    expect(resultado.desfecho).toBe("registrado");

    const pessoa = await consulta<{ nome: string }>(`select nome from pessoas where id = $1`, [outra]);
    const contatos = await consulta<{
      tipo: string;
      valor: string;
      finalidade: string;
      ordem: number;
      tem_whatsapp: boolean;
    }>(`select tipo, valor, finalidade, ordem, tem_whatsapp from contatos where pessoa_id = $1`, [outra]);

    expect(pessoa[0]?.nome).toBe("Outra P. Pessoa");
    expect(contatos).toHaveLength(1);
    expect(contatos[0]).toMatchObject({
      tipo: "telefone",
      valor: "+5511999990000",
      finalidade: "pessoal",
      ordem: 1,
      tem_whatsapp: false,
    });
  });

  /**
   * Helena pede entrada também em B — depois de já ter uma linha pendente em A. É o que dá à leitura de
   * contexto duas linhas da mesma Pessoa para ordenar; nasce pela porta de escrita, como os outros casos,
   * porque o que a leitura vai provar é a ordem sobre dado que a escrita produziu.
   */
  it("Helena também pede entrada em B", async () => {
    const resultado = await escrita.registrar({
      pessoaId: helena,
      codigoPublico: "P4NHY9WB",
      nome: null,
      telefone: null,
    });

    expect(resultado.desfecho).toBe("registrado");
  });
});

describe("a leitura de contexto", () => {
  /**
   * A consulta **atravessa organizações de propósito** (§4.4), então não há entrada de suíte a escrever. O
   * risco dela é outro: devolver pedido de **outra Pessoa**. É o que a segunda Pessoa do mundo prova.
   *
   * Helena chega aqui com **dois** pedidos — A, depois B —, o que exercita de verdade o `order by
   * criado_em desc`: o primeiro da lista tem de ser o de B, criado por último.
   */
  it("devolve só os pedidos da própria Pessoa, do mais recente para o mais antigo", async () => {
    const deHelena = await leitura.daPessoa(helena);
    const deOutra = await leitura.daPessoa(outra);

    expect(deHelena).toHaveLength(2);
    expect(deHelena[0]).toMatchObject({
      organizacao: { nome: "Edifício Aurora" },
      situacao: "pendente",
    });
    expect(deHelena[1]).toMatchObject({
      organizacao: { nome: "Condomínio Recanto Azul" },
      situacao: "pendente",
    });

    expect(deOutra).toHaveLength(1);
    expect(deOutra[0]).toMatchObject({ organizacao: { nome: "Edifício Aurora" } });

    // Nenhum identificador de organização atravessa a porta: o modelo de leitura tem `nome` e mais nada.
    expect(deHelena[0]).not.toHaveProperty("organizacaoId");
  });
});
