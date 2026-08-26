import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import {
  repositorioDePedidosDeEntrada,
  repositorioEscopadoDePedidosDeEntrada,
  repositorioGlobalDePedidosDeEntrada,
} from "@/infraestrutura/repositorios/organizacao";

import { urlDoBancoDeTeste } from "./banco";
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
const URL_DO_BANCO = urlDoBancoDeTeste();
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

  /**
   * O terceiro desfecho de recusa do critério 2, e o único dos três que faltava tocar o Postgres. O que
   * fica sem prova sem este caso é o `select … where revogado_em is null` do repositório — o predicado que
   * separa vínculo **ativo** de vínculo **revogado**. `outra` ainda não tem vínculo nenhum até aqui, então
   * o vínculo é inserido direto pela `consulta`, como o arranjo do arquivo já faz com as outras tabelas.
   *
   * **Sem o par revogado/reaceito:** por esta altura `outra` já tem um pedido pendente em B (do caso
   * "grava o telefone…", acima) — é a mesma organização e a mesma Pessoa por escolha do próprio achado.
   * Revogar o vínculo e chamar `registrar` de novo colidiria com o índice único parcial de
   * `pedidos_de_entrada` e devolveria `ja-pendente`, não `registrado`: provaria a regra errada, não a do
   * vínculo. Trocar de Pessoa ou de organização só para fechar o par tiraria o caso do texto do achado
   * sem necessidade — fica só a primeira metade, que é a que faltava.
   */
  it("recusa quando a Pessoa já tem vínculo ativo na organização", async () => {
    await consulta(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`,
      [outra, organizacaoB],
    );

    const resultado = await escrita.registrar({
      pessoaId: outra,
      codigoPublico: "P4NHY9WB",
      nome: null,
      telefone: null,
    });

    expect(resultado.desfecho).toBe("ja-vinculado");
  });

  /** Abre uma credencial e uma Pessoa só para este caso, sem tocar no mundo dos casos acima. */
  async function pessoaNova(nome: string, apelido: string): Promise<string> {
    const usuarios = await consulta<{ id: string }>(
      `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
      [`${apelido}-${SUFIXO}@exemplo.test`],
    );
    const pessoas = await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, $2) returning id`,
      [usuarios[0]!.id, nome],
    );
    return pessoas[0]!.id;
  }

  /**
   * **O critério 5 do item 8 começa aqui.** O telefone vira contato da Pessoa (global) **e** fica no
   * pedido (escopado). O segundo é o que o Gestor vê antes de aprovar; o primeiro é o cadastro dela.
   */
  it("o telefone informado fica no próprio pedido, além de virar contato", async () => {
    const comTelefone = await pessoaNova("Com Telefone", "com-telefone");

    const resultado = await escrita.registrar({
      pessoaId: comTelefone,
      codigoPublico: "P4NHY9WB",
      nome: null,
      telefone: "+5511988887777",
    });

    expect(resultado.desfecho).toBe("registrado");

    const pedidos = await consulta<{ telefone_informado: string | null }>(
      `select telefone_informado from pedidos_de_entrada where pessoa_id = $1 and organizacao_id = $2`,
      [comTelefone, organizacaoB],
    );
    expect(pedidos[0]?.telefone_informado).toBe("+5511988887777");

    const contatos = await consulta<{ valor: string }>(
      `select valor from contatos where pessoa_id = $1`,
      [comTelefone],
    );
    expect(contatos.map((c) => c.valor)).toContain("+5511988887777");
  });

  it("sem telefone, a coluna do pedido fica nula", async () => {
    const semTelefone = await pessoaNova("Sem Telefone", "sem-telefone");

    await escrita.registrar({
      pessoaId: semTelefone,
      codigoPublico: "K7QMX3TD",
      nome: null,
      telefone: null,
    });

    const pedidos = await consulta<{ telefone_informado: string | null }>(
      `select telefone_informado from pedidos_de_entrada where pessoa_id = $1`,
      [semTelefone],
    );
    expect(pedidos[0]?.telefone_informado).toBeNull();
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

/**
 * ============================================================================
 *  A decisão do Gestor — item 8
 * ============================================================================
 *
 * **O que só o banco prova**, e por isso está aqui e não em memória:
 *
 * 1. **`PEDIDO_JA_DECIDIDO`** é o `update … where situacao = 'pendente'` devolvendo zero linhas. É a
 *    máquina de estados do pedido, e este é o caso de **transição inválida** que o DoD cobra.
 * 2. **`JA_VINCULADO`** é a violação da `PRIMARY KEY (pessoa_id, organizacao_id)` de `vinculos`.
 * 3. **`AREA_INVALIDA`** nos dois casos, com a **mesma** resposta: a inativa, que nenhuma constraint pega,
 *    e a de outra organização, que a FK composta recusa.
 * 4. **O `404` de pedido de outra organização** — o escopo produzindo a resposta da §6.3 sem uma linha de
 *    código.
 */
describe("decidir o pedido", () => {
  let gestora = "";
  let candidata = "";
  let areaDeA = "";
  let areaInativaDeA = "";
  let areaDeB = "";

  /** O repositório escopado em A, montado como a composição o monta. */
  const escopadoEm = (organizacaoId: string) =>
    repositorioEscopadoDePedidosDeEntrada(
      escoparConsulta(consulta, organizacaoId),
      escoparTransacao(criarTransacao(), organizacaoId),
    );

  beforeAll(async () => {
    const usuarios = await consulta<{ id: string }>(
      `insert into auth.users (id, email)
            values (gen_random_uuid(), $1), (gen_random_uuid(), $2)
         returning id`,
      [`gestora-${SUFIXO}@exemplo.test`, `candidata-${SUFIXO}@exemplo.test`],
    );
    const pessoas = await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, 'Marina Rocha'), ($2, 'Camila Duarte')
         returning id`,
      [usuarios[0]!.id, usuarios[1]!.id],
    );
    gestora = pessoas[0]!.id;
    candidata = pessoas[1]!.id;

    // A Gestora precisa de vínculo em A: é a FK composta `(decidido_por_pessoa_id, organizacao_id)`.
    await consulta(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [gestora, organizacaoA],
    );

    const areas = await consulta<{ id: string }>(
      `insert into areas (organizacao_id, nome, tipo, ordem, ativa)
            values ($1, 'Apartamento 302', 'privativa', 1, true),
                   ($1, 'Apartamento 404', 'privativa', 2, false),
                   ($2, 'Sala 14', 'privativa', 1, true)
         returning id`,
      [organizacaoA, organizacaoB],
    );
    areaDeA = areas[0]!.id;
    areaInativaDeA = areas[1]!.id;
    areaDeB = areas[2]!.id;
  });

  /** Abre um pedido pendente da candidata em A, e devolve o id. */
  async function pedidoPendente(): Promise<string> {
    await consulta(`delete from vinculos where pessoa_id = $1`, [candidata]);
    await consulta(`delete from pedidos_de_entrada where pessoa_id = $1`, [candidata]);
    const criados = await consulta<{ id: string }>(
      `insert into pedidos_de_entrada (organizacao_id, pessoa_id, telefone_informado)
            values ($1, $2, '+5511988771234')
         returning id`,
      [organizacaoA, candidata],
    );
    return criados[0]!.id;
  }

  it("aprovar cria o vínculo com papel e unidade, e devolve o Vinculo", async () => {
    const pedidoId = await pedidoPendente();

    const resultado = await escopadoEm(organizacaoA).aprovar({
      pedidoId,
      papel: "solicitante",
      areaId: areaDeA,
      decididoPorPessoaId: gestora,
    });

    expect(resultado.desfecho).toBe("aprovado");
    if (resultado.desfecho !== "aprovado") return;
    expect(resultado.vinculo.papel).toBe("solicitante");
    expect(resultado.vinculo.area?.nome).toBe("Apartamento 302");
    expect(resultado.vinculo.temConta).toBe(true);

    const vinculos = await consulta<{ area_id: string | null }>(
      `select area_id from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [candidata, organizacaoA],
    );
    expect(vinculos[0]?.area_id).toBe(areaDeA);
  });

  it("o pedido já decidido recusa a segunda decisão — a transição inválida", async () => {
    const pedidoId = await pedidoPendente();
    await escopadoEm(organizacaoA).aprovar({
      pedidoId,
      papel: "solicitante",
      areaId: null,
      decididoPorPessoaId: gestora,
    });

    const segunda = await escopadoEm(organizacaoA).recusar({
      pedidoId,
      observacao: "mudei de ideia",
      decididoPorPessoaId: gestora,
    });

    expect(segunda.desfecho).toBe("ja-decidido");
  });

  it("aprovar quem já tem vínculo devolve ja-vinculado", async () => {
    const pedidoId = await pedidoPendente();
    await consulta(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`,
      [candidata, organizacaoA],
    );

    const resultado = await escopadoEm(organizacaoA).aprovar({
      pedidoId,
      papel: "solicitante",
      areaId: null,
      decididoPorPessoaId: gestora,
    });

    expect(resultado.desfecho).toBe("ja-vinculado");

    // **O `ROLLBACK` aconteceu:** o pedido continua pendente, porque as duas escritas são uma só.
    const pedidos = await consulta<{ situacao: string }>(
      `select situacao from pedidos_de_entrada where id = $1`,
      [pedidoId],
    );
    expect(pedidos[0]?.situacao).toBe("pendente");
  });

  it("área inativa e área de outra organização dão o mesmo desfecho", async () => {
    const primeiro = await pedidoPendente();
    const comInativa = await escopadoEm(organizacaoA).aprovar({
      pedidoId: primeiro,
      papel: "solicitante",
      areaId: areaInativaDeA,
      decididoPorPessoaId: gestora,
    });

    const segundo = await pedidoPendente();
    const comAreaDeB = await escopadoEm(organizacaoA).aprovar({
      pedidoId: segundo,
      papel: "solicitante",
      areaId: areaDeB,
      decididoPorPessoaId: gestora,
    });

    expect(comInativa.desfecho).toBe("area-invalida");
    expect(comAreaDeB.desfecho).toBe("area-invalida");
  });

  it("pedido de A é inalcançável de B — o 404 que o escopo produz", async () => {
    const pedidoId = await pedidoPendente();

    const deB = await escopadoEm(organizacaoB).recusar({
      pedidoId,
      observacao: null,
      decididoPorPessoaId: gestora,
    });

    expect(deB.desfecho).toBe("nao-encontrado");

    const pedidos = await consulta<{ situacao: string }>(
      `select situacao from pedidos_de_entrada where id = $1`,
      [pedidoId],
    );
    expect(pedidos[0]?.situacao).toBe("pendente");
  });

  it("recusar guarda a observação e não cria vínculo", async () => {
    const pedidoId = await pedidoPendente();

    const resultado = await escopadoEm(organizacaoA).recusar({
      pedidoId,
      observacao: "Não consta na lista da administradora.",
      decididoPorPessoaId: gestora,
    });

    expect(resultado.desfecho).toBe("recusado");

    const linhas = await consulta<{ observacao: string | null; decidido_por_pessoa_id: string }>(
      `select observacao, decidido_por_pessoa_id from pedidos_de_entrada where id = $1`,
      [pedidoId],
    );
    expect(linhas[0]?.observacao).toBe("Não consta na lista da administradora.");
    expect(linhas[0]?.decidido_por_pessoa_id).toBe(gestora);

    const vinculos = await consulta<{ total: string }>(
      `select count(*) as total from vinculos where pessoa_id = $1`,
      [candidata],
    );
    expect(Number(vinculos[0]!.total)).toBe(0);
  });
});
