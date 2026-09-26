import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioDePedidosDeEntrada,
  repositorioEscopadoDeVinculos,
  repositorioGlobalDeVinculos,
} from "@/infraestrutura/repositorios/organizacao";

import { urlDoBancoDeTeste } from "./banco";
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
const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `9a-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

let idOrganizacao = "";
let idGestora = "";
let AREA_ATIVA = "";
let AREA_INATIVA = "";
let AREA_DE_OUTRA_ORGANIZACAO = "";
let idOutraOrganizacao = "";
let idSoDaOutra = "";

beforeAll(async () => {
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
  idOutraOrganizacao = organizacoes[1]!.id;

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

  // Uma Pessoa que existe **só na outra organização**, com um contato. É o alvo do caso de vazamento de
  // escrita: `contatos` é global, e sem o `join` para `vinculos` a organização A alcançaria esta linha.
  const soDaOutra = await consulta<{ id: string }>(
    `insert into pessoas (nome) values ('Zelador da outra organização') returning id`,
  );
  idSoDaOutra = soDaOutra[0]!.id;

  await consulta(
    `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
    [idSoDaOutra, idOutraOrganizacao],
  );

  await consulta(
    `insert into contatos (pessoa_id, tipo, valor, finalidade, ordem)
          values ($1, 'telefone', '+5511900000001', 'trabalho', 1)`,
    [idSoDaOutra],
  );
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

describe("contatos — substituição, e não mesclagem (item 9b)", () => {
  const TELEFONE = {
    tipo: "telefone" as const,
    valor: "+5511955217788",
    finalidade: "trabalho" as const,
    temWhatsapp: true,
    observacao: null,
  };

  const EMAIL = {
    tipo: "email" as const,
    valor: "zelador@exemplo.test",
    finalidade: "recado" as const,
    temWhatsapp: false,
    observacao: "falar com a portaria",
  };

  async function comContatos(contatos: readonly (typeof TELEFONE | typeof EMAIL)[]) {
    const criado = await repositorio().cadastrar({
      nome: "Pessoa de contato",
      papel: "encarregado",
      areaId: null,
      contatos,
    });
    if (criado.desfecho !== "cadastrado") throw new Error("cenário não montou");
    return criado.vinculo.pessoa.pessoaId;
  }

  it("o cadastro grava a lista, e ordem sai 1..N pela POSIÇÃO", async () => {
    const pessoaId = await comContatos([TELEFONE, EMAIL]);
    const lido = await repositorio().porPessoa(pessoaId);

    expect(lido?.pessoa.contatos.map((c) => [c.ordem, c.valor])).toStrictEqual([
      [1, TELEFONE.valor],
      [2, EMAIL.valor],
    ]);
    expect(lido?.pessoa.contatos[0]?.temWhatsapp).toBe(true);
    expect(lido?.pessoa.contatos[1]?.observacao).toBe("falar com a portaria");
  });

  it("a correção TROCA a lista inteira — não mescla", async () => {
    const pessoaId = await comContatos([TELEFONE, EMAIL]);

    const resultado = await repositorio().corrigir({ pessoaId, contatos: [EMAIL] });

    expect(resultado.desfecho).toBe("corrigido");
    if (resultado.desfecho !== "corrigido") return;
    expect(resultado.vinculo.pessoa.contatos.map((c) => c.valor)).toStrictEqual([EMAIL.valor]);
    expect(resultado.vinculo.pessoa.contatos[0]?.ordem).toBe(1);
  });

  it("lista vazia remove todos", async () => {
    const pessoaId = await comContatos([TELEFONE]);

    const resultado = await repositorio().corrigir({ pessoaId, contatos: [] });

    expect(resultado.desfecho).toBe("corrigido");
    if (resultado.desfecho !== "corrigido") return;
    expect(resultado.vinculo.pessoa.contatos).toStrictEqual([]);
  });

  /** **O caso que protege dado de gente**, e o mais fácil de quebrar sem perceber. */
  it("omitir contatos NÃO mexe em nada — corrigir só a unidade preserva a lista", async () => {
    const pessoaId = await comContatos([TELEFONE, EMAIL]);
    const antes = await repositorio().porPessoa(pessoaId);

    const resultado = await repositorio().corrigir({ pessoaId, areaId: AREA_ATIVA });

    expect(resultado.desfecho).toBe("corrigido");
    if (resultado.desfecho !== "corrigido") return;
    expect(resultado.vinculo.pessoa.contatos).toStrictEqual(antes?.pessoa.contatos);
  });

  it("par (tipo, valor) repetido no mesmo corpo é contato-duplicado", async () => {
    const resultado = await repositorio().cadastrar({
      nome: "Repetido",
      papel: "encarregado",
      areaId: null,
      contatos: [TELEFONE, { ...TELEFONE, finalidade: "pessoal" }],
    });

    expect(resultado.desfecho).toBe("contato-duplicado");
  });

  it("o duplicado no cadastro NÃO deixa Pessoa órfã — a transação inteira volta atrás", async () => {
    const antes = await contarPessoas();
    await repositorio().cadastrar({
      nome: "Nunca deveria existir",
      papel: "encarregado",
      areaId: null,
      contatos: [TELEFONE, TELEFONE],
    });

    expect(await contarPessoas()).toBe(antes);
  });
});

