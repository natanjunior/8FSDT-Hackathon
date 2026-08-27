import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import { registrarOcorrencia } from "@/aplicacao/ocorrencia";
import { criarTransacao } from "@/infraestrutura/clientes";
import { ConsultaSemEscopo, escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioEscopadoDeAreas,
  repositorioEscopadoDeCategorias,
  repositorioEscopadoDePedidosDeEntrada,
  repositorioEscopadoDeVinculos,
  repositorioGlobalDeVinculos,
} from "@/infraestrutura/repositorios/organizacao";
import { repositorioDePessoas } from "@/infraestrutura/repositorios/pessoa";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";
import { casosDeIsolamento } from "./suite-de-isolamento";

/**
 * ============================================================================
 *  O critério A4 — **nenhum dado atravessa organizações**
 * ============================================================================
 *
 * A `arquitetura.md` (tópico 10) não pede só o teste: pede o **cenário certo**.
 *
 * > Teste de integração no repositório escopado, com **duas organizações semeadas e a mesma Pessoa
 * > vinculada às duas** — o cenário da Persona 1B. Seed com pessoas distintas por organização **não
 * > detecta** o erro, porque o vazamento aparece justamente quando a Pessoa é global e a consulta parte
 * > dela.
 *
 * É o que este arquivo semeia, e por isso ele não pode ser feito em memória: o que está sob teste é a
 * consulta que vai ao banco.
 *
 * **Ele também é o teste que o Definition of Done cobra por outro caminho:** *"consulta que envolva pessoas
 * parte de `vinculos`, nunca de `pessoas`… a regra de lint não alcança este caso, porque a consulta é
 * legítima: ela apenas parte da tabela errada. A defesa é teste."*
 */

const URL_DO_BANCO = urlDoBancoDeTeste();

/**
 * Sufixo de execução para os e-mails das credenciais.
 *
 * **É o contrato do provedor aparecendo de novo:** `auth.users` tem índice único parcial em `email`, e as
 * nossas três tabelas são derrubadas e recriadas em cada execução — mas `auth.users` **não é nossa para
 * derrubar**. Sem o sufixo, a segunda execução contra o mesmo banco colide com as credenciais da primeira.
 *
 * A alternativa era apagar linhas de `auth.users` no início, e ela foi recusada: contra o Supabase local
 * essa tabela guarda as contas de quem está desenvolvendo. Sufixo por execução não destrói nada, e o
 * `afterAll` recolhe o que esta execução criou.
 */
const SUFIXO = `${Date.now()}`;
const emailDeTeste = (quem: string) => `${quem}-${SUFIXO}@exemplo.test`;

const RECANTO = { nome: "Condomínio Recanto Azul", codigo: "RECANTO7" };
const AURORA = { nome: "Edifício Aurora", codigo: "AURORA22" };

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let idRecanto: string;
let idAurora: string;
let idSindica: string;
let idMoradora: string;
let idPedidoRecanto: string;
let idPedidoAurora: string;
let idDaOcorrenciaEmA: string;
let idDaOcorrenciaEmB: string;

/**
 * As portas de uma organizacao, montadas como a producao as monta.
 *
 * **`escoparConsulta(consulta, ...)` e nao `criarConsulta()`:** `consulta` e a variavel de modulo que o
 * arquivo ja tem, ligada ao `Pool` local — o mesmo em que `aplicarEsquema` rodou. `criarConsulta()`
 * abriria um segundo pool e exigiria um import novo. `criarTransacao()` continua sendo o cliente de
 * producao, que e o que as entradas de `GET /pedidos-de-entrada` e `GET /vinculos` ja fazem.
 */
/** **Nunca chamada aqui**: nenhum caso deste arquivo registra com anexo, e a porta só é tocada dentro
 *  do laço de `entrada.anexos`. Estourar é o ponto. */
const SEM_ANEXO = {
  conferirTicket: () => {
    throw new Error("Este arquivo não registra com anexo.");
  },
  descrever: () => {
    throw new Error("Este arquivo não registra com anexo.");
  },
  marcarConfirmado: () => {
    throw new Error("Este arquivo não registra com anexo.");
  },
  urlDeLeitura: () => {
    throw new Error("Este arquivo não registra com anexo.");
  },
} as unknown as ArmazenamentoDeAnexos;