describe("contatos — a guarda de quem tem conta, e o vazamento de escrita", () => {
  const UM = {
    tipo: "telefone" as const,
    valor: "+5511944443333",
    finalidade: "pessoal" as const,
    temWhatsapp: false,
    observacao: null,
  };

  it("contatos de quem TEM conta é recusado — contatos é global, como o nome", async () => {
    const resultado = await repositorio().corrigir({ pessoaId: idGestora, contatos: [UM] });

    expect(resultado.desfecho).toBe("pessoa-com-conta");
  });

  /** **A metade que o `[]` esconde:** sem instrução para contar linhas, a guarda precisa ser explícita. */
  it("lista VAZIA em quem tem conta também é recusada, e não apaga nada", async () => {
    const resultado = await repositorio().corrigir({ pessoaId: idGestora, contatos: [] });

    expect(resultado.desfecho).toBe("pessoa-com-conta");
  });

  /**
   * **O caso que fixa a ORDEM dos blocos dentro da transação**, e o único que a pega errada em silêncio.
   *
   * `areaId` é editável em quem tem conta; `contatos`, não. Num corpo que traz os dois, a recusa tem de
   * chegar **antes** de a unidade ser gravada — senão o `409` sai sobre uma transação que gravou, e quem
   * chamou não tem como saber que metade do corpo pegou.
   */
  it("areaId + contatos em quem tem conta recusa SEM gravar a unidade", async () => {
    await repositorio().corrigir({ pessoaId: idGestora, areaId: null });

    const resultado = await repositorio().corrigir({
      pessoaId: idGestora,
      areaId: AREA_ATIVA,
      contatos: [UM],
    });

    expect(resultado.desfecho).toBe("pessoa-com-conta");

    const depois = await repositorio().porPessoa(idGestora);
    expect(depois?.area).toBeNull();
  });

  /**
   * **O caso que a suíte de isolamento não consegue expressar**, porque ela é de leitura.
   *
   * `contatos` é global e não tem `organizacao_id`. Se a escrita não partisse de `vinculos`, a organização
   * A reescreveria o contato de quem só tem vínculo em B — e o vazamento seria de **escrita**, que é pior
   * que o de leitura: destrói dado em vez de mostrá-lo.
   */
  it("A não reescreve contato de quem só tem vínculo em B", async () => {
    const resultado = await repositorio().corrigir({ pessoaId: idSoDaOutra, contatos: [] });

    expect(resultado.desfecho).toBe("nao-encontrado");

    const restaram = await consulta<{ valor: string }>(
      `select valor from contatos where pessoa_id = $1`,
      [idSoDaOutra],
    );
    expect(restaram.map((c) => c.valor)).toStrictEqual(["+5511900000001"]);
  });
});

/**
 * ============================================================================
 *  A remoção — item 10, o único `DELETE` do contrato
 * ============================================================================
 *
 * **É aqui que este item é provado**, e por uma razão mais forte que a de costume: quase tudo que ele
 * promete é garantia do **esquema**. As nove chaves estrangeiras `on delete restrict` recusam sozinhas, e
 * `organizacoes` erra das duas formas: `atualizado_por_pessoa_id` é `restrict` e erra no próprio
 * `delete`, e `criada_por_pessoa_id` é `deferrable initially deferred` e só erra no `COMMIT`. Contra um
 * duplo, nada disso existiria.
 */
describe("remover — o único DELETE, e quem decide o que pode sair é o esquema", () => {
  /** Cria um Encarregado sem rastro nenhum, e devolve o `pessoaId`. */
  async function encarregadoLimpo(nome: string): Promise<string> {
    const criado = await repositorio().cadastrar({
      nome,
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error(`cadastro falhou: ${criado.desfecho}`);
    return criado.vinculo.pessoa.pessoaId;
  }

  /**
   * **O critério 10.1 inteiro, e a segunda metade dele é a razão de o endpoint existir.** Provar que a
   * linha some não prova que o PA-25 foi consertado — o que prova é o pedido de entrada que passa a ser
   * aceito, no lugar do `409 JA_VINCULADO` que o beco produzia.
   */
  it("remove o vínculo sem rastro, a Pessoa permanece, e um novo pedido passa a ser aceito", async () => {
    const pessoaId = await encarregadoLimpo("Sebastião Sem Rastro");
    const pedidos = repositorioDePedidosDeEntrada(criarTransacao());
    const codigo = `A${SUFIXO.slice(-7).toUpperCase()}`;

    // Antes: o beco. É o `409 JA_VINCULADO` do contrato.
    const antes = await pedidos.registrar({
      pessoaId,
      codigoPublico: codigo,
      nome: null,
      telefone: null,
    });
    expect(antes.desfecho).toBe("ja-vinculado");

    expect((await repositorio().remover(pessoaId)).desfecho).toBe("removido");

    // A Pessoa **permanece** — é global, e nunca se apaga por aqui.
    const pessoas = await consulta<{ id: string }>(`select id from pessoas where id = $1`, [
      pessoaId,
    ]);
    expect(pessoas).toHaveLength(1);

    // O vínculo, não.
    expect(await repositorio().porPessoa(pessoaId)).toBeNull();

    // Depois: o conserto.
    const depois = await pedidos.registrar({
      pessoaId,
      codigoPublico: codigo,
      nome: null,
      telefone: null,
    });
    expect(depois.desfecho).toBe("registrado");
  });

  /**
   * **O `VINCULO_COM_HISTORICO` provocado de verdade**, e não simulado: uma ocorrência apontando para o
   * vínculo faz `ocorrencias_autor_fk` — `on delete restrict` — recusar o `delete`. O que o teste prova é
   * que a recusa é **traduzida**, não antecipada.
   */
  it("vínculo com ocorrência é recusado pelo ON DELETE RESTRICT, traduzido em com-historico", async () => {
    const pessoaId = await encarregadoLimpo("Quem Registrou Algo");
    const categorias = await consulta<{ id: string }>(
      `insert into categorias (organizacao_id, nome, icone, ordem) values ($1, $2, 'wrench', 50) returning id`,
      [idOrganizacao, `Categoria do 10 ${SUFIXO}`],
    );

    await consulta(
      `insert into ocorrencias
         (organizacao_id, autor_pessoa_id, categoria_id, area_id, area_tipo, titulo, descricao)
       values ($1, $2, $3, $4, 'privativa', 'Lâmpada queimada', 'Queimada faz três dias.')`,
      [idOrganizacao, pessoaId, categorias[0]!.id, AREA_ATIVA],
    );

    expect((await repositorio().remover(pessoaId)).desfecho).toBe("com-historico");
    expect(await repositorio().porPessoa(pessoaId)).not.toBeNull();
  });

  /**
   * **O caso do critério 10.3, e o que ele prova é a ORDEM dos dois `409`.**
   *
   * **O `update` da primeira linha não é enfeite: sem ele o caso não discrimina nada.** O critério nomeia
   * *"o Gestor inicial"*, e Gestor inicial é o da **POL-01** — aquele para quem
   * `organizacoes.criada_por_pessoa_id` aponta. O `beforeAll` deste arquivo cria a organização **sem**
   * criadora, então `idGestora` não tem dependente nenhum nas nove tabelas, e o caso passaria com a
   * ordem invertida. Com o `update`, ela passa a ter — e a resposta só pode ser `ultimo-gestor` se a
   * guarda estiver **dentro do `where` do `delete`**. Traduzir a recusa do banco primeiro responderia
   * `com-historico`, que é o critério 10.3 lendo **falso** no cenário que ele nomeia.
   *
   * `criada_por_pessoa_id` fica apontando para `idGestora` daqui em diante, de propósito: é o estado de
   * uma organização real, e nenhum caso adiante depende de ela não ter criadora.
   */
  it("o Gestor inicial da POL-01 recebe ultimo-gestor, e NUNCA com-historico", async () => {
    await consulta(`update organizacoes set criada_por_pessoa_id = $1 where id = $2`, [
      idGestora,
      idOrganizacao,
    ]);

    expect((await repositorio().remover(idGestora)).desfecho).toBe("ultimo-gestor");
  });

  /** A guarda não é *"Gestor não sai"*: é *"o último não sai"*. Com dois, o segundo sai. */
  it("com dois Gestores, remover um deles funciona", async () => {
    const segundo = await encarregadoLimpo("Gestor de Reserva");
    await consulta(
      `update vinculos set papel = 'gestor' where pessoa_id = $1 and organizacao_id = $2`,
      [segundo, idOrganizacao],
    );

    expect((await repositorio().remover(segundo)).desfecho).toBe("removido");
    // E a Gestora original volta a ser a última.
    expect((await repositorio().remover(idGestora)).desfecho).toBe("ultimo-gestor");
  });

  /**
   * ==========================================================================
   *  A CHAVE DIFERIDA — a armadilha do item, e o único caso que a exercita
   * ==========================================================================
   *
   * **É o caso que faltava, e ele é a razão de o `try/catch` ficar em volta da chamada a `emTransacao`**
   * (spec §3.3, decisão **D-P5**). `organizacoes_criada_por_vinculo_fk` é
   * `deferrable initially deferred` (migração `001`), então a violação dela **não aparece no `delete`**:
   * aparece no **`COMMIT`**, depois de a função de trabalho já ter devolvido `"removido"`. Um `catch`
   * dentro da transação — a outra leitura possível da §3.3 — deixaria o `23503` subir cru até a
   * Aplicação, e o endpoint responderia `500` onde o contrato promete `409`.
   *
   * **O alvo é um Encarregado, não um Gestor, e é de propósito:** a guarda do último Gestor mora no
   * `where`, e um Gestor a faria parar antes de chegar ao `COMMIT`. Com um Encarregado sem nenhum outro
   * rastro, **as nove chaves `RESTRICT` não têm o que recusar** — inclusive a nova de
   * `organizacoes.atualizado_por_pessoa_id`, que está nula neste cenário. A única violação possível é a
   * diferida, e é isso que torna este caso uma prova e não uma coincidência.
   *
   * A remoção volta atrás inteira, então o vínculo continua lá; `criada_por_pessoa_id` é devolvida a
   * `idGestora` para que os casos de `impedimentosDeRemocao` leiam o mesmo mundo que o `describe` de cima
   * deixou.
   */
  it("a violação DIFERIDA de organizacoes, que só erra no COMMIT, também vira com-historico", async () => {
    const criador = await encarregadoLimpo("Fundador Sem Outro Rastro");
    await consulta(`update organizacoes set criada_por_pessoa_id = $1 where id = $2`, [
      criador,
      idOrganizacao,
    ]);

    expect((await repositorio().remover(criador)).desfecho).toBe("com-historico");
    expect(await repositorio().porPessoa(criador)).not.toBeNull();

    await consulta(`update organizacoes set criada_por_pessoa_id = $1 where id = $2`, [
      idGestora,
      idOrganizacao,
    ]);
  });

  it("pessoaId que não existe é nao-encontrado", async () => {
    const inventado = (await consulta<{ id: string }>(`select gen_random_uuid() as id`))[0]!.id;

    expect((await repositorio().remover(inventado)).desfecho).toBe("nao-encontrado");
  });

  /** Vínculo de outra organização é **inalcançável**, não escondido — o `404` idêntico da §6.3. */
  it("vínculo de outra organização é nao-encontrado, e continua lá do lado de lá", async () => {
    expect((await repositorio().remover(idSoDaOutra)).desfecho).toBe("nao-encontrado");

    const restou = await consulta<{ pessoa_id: string }>(
      `select pessoa_id from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [idSoDaOutra, idOutraOrganizacao],
    );
    expect(restou).toHaveLength(1);
  });
});

describe("impedimentosDeRemocao — o que a tela precisa saber, por vínculo", () => {
  it("quem não tem rastro NÃO aparece no mapa — ausência é 'pode sair'", async () => {
    const criado = await repositorio().cadastrar({
      nome: "Zelador Recém-Chegado",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error("cadastro falhou");
    const pessoaId = criado.vinculo.pessoa.pessoaId;

    const mapa = await repositorio().impedimentosDeRemocao();

    expect(mapa.has(pessoaId)).toBe(false);
    // E a Gestora aparece, porque é a última com poder de gestão.
    expect(mapa.get(idGestora)).toBe("ultimo-gestor");
  });

  /**
   * **A precedência da §3.4, e ela existe para que a tela e o `409` nunca discordem.** A Gestora tem
   * rastro **e** é a última: se a consulta respondesse `historico`, a tela mostraria uma razão e o
   * endpoint responderia a outra.
   */
  it("quando os dois impedimentos valem, ultimo-gestor ganha", async () => {
    await consulta(
      `insert into categorias (organizacao_id, nome, icone, ordem, criado_por_pessoa_id)
       values ($1, $2, 'wrench', 60, $3)`,
      [idOrganizacao, `Categoria com autoria ${SUFIXO}`, idGestora],
    );

    const mapa = await repositorio().impedimentosDeRemocao();

    expect(mapa.get(idGestora)).toBe("ultimo-gestor");
  });

  /** Quem tem rastro e **não** é o último Gestor recebe `historico` — e é o caso comum da tela. */
  it("quem tem rastro sem ser o último Gestor recebe historico", async () => {
    const criado = await repositorio().cadastrar({
      nome: "Encarregado Com Anexo",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error("cadastro falhou");
    const pessoaId = criado.vinculo.pessoa.pessoaId;

    // `pedidos_de_entrada.decidido_por_pessoa_id` é um dos CINCO destinos que a prosa do contrato não
    // nomeia — e é o caso comum de um Gestor bloqueado (achado A-1 da spec).
    await consulta(
      `insert into pedidos_de_entrada
         (organizacao_id, pessoa_id, situacao, decidido_em, decidido_por_pessoa_id)
       values ($1, $2, 'recusado', now(), $3)`,
      [idOrganizacao, idSoDaOutra, pessoaId],
    );

    const mapa = await repositorio().impedimentosDeRemocao();

    expect(mapa.get(pessoaId)).toBe("historico");
  });

  /**
   * **Quem só reclassificou uma Área tem rastro — item 50, migração `011`.**
   *
   * `areas.tipo_alterado_por_pessoa_id` é a décima quarta coluna que aponta para `vinculos`, e a chave é
   * `on delete restrict` não diferida. Sem ela na consulta, T-08 mostraria *remover* e o `DELETE`
   * responderia `409`, que é a deriva que a guarda logo abaixo existe para pegar.
   */
  it("quem só reclassificou uma área recebe historico, e o DELETE concorda", async () => {
    const criado = await repositorio().cadastrar({
      nome: "Encarregado Que Reclassificou",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error("cadastro falhou");
    const pessoaId = criado.vinculo.pessoa.pessoaId;

    await consulta(
      `update areas
          set tipo_alterado_em = now(), tipo_alterado_por_pessoa_id = $2
        where organizacao_id = $1 and id = $3`,
      [idOrganizacao, pessoaId, AREA_INATIVA],
    );

    const mapa = await repositorio().impedimentosDeRemocao();
    expect(mapa.get(pessoaId)).toBe("historico");

    // O esquema concorda com a consulta: a chave nova recusa no próprio `delete`.
    const removido = await repositorio().remover(pessoaId);
    expect(removido.desfecho).toBe("com-historico");
  });

  /**
   * **A guarda contra deriva (spec §3.5 do item 10), e ela é um teste porque o risco é envelhecer em
   * silêncio.**
   *
   * Uma coluna nova com chave estrangeira para `vinculos` não entraria na consulta de
   * `impedimentosDeRemocao`, e a tela passaria a mostrar um botão que leva a `409`. **Botão que promete e
   * falha é pior que a razão no lugar dele.**
   *
   * **Por coluna desde o item 50.** Até ali a guarda comparava tabelas, e uma coluna nova numa tabela já
   * coberta passava calada: `areas.tipo_alterado_por_pessoa_id` é esse caso. A consulta pega, de cada
   * chave, a coluna local que casa com `vinculos.pessoa_id`, e não a de organização.
   *
   * `pg_constraint` e não `information_schema`: `confrelid` responde *"quem aponta para `vinculos`"* sem
   * três `join`. **`autorizacoes_de_upload` NÃO está na lista**: a chave dela aponta para `pessoas (id)`,
   * e não bloqueia remoção de vínculo nenhum.
   *
   * **A ordem vem do `sort()` do JavaScript**, e não do `order by`: a collation do banco trataria `.` e `_`
   * de outro jeito, e o teste passaria a depender dela.
   */
  it("as colunas que apontam para vinculos são exatamente as catorze que a consulta cobre, em nove tabelas", async () => {
    const COBERTAS = [
      "anexos.anexado_por_pessoa_id",
      "areas.atualizado_por_pessoa_id",
      "areas.criado_por_pessoa_id",
      "areas.tipo_alterado_por_pessoa_id",
      "atribuicoes.atribuido_por_pessoa_id",
      "atribuicoes.responsavel_pessoa_id",
      "categorias.atualizado_por_pessoa_id",
      "categorias.criado_por_pessoa_id",
      "mensagens.autor_pessoa_id",
      "ocorrencias.autor_pessoa_id",
      "organizacoes.atualizado_por_pessoa_id",
      "organizacoes.criada_por_pessoa_id",
      "pedidos_de_entrada.decidido_por_pessoa_id",
      "registros_transicao.autor_pessoa_id",
    ];

    const linhas = await consulta<{ par: string }>(
      `select c.conrelid::regclass::text || '.' || a.attname::text as par
         from pg_constraint c
         cross join lateral unnest(c.conkey, c.confkey) as k(local, alvo)
         join pg_attribute a on a.attrelid = c.conrelid  and a.attnum = k.local
         join pg_attribute r on r.attrelid = c.confrelid and r.attnum = k.alvo
        where c.contype = 'f'
          and c.confrelid = 'public.vinculos'::regclass
          and r.attname = 'pessoa_id'`,
    );

    expect(linhas.map((l) => l.par).sort()).toStrictEqual(COBERTAS);
    expect(new Set(COBERTAS.map((par) => par.split(".")[0])).size).toBe(9);
  });
});

describe("o relógio de atualização é do banco (item 68b)", () => {
  it("vínculo recém-criado tem atualizado_em nulo: entrar não é alterar", async () => {
    // **Uma pessoa nova, e não a gestora do `beforeAll`.** O vínculo dela já levou três
    // `update vinculos set area_id` dos casos de correção, e com o gatilho sem guarda a coluna dela
    // deixa de ser nula muito antes deste `describe`. Quem prova *"entrar não é alterar"* tem de ser uma
    // linha que ninguém tocou.
    const criado = await repositorio().cadastrar({
      nome: "Recém-Cadastrado do Gatilho",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error(`cadastro falhou: ${criado.desfecho}`);

    const [linha] = await consulta<{ atualizado_em: Date | null }>(
      `select atualizado_em from vinculos where organizacao_id = $1 and pessoa_id = $2`,
      [idOrganizacao, criado.vinculo.pessoa.pessoaId],
    );
    expect(linha?.atualizado_em).toBeNull();
  });

  it("um update em vinculos carimba atualizado_em, sem a aplicação escrever a coluna", async () => {
    await consulta(
      `update vinculos set papel = 'gestor' where pessoa_id = $1 and organizacao_id = $2`,
      [idGestora, idOrganizacao],
    );
    const [depois] = await consulta<{ atualizado_em: Date | null }>(
      `select atualizado_em from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [idGestora, idOrganizacao],
    );
    expect(depois?.atualizado_em).toBeInstanceOf(Date);
  });

  it("o gatilho vale para as outras tabelas: um update em areas anda o relógio", async () => {
    const [antes] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from areas where id = $1`,
      [AREA_INATIVA],
    );
    await consulta(`update areas set nome = 'Depósito reformado' where id = $1`, [AREA_INATIVA]);
    const [depois] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from areas where id = $1`,
      [AREA_INATIVA],
    );
    expect(depois!.atualizado_em.getTime()).toBeGreaterThan(antes!.atualizado_em.getTime());
  });

  it("o update no-op do primeiro login NÃO carimba a pessoa", async () => {
    // `garantirParaUsuario` resolve o login com
    // `on conflict do update set usuario_id = excluded.usuario_id`, que grava a mesma linha de volta só
    // para o `returning` devolvê-la. Sem a guarda `when` do gatilho de `pessoas`, todo login moveria a
    // última atualização de todo participante com conta.
    const [antes] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from pessoas where id = $1`,
      [idGestora],
    );

    await consulta(
      `insert into pessoas (usuario_id, nome)
            values ((select usuario_id from pessoas where id = $1), 'Nome Ignorado')
       on conflict (usuario_id) do update set usuario_id = excluded.usuario_id`,
      [idGestora],
    );

    const [depois] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from pessoas where id = $1`,
      [idGestora],
    );
    expect(depois!.atualizado_em.getTime()).toBe(antes!.atualizado_em.getTime());
  });

  /** Cada caso cria a própria pessoa, para não depender da ordem nem do que os outros alteraram. */
  async function pessoaNova(nome: string): Promise<string> {
    const criado = await repositorio().cadastrar({
      nome,
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    if (criado.desfecho !== "cadastrado") throw new Error(`cadastro falhou: ${criado.desfecho}`);
    return criado.vinculo.pessoa.pessoaId;
  }

  it("as duas nulas devolvem nulo: greatest ignora nulo e só devolve nulo quando todos são", async () => {
    const criado = await repositorio().cadastrar({
      nome: "Recém-Cadastrado sem Alteração",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    expect(criado.desfecho).toBe("cadastrado");
    if (criado.desfecho !== "cadastrado") return;

    // A pessoa nasce com `pessoas.atualizado_em` igual a `criado_em` (o `nullif` a anula) e o vínculo
    // nasce com `atualizado_em` nulo. As duas nulas: o `greatest` devolve nulo.
    expect(criado.vinculo.atualizadoEm).toBeNull();
    const lido = await repositorio().porPessoa(criado.vinculo.pessoa.pessoaId);
    expect(lido!.atualizadoEm).toBeNull();
  });

  it("corrigir só o nome move o valor lido, porque quem anda é o relógio da pessoa", async () => {
    const pessoaId = await pessoaNova("Zelador a Renomear");
    await repositorio().corrigir({ pessoaId, nome: "Zelador Renomeado" });
    const depois = await repositorio().porPessoa(pessoaId);
    expect(depois!.atualizadoEm).not.toBeNull();
  });

  it("corrigir só a unidade move o valor lido, porque quem anda é o relógio do vínculo", async () => {
    const pessoaId = await pessoaNova("Zelador a Realocar");
    await repositorio().corrigir({ pessoaId, areaId: AREA_ATIVA });
    const depois = await repositorio().porPessoa(pessoaId);
    expect(depois!.atualizadoEm).not.toBeNull();
  });

  it("a correção na forma que a tela manda move o valor lido", async () => {
    const pessoaId = await pessoaNova("Zelador da Tela");
    await repositorio().corrigir({
      pessoaId,
      nome: "Zelador da Tela, Corrigido",
      areaId: AREA_ATIVA,
      contatos: [],
    });
    const depois = await repositorio().porPessoa(pessoaId);
    expect(depois!.atualizadoEm).not.toBeNull();
  });

  it("alterar o nome de verdade carimba a pessoa", async () => {
    const [antes] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from pessoas where id = $1`,
      [idGestora],
    );
    await consulta(`update pessoas set nome = 'Marina Gestora Silva' where id = $1`, [idGestora]);
    const [depois] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from pessoas where id = $1`,
      [idGestora],
    );
    expect(depois!.atualizado_em.getTime()).toBeGreaterThan(antes!.atualizado_em.getTime());
  });
});

/**
 * ============================================================================
 *  revogar — item 84: a pessoa sai, o rastro fica
 * ============================================================================
 *
 * **Estado herdado dos `describe` de cima, e ele importa:** `idGestora` é a única Gestora de
 * `idOrganizacao`, e `organizacoes.criada_por_pessoa_id` aponta para ela (caso do critério 10.3).
 */
describe("revogar — a pessoa perde o acesso, e o rastro continua nomeando-a", () => {
  const NO_FUTURO = "2099-01-01T00:00:00.000Z";

  function vinculosEm(organizacaoId: string) {
    return repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, organizacaoId),
      escoparTransacao(criarTransacao(), organizacaoId),
    );
  }

  function ocorrenciasEm(organizacaoId: string) {
    return repositorioEscopadoDeOcorrencias(
      escoparConsulta(consulta, organizacaoId),
      escoparTransacao(criarTransacao(), organizacaoId),
    );
  }

  /** Uma Solicitante sem conta, com vínculo em `idOrganizacao`, e o `pessoaId`. */
  async function solicitante(nome: string): Promise<string> {
    const [pessoa] = await consulta<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [nome],
    );
    await consulta(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`,
      [pessoa!.id, idOrganizacao],
    );
    return pessoa!.id;
  }

  /**
   * **O critério 84.1 inteiro, nas três metades que ele nomeia.** A ocorrência e o registro de transição
   * entram por SQL, como no caso do `remover` com histórico: o que se prova aqui é a leitura depois de
   * revogar, e não o registro.
   */
  it("revoga quem registrou ocorrência: some do acesso, e a ocorrência e a trilha continuam nomeando-a", async () => {
    const pessoaId = await solicitante("Joana que Mudou de Prédio");
    const [categoria] = await consulta<{ id: string }>(
      `insert into categorias (organizacao_id, nome, icone, ordem) values ($1, $2, 'wrench', 84) returning id`,
      [idOrganizacao, `Categoria do 84 ${SUFIXO}`],
    );
    const [ocorrencia] = await consulta<{ id: string }>(
      `insert into ocorrencias
         (organizacao_id, autor_pessoa_id, categoria_id, area_id, area_tipo, titulo, descricao)
       values ($1, $2, $3, $4, 'privativa', 'Portão emperrado', 'Não fecha desde ontem.')
       returning id`,
      [idOrganizacao, pessoaId, categoria!.id, AREA_ATIVA],
    );
    await consulta(
      `insert into registros_transicao
         (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
       values ($1, $2, 1, null, 'aberta', $3)`,
      [idOrganizacao, ocorrencia!.id, pessoaId],
    );

    expect((await vinculosEm(idOrganizacao).revogar(pessoaId)).desfecho).toBe("revogado");

    // 1 · A pessoa perde o acesso: a resolução de contexto não lista mais a organização.
    const ativos = await repositorioGlobalDeVinculos(consulta).ativosDaPessoa(pessoaId);
    expect(ativos.map((v) => v.organizacao.id)).not.toContain(idOrganizacao);
    expect(await vinculosEm(idOrganizacao).porPessoa(pessoaId)).toBeNull();

    // 2 · A ocorrência continua na lista da organização, e com o nome dela.
    const lista = await ocorrenciasEm(idOrganizacao).listar({ limite: 50, deslocamento: 0, ate: NO_FUTURO });
    const daJoana = lista.find((linha) => linha.id === ocorrencia!.id);
    expect(daJoana?.autor).toStrictEqual({ pessoaId, nome: "Joana que Mudou de Prédio" });

    // 3 · A trilha continua íntegra e nomeando-a: o mesmo registro, o mesmo autor, nenhum registro a mais.
    const trilha = await ocorrenciasEm(idOrganizacao).trilha(ocorrencia!.id);
    expect(trilha).toHaveLength(1);
    expect(trilha[0]?.autor).toStrictEqual({ pessoaId, nome: "Joana que Mudou de Prédio" });

    // 4 · E o detalhe também (spec §3.10, "a trilha e o detalhe continuam nomeando-o").
    const detalhe = await ocorrenciasEm(idOrganizacao).porId(ocorrencia!.id);
    expect(detalhe?.autor).toStrictEqual({ pessoaId, nome: "Joana que Mudou de Prédio" });

    // E a linha de `vinculos` continua lá — é o que mantém as chaves compostas válidas.
    const linhas = await consulta<{ revogado: boolean; atualizado: boolean }>(
      `select revogado_em is not null as revogado, atualizado_em is not null as atualizado
         from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [pessoaId, idOrganizacao],
    );
    expect(linhas).toStrictEqual([{ revogado: true, atualizado: true }]);
  });

  it("revogar duas vezes: a segunda é nao-encontrado, e não um segundo sucesso", async () => {
    const pessoaId = await solicitante("Revogada Duas Vezes");

    expect((await vinculosEm(idOrganizacao).revogar(pessoaId)).desfecho).toBe("revogado");
    expect((await vinculosEm(idOrganizacao).revogar(pessoaId)).desfecho).toBe("nao-encontrado");
  });

  /** **O critério 84.2**, no cenário do 10.3: o Gestor inicial, que TEM dependente. */
  it("o Gestor inicial não se revoga: ultimo-gestor, com a mesma força do remover", async () => {
    expect((await vinculosEm(idOrganizacao).revogar(idGestora)).desfecho).toBe("ultimo-gestor");
    expect(await vinculosEm(idOrganizacao).porPessoa(idGestora)).not.toBeNull();
  });

  it("com dois Gestores, um revoga o outro, e a guarda volta a valer para o que ficou", async () => {
    const segundo = await solicitante("Gestor que Saiu");
    await consulta(
      `update vinculos set papel = 'gestor' where pessoa_id = $1 and organizacao_id = $2`,
      [segundo, idOrganizacao],
    );

    expect((await vinculosEm(idOrganizacao).revogar(segundo)).desfecho).toBe("revogado");
    expect((await vinculosEm(idOrganizacao).revogar(idGestora)).desfecho).toBe("ultimo-gestor");
  });

  /**
   * **A trava comum, e a razão de ela ser a MESMA do `remover`.** Numa organização com exatamente dois
   * Gestores, um remove o outro enquanto o outro revoga o primeiro. Sem trava comum as duas transações
   * veem uma à outra ativa e passam, e a organização fica sem Gestor. Com ela, a segunda espera e recusa.
   */
  it("remover e revogar ao mesmo tempo, entre os dois únicos Gestores: um passa, o outro é ultimo-gestor", async () => {
    const [organizacao] = await consulta<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ('Organização da corrida do 84', $1) returning id`,
      [`C${SUFIXO.slice(-7).toUpperCase()}`],
    );
    const gestores = await consulta<{ id: string }>(
      `insert into pessoas (nome) values ('Primeiro Gestor'), ('Segundo Gestor') returning id`,
    );
    for (const gestor of gestores) {
      await consulta(
        `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
        [gestor.id, organizacao!.id],
      );
    }

    const [remocao, revogacao] = await Promise.all([
      vinculosEm(organizacao!.id).remover(gestores[0]!.id),
      vinculosEm(organizacao!.id).revogar(gestores[1]!.id),
    ]);

    const desfechos = [remocao.desfecho, revogacao.desfecho];
    expect(desfechos.filter((desfecho) => desfecho === "ultimo-gestor")).toHaveLength(1);

    const restantes = await consulta<{ total: number }>(
      `select count(*)::int as total from vinculos
        where organizacao_id = $1 and papel = 'gestor' and revogado_em is null`,
      [organizacao!.id],
    );
    expect(restantes[0]?.total).toBe(1);
  });

  it("vínculo de outra organização é nao-encontrado, e continua ativo do lado de lá", async () => {
    expect((await vinculosEm(idOrganizacao).revogar(idSoDaOutra)).desfecho).toBe("nao-encontrado");

    const restou = await consulta<{ revogado_em: Date | null }>(
      `select revogado_em from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [idSoDaOutra, idOutraOrganizacao],
    );
    expect(restou).toStrictEqual([{ revogado_em: null }]);
  });
});