function portasDe(organizacaoId: string) {
  const escopada = escoparConsulta(consulta, organizacaoId);
  return {
    ocorrencias: repositorioEscopadoDeOcorrencias(
      escopada,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    categorias: repositorioEscopadoDeCategorias(escopada),
    areas: repositorioEscopadoDeAreas(escopada),
    armazenamento: SEM_ANEXO,
  };
}

beforeAll(async () => {
  // `criarTransacao` lê `BANCO_URL`; o teste aponta pela `BANCO_URL_TESTE`. Amarrar as duas é o que faz
  // o teste exercer o cliente de produção, e não um pool montado à parte. Passou a ser necessário com a
  // entrada de `GET /ocorrencias/{id}` (item 11): as entradas anteriores só chamam `criarTransacao()` —
  // que devolve uma função — e nunca **executam** uma transação, então o pool nunca era aberto.
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);
  await semear();

  /**
   * **Uma ocorrência em cada organização, e a autora é a mesma nas duas.** `idSindica` tem vínculo em
   * Recanto e em Aurora — e é exatamente isso que faz o caso detectar o vazamento (critério A4). A FK
   * `ocorrencias_autor_fk` aponta para `vinculos (pessoa_id, organizacao_id)`, e ela o tem nas duas.
   *
   * A categoria e a área são as que o próprio `semear()` criou por organização. **Não é a semente da
   * POL-01:** este arquivo insere as duas por SQL direto, e é de lá que elas vêm.
   */
  for (const [organizacaoId, guardar] of [
    [idRecanto, (id: string) => (idDaOcorrenciaEmA = id)],
    [idAurora, (id: string) => (idDaOcorrenciaEmB = id)],
  ] as const) {
    const portas = portasDe(organizacaoId);
    const [categoria] = await portas.categorias.listar({ apenasAtivas: true });
    const [area] = await portas.areas.listar({ apenasAtivas: true });

    const lida = await registrarOcorrencia(
      portas,
      { pessoaId: idSindica, organizacaoId },
      {
        titulo: "Lâmpada queimada na garagem",
        descricao: "Queimada faz três dias, corredor escuro.",
        categoriaId: categoria!.id,
        areaId: area!.id,
        localizacaoComplemento: null,
      },
    );
    guardar(lida.id);
  }
});

afterAll(async () => {
  if (pool !== undefined) {
    // Recolhe só o que ESTA execução criou. `pessoas.usuario_id` é `on delete set null`, então apagar a
    // credencial não apaga a Pessoa — é o mecanismo do RNF10 sendo exercido de graça.
    await consulta(`delete from auth.users where email like $1`, [`%-${SUFIXO}@exemplo.test`]).catch(
      () => undefined,
    );
    await pool.end();
  }
});

// ---------------------------------------------------------------------------

describe("o repositório escopado nunca devolve linha de outra organização", () => {
  it("a mesma Pessoa está nas duas organizações — o cenário que detecta o vazamento", async () => {
    const globais = repositorioGlobalDeVinculos(consulta);
    const daSindica = await globais.ativosDaPessoa(idSindica);

    expect(daSindica).toHaveLength(2);
    // O repositório ordena por nome de organização (`order by o.nome`), e o `collation` do banco põe
    // "Condomínio" antes de "Edifício".
    expect(daSindica.map((v) => v.organizacao.nome)).toStrictEqual([RECANTO.nome, AURORA.nome]);
  });

  it("escopado em Recanto, vê só quem é de Recanto", async () => {
    const repos = repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, idRecanto),
      escoparTransacao(criarTransacao(), idRecanto),
    );
    const ativos = await repos.ativos();

    expect(ativos.map((a) => a.pessoa.pessoaId).sort()).toEqual([idMoradora, idSindica].sort());

    // `organizacaoId` **não existe mais no resultado, e é melhoria e não perda**: um modelo de leitura
    // correto não expõe a coluna de escopo (é o que a suíte de isolamento diz do terceiro caso, que é
    // opcional por essa razão). O que prova o isolamento é a comparação com o que foi semeado em cada
    // organização — os dois casos abaixo —, e ela é mais forte do que acreditar num campo que a própria
    // consulta preencheu.
  });

  /**
   * **O teste que importa.** Em Aurora a síndica é `solicitante`; em Recanto é `gestor`. Se o escopo
   * vazasse, a moradora de Recanto apareceria aqui — e o papel da síndica sairia errado.
   */
  it("escopado em Aurora, NÃO vê a moradora de Recanto, e o papel é o de Aurora", async () => {
    const repos = repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, idAurora),
      escoparTransacao(criarTransacao(), idAurora),
    );
    const ativos = await repos.ativos();

    expect(ativos).toHaveLength(1);
    expect(ativos[0]?.pessoa.pessoaId).toBe(idSindica);
    expect(ativos[0]?.papel).toBe("solicitante");
    expect(ativos.map((a) => a.pessoa.pessoaId)).not.toContain(idMoradora);
  });

  it("vínculo revogado desaparece da leitura, sem apagar a linha", async () => {
    await consulta(
      `update vinculos set revogado_em = now() where pessoa_id = $1 and organizacao_id = $2`,
      [idMoradora, idRecanto],
    );

    const repos = repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, idRecanto),
      escoparTransacao(criarTransacao(), idRecanto),
    );
    expect((await repos.ativos()).map((a) => a.pessoa.pessoaId)).toEqual([idSindica]);

    // A linha continua lá — é o que mantém as FKs compostas válidas para a trilha (modelo §6.4).
    const linhas = await consulta<{ contagem: string }>(
      `select count(*) as contagem from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [idMoradora, idRecanto],
    );
    expect(linhas[0]?.contagem).toBe("1");

    await consulta(`update vinculos set revogado_em = null where pessoa_id = $1 and organizacao_id = $2`, [
      idMoradora,
      idRecanto,
    ]);
  });
});

describe("o ponto de estrangulamento recusa consulta sem escopo", () => {
  it("consulta escopada que não referencia $1 é recusada, com erro nomeado", () => {
    const escopada = escoparConsulta(consulta, idRecanto);
    expect(() => escopada(`select 1 from vinculos`)).toThrow(ConsultaSemEscopo);
  });

  it("o repositório escopado não recebe o identificador da organização — ele não tem como errar o filtro", () => {
    // A assinatura é a garantia: `repositorioEscopadoDeVinculos` recebe **duas funções** — a consulta e a
    // transação, ambas já amarradas ao `$1` —, e nenhum uuid. Era `1` até o item 9a, quando o cadastro e a
    // correção passaram a precisar de transação; o que a asserção prova é o mesmo.
    expect(repositorioEscopadoDeVinculos.length).toBe(2);
  });
});

describe("a resolução da Pessoa é idempotente no banco, não numa checagem", () => {
  it("garantirParaUsuario chamado duas vezes devolve a mesma Pessoa", async () => {
    const usuarioId = await criarUsuario(emailDeTeste("recem"));
    const pessoas = repositorioDePessoas(consulta);

    const primeira = await pessoas.garantirParaUsuario(usuarioId, "Helena Rocha");
    const segunda = await pessoas.garantirParaUsuario(usuarioId, "Outro Nome Qualquer");

    expect(segunda.pessoaId).toBe(primeira.pessoaId);
    // O nome gravado é o da primeira: o `do update` é no-op de propósito.
    expect(segunda.nome).toBe("Helena Rocha");
  });

  it("porUsuario devolve null para conta sem Pessoa, em vez de lançar", async () => {
    const usuarioId = await criarUsuario(emailDeTeste("nunca-usou"));
    expect(await repositorioDePessoas(consulta).porUsuario(usuarioId)).toBeNull();
  });
});

describe("as invariantes que o banco garante", () => {
  it("recusa código público fora do formato do cartaz de elevador", async () => {
    await expect(
      consulta(`insert into organizacoes (nome, codigo_publico) values ('X', 'minusculo')`),
    ).rejects.toThrow(/organizacoes_codigo_publico_ck/u);
  });

  it("recusa duas organizações com o mesmo código público", async () => {
    await expect(
      consulta(`insert into organizacoes (nome, codigo_publico) values ('Outro', $1)`, [RECANTO.codigo]),
    ).rejects.toThrow(/organizacoes_codigo_publico_uk/u);
  });

  it("recusa dois vínculos da mesma Pessoa na mesma Organização", async () => {
    await expect(
      consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`, [
        idSindica,
        idRecanto,
      ]),
    ).rejects.toThrow(/vinculos_pk/u);
  });

  it("recusa duas Pessoas para o mesmo Usuário, e aceita N Pessoas sem Usuário", async () => {
    const usuarioId = await criarUsuario(emailDeTeste("duplicado"));
    await consulta(`insert into pessoas (usuario_id, nome) values ($1, 'Primeira')`, [usuarioId]);

    await expect(
      consulta(`insert into pessoas (usuario_id, nome) values ($1, 'Segunda')`, [usuarioId]),
    ).rejects.toThrow(/pessoas_usuario_uk/u);

    // NULLs são distintos entre si num índice único: N pessoas sem conta convivem (modelo §6.2).
    await consulta(`insert into pessoas (nome) values ('Encarregado sem conta A')`);
    await consulta(`insert into pessoas (nome) values ('Encarregado sem conta B')`);
  });

  it("recusa Pessoa anonimizada que ainda tem conta", async () => {
    const usuarioId = await criarUsuario(emailDeTeste("anonimizar"));
    await expect(
      consulta(`insert into pessoas (usuario_id, nome, anonimizada_em) values ($1, 'X', now())`, [
        usuarioId,
      ]),
    ).rejects.toThrow(/pessoas_anonimizada_sem_conta_ck/u);
  });

  /**
   * A FK diferida do ovo-e-galinha (modelo §6.3): a organização entra **antes** do vínculo, e a verificação
   * acontece no `COMMIT`. Fora de transação, o `INSERT` da organização com criador falharia.
   */
  it("a FK de `criada_por_pessoa_id` é diferida: organização e vínculo entram na mesma transação", async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query("begin");
      const usuarioId = (
        await cliente.query<{ id: string }>(
          `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
          [emailDeTeste("fundadora")],
        )
      ).rows[0]!.id;
      const pessoaId = (
        await cliente.query<{ id: string }>(
          `insert into pessoas (usuario_id, nome) values ($1, 'Fundadora') returning id`,
          [usuarioId],
        )
      ).rows[0]!.id;
      const organizacaoId = (
        await cliente.query<{ id: string }>(
          `insert into organizacoes (nome, codigo_publico, criada_por_pessoa_id)
                values ('Bairro Novo', 'BAIRRO01', $1) returning id`,
          [pessoaId],
        )
      ).rows[0]!.id;
      await cliente.query(
        `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
        [pessoaId, organizacaoId],
      );
      await cliente.query("commit");
    } catch (erro) {
      await cliente.query("rollback");
      throw erro;
    } finally {
      cliente.release();
    }
  });

  it("... e recusa no COMMIT quando o vínculo do criador não chega", async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query("begin");
      await cliente.query(
        `insert into organizacoes (nome, codigo_publico, criada_por_pessoa_id)
              values ('Sem Gestor', 'SEMGES01', $1)`,
        [idSindica],
      );
      await expect(cliente.query("commit")).rejects.toThrow(
        /organizacoes_criada_por_vinculo_fk/u,
      );
    } finally {
      await cliente.query("rollback").catch(() => undefined);
      cliente.release();
    }
  });
});

// ---------------------------------------------------------------------------

/**
 * Cria uma credencial na tabela do provedor.
 *
 * **O `id` é fornecido, não gerado pelo banco**, e isso é o contrato do provedor aparecendo: em
 * `auth.users` a chave primária **não tem `default`** — quem a gera é o servidor de autenticação. O shim de
 * CI declara um `default gen_random_uuid()` por conveniência, e esta função não depende dele justamente para
 * que o teste rode igual nos dois ambientes.
 */
async function criarUsuario(email: string): Promise<string> {
  const linhas = await consulta<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [email],
  );
  return linhas[0]!.id;
}

async function semear(): Promise<void> {
  idRecanto = (
    await consulta<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [RECANTO.nome, RECANTO.codigo],
    )
  )[0]!.id;

  idAurora = (
    await consulta<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [AURORA.nome, AURORA.codigo],
    )
  )[0]!.id;

  const usuarioSindica = await criarUsuario(emailDeTeste("sindica"));
  const usuarioMoradora = await criarUsuario(emailDeTeste("moradora"));

  idSindica = (
    await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, 'Síndica profissional') returning id`,
      [usuarioSindica],
    )
  )[0]!.id;

  idMoradora = (
    await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, 'Moradora do Recanto') returning id`,
      [usuarioMoradora],
    )
  )[0]!.id;

  // **A Persona 1B**: a mesma Pessoa nas duas organizações, com papéis diferentes.
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`, [
    idSindica,
    idRecanto,
  ]);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`, [
    idSindica,
    idAurora,
  ]);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'solicitante')`, [
    idMoradora,
    idRecanto,
  ]);

  // Uma categoria e uma área por organização, com nomes que se distinguem. A entrada da suíte semeia
  // **só o seu agregado**: pessoas e organizações são do mundo compartilhado, e é isso que preserva a
  // armadilha do A4 (arquitetura.md §7.1).
  await consulta(
    `insert into categorias (organizacao_id, nome, icone, ordem) values ($1, $2, 'shield', 1), ($3, $4, 'wrench', 1)`,
    [idRecanto, "Portaria do Recanto", idAurora, "Portaria da Aurora"],
  );
  await consulta(
    `insert into areas (organizacao_id, nome, tipo, ordem) values ($1, $2, 'comum', 1), ($3, $4, 'comum', 1)`,
    [idRecanto, "Garagem do Recanto", idAurora, "Garagem da Aurora"],
  );

  // **Os pedidos da mesma Pessoa nas duas organizações** — é a armadilha do A4 na forma deste item: quem
  // tem pedido pendente não tem vínculo, então a consulta parte de `pedidos_de_entrada` e faz `JOIN` para
  // `pessoas`, que é global. Se o escopo falhar, a Gestora de Recanto vê o pedido feito na Aurora.
  const pedidos = await consulta<{ id: string; organizacao_id: string }>(
    `insert into pedidos_de_entrada (organizacao_id, pessoa_id)
          values ($1, $3), ($2, $3)
       returning id, organizacao_id`,
    [idRecanto, idAurora, idMoradora],
  );
  idPedidoRecanto = pedidos.find((p) => p.organizacao_id === idRecanto)!.id;
  idPedidoAurora = pedidos.find((p) => p.organizacao_id === idAurora)!.id;
}

/**
 * **As duas consultas novas desta linha, pela suíte da §7.1.** Custo por consulta: uma entrada.
 *
 * Nenhuma das duas declara `organizacaoDaLinha`, e é por desenho: `CategoriaLida` e `AreaLida` **não
 * expõem `organizacao_id`** — a projeção o filtra, como o Definition of Done exige do tipo de retorno.
 */
describe("as consultas de configuração não atravessam organizações", () => {
  const mundo = { a: () => idRecanto, b: () => idAurora };

  casosDeIsolamento(mundo, {
    nome: "GET /categorias",
    consultar: (organizacaoId) =>
      repositorioEscopadoDeCategorias(escoparConsulta(consulta, organizacaoId)).listar({
        apenasAtivas: true,
      }),
    chaveDaLinha: (categoria) => categoria.nome,
    esperadas: { emA: ["Portaria do Recanto"], emB: ["Portaria da Aurora"] },
  });

  casosDeIsolamento(mundo, {
    nome: "GET /areas",
    consultar: (organizacaoId) =>
      repositorioEscopadoDeAreas(escoparConsulta(consulta, organizacaoId)).listar({
        apenasAtivas: true,
      }),
    chaveDaLinha: (area) => area.nome,
    esperadas: { emA: ["Garagem do Recanto"], emB: ["Garagem da Aurora"] },
  });

  /**
   * **A terceira consulta escopada desta suíte, e a primeira que não é de configuração.** Ela declara
   * `chaveDaLinha` pelo `id` do pedido, e não pelo nome da pessoa: é a **mesma** Pessoa nas duas
   * organizações, que é exatamente o cenário que detecta o vazamento.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /pedidos-de-entrada",
    consultar: (organizacaoId) =>
      repositorioEscopadoDePedidosDeEntrada(
        escoparConsulta(consulta, organizacaoId),
        escoparTransacao(criarTransacao(), organizacaoId),
      ).listar({ situacoes: ["pendente"] }),
    chaveDaLinha: (pedido) => pedido.id,
    // **Lidos tarde, e é obrigatório.** O corpo do `describe` roda na **coleta**, antes de qualquer
    // `beforeAll`: `[idPedidoRecanto]` avaliado ali seria `[undefined]`, e os dois casos falhariam
    // comparando conjuntos de `undefined`. As duas entradas existentes escapam disso por acaso — as
    // chaves delas são literais (`"Portaria do Recanto"`). Aqui a chave é um `uuid` gerado pelo banco,
    // então o valor tem de ser lido no instante do caso, que é o que o `get` faz. É a mesma razão de
    // `mundo` ser `{ a: () => …, b: () => … }` com funções.
    esperadas: {
      get emA() {
        return [idPedidoRecanto];
      },
      get emB() {
        return [idPedidoAurora];
      },
    },
  });

  /**
   * **A quarta, e a que fecha o item 9a.** Ela semeia **apenas o próprio agregado**: as pessoas e as
   * organizações são da suíte, e o cenário que detecta o vazamento já está montado — a síndica tem vínculo
   * nas **duas** organizações, e a moradora só em Recanto. *Seed* com pessoas distintas por organização
   * não detectaria o erro; é o critério A4, e a suíte é dona desse mundo.
   *
   * **`esperadas` vai em getter pela razão da entrada acima:** o corpo do `describe` roda na coleta, antes
   * de qualquer `beforeAll`, e `idSindica` lido ali ainda é `undefined`.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /vinculos",
    consultar: (organizacaoId) =>
      repositorioEscopadoDeVinculos(
        escoparConsulta(consulta, organizacaoId),
        escoparTransacao(criarTransacao(), organizacaoId),
      ).ativos(),
    chaveDaLinha: (vinculo) => vinculo.pessoa.pessoaId,
    esperadas: {
      get emA() {
        return [idSindica, idMoradora];
      },
      get emB() {
        return [idSindica];
      },
    },
  });

  /**
   * **A quinta, e a primeira do agregado `Ocorrência` (item 11).** Ela semeia **apenas o próprio
   * agregado**: as pessoas e as organizações são da suíte (§7.1 da `arquitetura.md`).
   *
   * Tenta ler **as duas** ocorrências com o escopo de **uma** só — a da outra organização tem de sumir.
   * É o cenário que detecta o vazamento de verdade: **a mesma Pessoa é autora nas duas**, então uma
   * consulta que partisse de `pessoas` em vez de `vinculos` devolveria as duas e passaria despercebida
   * num cenário com pessoas distintas.
   *
   * O terceiro caso da suíte — *"toda linha carrega a organização pedida"* — fica de fora por decisão da
   * própria suíte: `OcorrenciaLida` **não expõe `organizacao_id`**, de propósito, e onde ele não existe
   * os dois primeiros casos são a prova mais forte, porque comparam com as chaves realmente semeadas.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias/{id}",
    consultar: async (organizacaoId) => {
      const repo = portasDe(organizacaoId).ocorrencias;
      const lidas = await Promise.all([repo.porId(idDaOcorrenciaEmA), repo.porId(idDaOcorrenciaEmB)]);
      return lidas.filter((lida) => lida !== null);
    },
    chaveDaLinha: (ocorrencia) => ocorrencia.id,
    // **Em getter, e e obrigatorio** — a razao esta escrita na entrada de `GET /pedidos-de-entrada`,
    // acima no mesmo arquivo: o corpo do `describe` roda na **coleta**, antes de qualquer `beforeAll`, e
    // um `uuid` gerado pelo banco lido ali ainda e `undefined`. As duas entradas de configuracao escapam
    // por acaso, porque as chaves delas sao literais.
    esperadas: {
      get emA() {
        return [idDaOcorrenciaEmA];
      },
      get emB() {
        return [idDaOcorrenciaEmB];
      },
    },
  });

  /**
   * **A sexta entrada, e a primeira de listagem do agregado (item 14).**
   *
   * A anterior lê **duas ocorrências por id** e conta com o `null` para a de fora. Esta é o caso mais
   * perigoso e o que o critério **A4** de fato mira: uma consulta **sem identificador**, que devolve
   * *"tudo o que houver"*. Se o `$1` sumisse do `where`, esta entrada devolveria as duas organizações e
   * a anterior continuaria verde.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias",
    consultar: (organizacaoId) =>
      portasDe(organizacaoId).ocorrencias.listar({ limite: 50, cursor: null }),
    chaveDaLinha: (ocorrencia) => ocorrencia.id,
    esperadas: {
      get emA() {
        return [idDaOcorrenciaEmA];
      },
      get emB() {
        return [idDaOcorrenciaEmB];
      },
    },
  });
});

/**
 * ============================================================================
 *  As escritas escopadas — itens 4a e 5
 * ============================================================================
 *
 * **A suíte `casosDeIsolamento` não serve aqui, e a razão é a forma:** ela recebe
 * `consultar(organizacaoId) → readonly L[]` e compara conjuntos. Uma escrita não devolve conjunto —
 * devolve um desfecho. O que estes casos provam é a **mesma garantia pelo outro lado**: um `update` cujo
 * `where` carrega o `$1` de outra organização **não alcança a linha**, e o desfecho é `nao-encontrada` —
 * que é exatamente o `404` idêntico ao de inexistente que a §6.3 do contrato exige.
 */
describe("as escritas de configuração não atravessam organizações", () => {
  it("PATCH de categoria de outra organização não encontra a linha", async () => {
    const emRecanto = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idRecanto));
    const emAurora = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idAurora));

    const daAurora = (await emAurora.listar({ apenasAtivas: false }))[0];
    if (daAurora === undefined) throw new Error("a semente de Aurora não criou categoria");

    const recusado = await emRecanto.corrigir({
      categoriaId: daAurora.id,
      nome: "Sequestrada",
      atualizadaPorPessoaId: idSindica,
    });

    expect(recusado.desfecho).toBe("nao-encontrada");

    // E a linha continua intacta do lado de lá.
    const aindaLa = (await emAurora.listar({ apenasAtivas: false })).find((c) => c.id === daAurora.id);
    expect(aindaLa?.nome).toBe(daAurora.nome);
  });

  it("PATCH de área de outra organização não encontra a linha", async () => {
    const emRecanto = repositorioEscopadoDeAreas(escoparConsulta(consulta, idRecanto));
    const emAurora = repositorioEscopadoDeAreas(escoparConsulta(consulta, idAurora));

    const daAurora = (await emAurora.listar({ apenasAtivas: false }))[0];
    if (daAurora === undefined) throw new Error("a semente de Aurora não criou área");

    const recusado = await emRecanto.corrigir({
      areaId: daAurora.id,
      tipo: "privativa",
      atualizadaPorPessoaId: idSindica,
    });

    expect(recusado.desfecho).toBe("nao-encontrada");
  });

  it("o mesmo nome pode existir nas duas organizações — a unicidade é por organização", async () => {
    const emRecanto = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idRecanto));
    const emAurora = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idAurora));

    const aqui = await emRecanto.criar({
      nome: "Jardinagem",
      icone: "trees",
      ordem: 90,
      criadaPorPessoaId: idSindica,
    });
    // **`idSindica` e não `idMoradora`:** a FK de auditoria é composta para
    // `vinculos (pessoa_id, organizacao_id)`, e a síndica é a única Pessoa da semente com vínculo nas
    // **duas** organizações. A moradora só tem vínculo no Recanto — usá-la aqui violaria a FK, e o teste
    // falharia por uma razão que não é a que ele investiga.
    const la = await emAurora.criar({
      nome: "Jardinagem",
      icone: "trees",
      ordem: 90,
      criadaPorPessoaId: idSindica,
    });

    expect(aqui.desfecho).toBe("criada");
    expect(la.desfecho).toBe("criada");
  });

  it("o mesmo nome duas vezes na mesma organização é recusado", async () => {
    const emRecanto = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idRecanto));

    await emRecanto.criar({
      nome: "Paisagismo",
      icone: "trees",
      ordem: 91,
      criadaPorPessoaId: idSindica,
    });
    const repetido = await emRecanto.criar({
      nome: "Paisagismo",
      icone: "trees",
      ordem: 92,
      criadaPorPessoaId: idSindica,
    });

    expect(repetido.desfecho).toBe("nome-duplicado");
  });

  /**
   * **O critério 4a.2, pela metade que existe hoje.** *"`PATCH {ativa: false}` **não apaga**"* — o
   * seletor de T-04 é do item 11, mas a lista que o alimenta é esta, e o padrão dela é *só as ativas*
   * (`consultas.ts`). O que este caso prova é que desativar **tira da leitura padrão sem tirar a linha**,
   * que é a diferença entre desativar e apagar.
   */
  it("desativar não apaga: sai da leitura padrão e continua na completa", async () => {
    const emRecanto = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idRecanto));

    const criada = await emRecanto.criar({
      nome: "Sauna",
      icone: "flame",
      ordem: 94,
      criadaPorPessoaId: idSindica,
    });
    if (criada.desfecho !== "criada") throw new Error("a criação de Sauna não devolveu categoria");

    await emRecanto.corrigir({
      categoriaId: criada.categoria.id,
      ativa: false,
      atualizadaPorPessoaId: idSindica,
    });

    const soAtivas = await emRecanto.listar({ apenasAtivas: true });
    expect(soAtivas.map((c) => c.id)).not.toContain(criada.categoria.id);

    // E a linha continua lá — é a leitura de T-09, que é onde se reativa o que foi desativado.
    const todas = await emRecanto.listar({ apenasAtivas: false });
    expect(todas.find((c) => c.id === criada.categoria.id)?.ativa).toBe(false);
  });

  it("a criação grava quem criou, e a correção grava quem alterou", async () => {
    const emRecanto = repositorioEscopadoDeCategorias(escoparConsulta(consulta, idRecanto));

    const criada = await emRecanto.criar({
      nome: "Piscina",
      icone: "droplets",
      ordem: 93,
      criadaPorPessoaId: idSindica,
    });
    expect(criada.desfecho).toBe("criada");
    if (criada.desfecho !== "criada") return;

    const [antes] = await consulta<{
      criado_por_pessoa_id: string | null;
      atualizado_por_pessoa_id: string | null;
    }>(`select criado_por_pessoa_id, atualizado_por_pessoa_id from categorias where id = $1`, [
      criada.categoria.id,
    ]);
    expect(antes?.criado_por_pessoa_id).toBe(idSindica);
    // Na criação, **não há alteração ainda** — a coluna do último a escrever fica nula de propósito.
    expect(antes?.atualizado_por_pessoa_id).toBeNull();

    await emRecanto.corrigir({
      categoriaId: criada.categoria.id,
      nome: "Piscina e sauna",
      atualizadaPorPessoaId: idSindica,
    });

    const [depois] = await consulta<{ atualizado_por_pessoa_id: string | null }>(
      `select atualizado_por_pessoa_id from categorias where id = $1`,
      [criada.categoria.id],
    );
    expect(depois?.atualizado_por_pessoa_id).toBe(idSindica);
  });
});
