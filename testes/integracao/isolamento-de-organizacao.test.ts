import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import { mesEmSaoPaulo } from "@/aplicacao/dashboard";
import { registrarOcorrencia } from "@/aplicacao/ocorrencia";
import {
  ListaDesatualizada,
  criarArea,
  criarCategoria,
  listarVinculos,
  reordenarAreas,
  reordenarCategorias,
  type Reordenacao,
} from "@/aplicacao/organizacao";
import { criarTransacao } from "@/infraestrutura/clientes";
import { ConsultaSemEscopo, escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeDashboard } from "@/infraestrutura/repositorios/dashboard";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioEscopadoDaOrganizacao,
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
let idDoAnexoEmA: string;
let idDoAnexoEmB: string;
/** Constantes, e não `uuid` do banco: são a `chaveDaLinha` da entrada, e o `SUFIXO` já as torna únicas
 *  entre execuções — que é o que o `UNIQUE (chave)` GLOBAL de `anexos` exige. */
const chaveDoAnexoEmA = `anx_iso_a_${SUFIXO}`;
const chaveDoAnexoEmB = `anx_iso_b_${SUFIXO}`;
/** **Instantes literais e distintos**, e é a `chaveDaLinha` da nona entrada: `AtribuicaoLida` não tem
 *  `id` — modelo de leitura correto não expõe chave interna —, e `responsavel.pessoaId` não serve porque
 *  só `idSindica` tem vínculo nas DUAS organizações, o que faria a chave ser legitimamente compartilhada
 *  e enfraqueceria o caso. */
const ATRIBUIDA_EM_A = "2026-08-01T10:00:00.000Z";
const ATRIBUIDA_EM_B = "2026-08-02T11:00:00.000Z";
/** Um corte que inclui tudo — estes casos não são sobre paginação, e um corte real os tornaria frágeis. */
const NO_FUTURO = "2099-01-01T00:00:00.000Z";
/** A categoria da ocorrência de B — o identificador de FORA que o filtro do item 15 aceita do cliente. */
let idDaCategoriaDeB: string;
/** A área da ocorrência de B — o que a décima segunda entrada pede **dentro de A**. */
let idDaAreaDeB: string;

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

/**
 * **As duas portas de configuração, como a produção as monta desde o item 50:** a consulta para a
 * leitura e para as escritas de uma instrução só, e a transação escopada para a reordenação.
 */
function categoriasEm(organizacaoId: string) {
  return repositorioEscopadoDeCategorias(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

function areasEm(organizacaoId: string) {
  return repositorioEscopadoDeAreas(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

/** O retrato de uma lista, lido direto da tabela: é o que a atomicidade e o isolamento comparam. */
async function retratoDe(tabela: "categorias" | "areas", organizacaoId: string) {
  return consulta<{
    id: string;
    ordem: number;
    atualizado_por_pessoa_id: string | null;
    atualizado_em: Date;
  }>(
    `select id, ordem, atualizado_por_pessoa_id, atualizado_em
       from ${tabela}
      where organizacao_id = $1
      order by id`,
    [organizacaoId],
  );
}

function portasDe(organizacaoId: string) {
  const escopada = escoparConsulta(consulta, organizacaoId);
  return {
    ocorrencias: repositorioEscopadoDeOcorrencias(
      escopada,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    categorias: categoriasEm(organizacaoId),
    areas: areasEm(organizacaoId),
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
  for (const [organizacaoId, chaveDoAnexo, guardar] of [
    [
      idRecanto,
      chaveDoAnexoEmA,
      (o: string, a: string) => {
        idDaOcorrenciaEmA = o;
        idDoAnexoEmA = a;
      },
    ],
    [
      idAurora,
      chaveDoAnexoEmB,
      (o: string, a: string) => {
        idDaOcorrenciaEmB = o;
        idDoAnexoEmB = a;
      },
    ],
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

    // A FK `anexos_anexado_por_fk` aponta para `vinculos (pessoa_id, organizacao_id)`, e `idSindica`
    // tem vínculo nas duas organizações — é a mesma razão que faz a ocorrência caber nas duas.
    const [anexo] = await consulta<{ id: string }>(
      `insert into anexos
         (organizacao_id, ocorrencia_id, tipo, chave, tipo_conteudo, tamanho_bytes, anexado_por_pessoa_id)
       values ($1, $2, 'imagem', $3, 'image/jpeg', 391244, $4)
       returning id`,
      [organizacaoId, lida.id, chaveDoAnexo, idSindica],
    );

    // **A entrada de isolamento semeia só o seu agregado** (§7.1): a Pessoa e a organização são da suíte.
    // A FK `atribuicoes_responsavel_fk` aponta para `vinculos (pessoa_id, organizacao_id)`, e `idSindica`
    // tem vínculo nas duas — é a mesma razão que faz a ocorrência caber nas duas.
    await consulta(
      `insert into atribuicoes
         (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id, atribuido_em)
       values ($1, $2, $3, $3, $4::timestamptz)`,
      [organizacaoId, lida.id, idSindica, organizacaoId === idRecanto ? ATRIBUIDA_EM_A : ATRIBUIDA_EM_B],
    );

    // **Item 30 — o canal 1 nas duas organizações.** Semeia apenas o próprio agregado: a síndica tem
    // vínculo nas DUAS, e é ela quem escreve as duas mensagens. É o cenário do critério A4 — *seed* com
    // pessoas distintas por organização não detectaria o vazamento.
    await portas.ocorrencias.comentar(lida.id, {
      autorPessoaId: idSindica,
      texto: `mensagem de ${organizacaoId}`,
      em: new Date().toISOString(),
    });

    guardar(lida.id, anexo!.id);
    // O identificador de categoria que a oitava entrada de isolamento pede **dentro de A**. Lido aqui
    // porque é a categoria que a ocorrência de B de fato aponta — o `insert` de `semear()` cria uma por
    // organização, e qual delas é a de B só se sabe lendo.
    if (organizacaoId === idAurora) {
      idDaCategoriaDeB = categoria!.id;
      idDaAreaDeB = area!.id;
    }
  }

  /**
   * **A resolução da ocorrência de A — e ela existe para a entrada do dashboard morder.**
   *
   * A consulta `resolucoesPorMes` filtra `status_novo = 'resolvida'`, e o mundo da suíte tem as duas
   * ocorrências `aberta`: sem isto, ela devolveria lista vazia nas duas organizações e o caso passaria
   * sem provar nada (achado **A-32-7** do plano).
   *
   * **Muda a ocorrência que já existe, em vez de criar uma segunda**, e a diferença é obrigatória: as
   * entradas de `GET /ocorrencias/{id}`, `GET /ocorrencias` e `GET /ocorrencias?categoriaId=` declaram
   * `esperadas` com **exatamente um** identificador por organização, e uma ocorrência a mais em A as
   * quebraria. Todas as três usam `id` como chave, então a troca de `status` não alcança nenhuma.
   *
   * **A trilha recebe `sequencia = 2`, `aberta → resolvida`.** O banco não valida a máquina de estados —
   * quem valida é o agregado —, e o `registros_transicao_mudanca_ck` só exige que anterior e novo
   * difiram. É fixture, não caminho de produção.
   *
   * **A nota entra na mesma instrução do `status`** porque o `ocorrencias_avaliacao_ck` exige as três
   * colunas coerentes **e** `status = 'resolvida'` na mesma linha.
   */
  await consulta(
    `update ocorrencias
        set status = 'resolvida',
            avaliacao_nota = 5,
            avaliada_em = now(),
            atualizada_em = now()
      where id = $1 and organizacao_id = $2`,
    [idDaOcorrenciaEmA, idRecanto],
  );
  await consulta(
    `insert into registros_transicao
       (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
     values ($1, $2, 2, 'aberta', 'resolvida', $3)`,
    [idRecanto, idDaOcorrenciaEmA, idSindica],
  );
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

  it("a lista de candidatos do modal de atribuir não traz ninguém de outra organização (critério 66.6)", async () => {
    // É a MESMA chamada que T-05 faz para montar o modal (`page.tsx`, `candidatos`).
    const reposDeAurora = repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, idAurora),
      escoparTransacao(criarTransacao(), idAurora),
    );
    const candidatos = (await listarVinculos(reposDeAurora)).map((lido) => lido.pessoa.pessoaId);

    expect(candidatos).toContain(idSindica);
    expect(candidatos).not.toContain(idMoradora);
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
      categoriasEm(organizacaoId).listar({
        apenasAtivas: true,
      }),
    chaveDaLinha: (categoria) => categoria.nome,
    esperadas: { emA: ["Portaria do Recanto"], emB: ["Portaria da Aurora"] },
  });

  casosDeIsolamento(mundo, {
    nome: "GET /areas",
    consultar: (organizacaoId) =>
      areasEm(organizacaoId).listar({
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
      portasDe(organizacaoId).ocorrencias.listar({ limite: 50, deslocamento: 0, ate: NO_FUTURO }),
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

  /**
   * **A sétima entrada, e a primeira do anexo (item 13b).** Ela semeia **apenas o próprio agregado** —
   * as pessoas e as organizações são da suíte (§7.1).
   *
   * O que ela mira é o `objetoDoAnexo`: uma consulta por `(ocorrenciaId, anexoId)` que devolve a **chave
   * do storage**. Se o `$1` sumisse do `where`, o `anexoId` de outra organização passaria a ser
   * resolvível — e o `302` entregaria a foto de outro condomínio a quem tem o identificador.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias/{id}/anexos/{anexoId}",
    consultar: async (organizacaoId) => {
      const repo = portasDe(organizacaoId).ocorrencias;
      const lidos = await Promise.all([
        repo.objetoDoAnexo(idDaOcorrenciaEmA, idDoAnexoEmA),
        repo.objetoDoAnexo(idDaOcorrenciaEmB, idDoAnexoEmB),
      ]);
      return lidos.filter((objeto) => objeto !== null);
    },
    chaveDaLinha: (objeto) => objeto.chave,
    // **Os `get` são obrigatórios** — o corpo do `describe` roda na coleta, antes de qualquer
    // `beforeAll`. É a mesma nota que a entrada de `GET /ocorrencias/{id}` já carrega.
    esperadas: {
      get emA() {
        return [chaveDoAnexoEmA];
      },
      get emB() {
        return [chaveDoAnexoEmB];
      },
    },
  });

  /**
   * **A entrada do item 30 — a conversa.** Ela mira o `SELECT_DAS_MENSAGENS`: uma consulta que
   * **atravessa duas tabelas novas** (`mensagens` → `canais_conversa`) e um par de `join` de pessoa. Se o
   * `$1` sumisse do `where`, ou se o `join` do canal perdesse o `and c.organizacao_id = m.organizacao_id`,
   * a conversa de outro condomínio apareceria dentro desta — e é este caso que acende.
   *
   * **Pede as DUAS ocorrências com o escopo de UMA**, como a entrada de `GET /ocorrencias/{id}`: a de
   * fora tem de devolver lista vazia, e não a mensagem dela.
   *
   * O terceiro caso da suíte — *"toda linha carrega a organização pedida"* — fica de fora pela decisão da
   * própria suíte: `ComentarioLido` **não expõe `organizacao_id`**, de propósito.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias/{id}/comentarios",
    consultar: async (organizacaoId) => {
      const repo = portasDe(organizacaoId).ocorrencias;
      const paginas = await Promise.all([
        repo.comentarios(idDaOcorrenciaEmA, { limite: 20, cursor: null }),
        repo.comentarios(idDaOcorrenciaEmB, { limite: 20, cursor: null }),
      ]);
      return paginas.flat();
    },
    chaveDaLinha: (comentario) => comentario.texto,
    // **Em getter, e é obrigatório** — o corpo do `describe` roda na coleta, antes de qualquer
    // `beforeAll`. É a mesma nota que a entrada de `GET /ocorrencias/{id}` já carrega.
    esperadas: {
      get emA() {
        return [`mensagem de ${idRecanto}`];
      },
      get emB() {
        return [`mensagem de ${idAurora}`];
      },
    },
  });

  /**
   * **A oitava entrada, e a primeira em que um identificador de FORA entra na consulta vindo do cliente.**
   *
   * A entrada de `GET /ocorrencias` acima prova que a listagem **sem filtro** não atravessa organizações.
   * Esta prova o caminho novo do item 15: `?categoriaId=<uuid de B>` pedido **dentro de A**. Se o `where`
   * do filtro fosse escrito fora do repositório escopado, ou se o `join` de categoria perdesse o
   * `and c.organizacao_id = o.organizacao_id`, é este caso que acende — e nenhum dos anteriores acenderia.
   *
   * **O caso *"escopada em A devolve o que foi semeado em A"* passa com `emA` vazio**, e é justamente essa
   * a prova: pedir a categoria de B dentro de A não traz **nada**, nem de A nem de B.
   *
   * **`organizacaoDaLinha` fica de fora de propósito:** o terceiro caso que ele liga exige
   * `linhas.length > 0` em A, e aqui A devolve zero **por construção**.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias?categoriaId= (identificador da outra organização)",
    // O identificador é SEMPRE o da categoria de B — inclusive quando quem pergunta é A.
    consultar: (organizacaoId) =>
      portasDe(organizacaoId).ocorrencias.listar({
        limite: 50,
        deslocamento: 0,
        ate: NO_FUTURO,
        filtro: { categoriaId: [idDaCategoriaDeB] },
      }),
    chaveDaLinha: (ocorrencia) => ocorrencia.id,
    // **Em getter, pela razão que as entradas vizinhas já explicam**: o corpo do `describe` roda na
    // coleta, antes de qualquer `beforeAll`, e um `uuid` lido ali ainda é `undefined`.
    esperadas: {
      get emA() {
        return [];
      },
      get emB() {
        return [idDaOcorrenciaEmB];
      },
    },
  });

  /**
   * **A nona entrada, e a primeira da linha do tempo (item 29).** Ela semeia **apenas o próprio
   * agregado** — as pessoas e as organizações são da suíte (§7.1).
   *
   * O que ela mira é o `SELECT_DAS_ATRIBUICOES`: uma consulta com **dois pares de `join` que partem de
   * `vinculos`** e alcançam `pessoas`, que é global. Se qualquer um dos quatro perdesse o
   * `and v.organizacao_id = at.organizacao_id`, ou se o `$1` sumisse do `where`, a linha do tempo de uma
   * ocorrência de Recanto passaria a nomear quem é da Aurora — **e nenhuma das oito entradas anteriores
   * acenderia**, porque nenhuma delas lê `atribuicoes` por ocorrência.
   *
   * **A consulta pede as DUAS ocorrências com o escopo de UMA**, como a entrada de `GET /ocorrencias/{id}`
   * faz: é o que prova que a de fora devolve lista vazia em vez de linha alheia.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias/{id}/linha-do-tempo",
    consultar: async (organizacaoId) => {
      const repo = portasDe(organizacaoId).ocorrencias;
      const lidas = await Promise.all([
        repo.atribuicoes(idDaOcorrenciaEmA),
        repo.atribuicoes(idDaOcorrenciaEmB),
      ]);
      return lidas.flat();
    },
    chaveDaLinha: (atribuicao) => atribuicao.atribuidoEm,
    // **Em getter, e é obrigatório** — o corpo do `describe` roda na coleta, antes de qualquer
    // `beforeAll`. Aqui as chaves são literais e escapariam por acaso; o getter fica pela mesma razão
    // que a entrada de `GET /ocorrencias/{id}` a carrega: a forma é a mesma para quem lê depois.
    esperadas: {
      get emA() {
        return [ATRIBUIDA_EM_A];
      },
      get emB() {
        return [ATRIBUIDA_EM_B];
      },
    },
  });

  /**
   * **A décima entrada, e a primeira do dashboard (itens 32 a 36).** Ela semeia **apenas o próprio
   * agregado** — as pessoas, as organizações, as categorias, as áreas e as duas ocorrências são da suíte
   * (§7.1); o que é dela é a resolução de A, semeada no `beforeAll`.
   *
   * **É a única entrada que exercita DEZ consultas de uma vez**, e a `chaveDaLinha` é o que faz isso
   * funcionar: cada linha vira uma frase que carrega **a dimensão, o rótulo e o número**. Um `$1` perdido
   * em qualquer uma das dez muda pelo menos um número ou traz um rótulo da outra organização — e nos
   * dois casos o conjunto deixa de bater.
   *
   * **A sétima consulta devolve vazio dos dois lados, e é prova fraca — por isso está dito.** O mundo
   * da suíte tem **uma** ocorrência por organização, e o mínimo do par é dois: nenhuma dupla chega lá.
   * A entrada passa a exercitar a consulta contra o `$1` e a provar que ela não traz linha da outra
   * organização; quem prova o **conteúdo** dela é `testes/integracao/dashboard.test.ts`.
   *
   * **As três do item 73 seguem a mesma regra.** Nenhuma das duas ocorrências foi cancelada, então as
   * canceladas voltam vazias dos dois lados, e o início da janela, em 2000, não tem ninguém. A que morde é
   * a das mais velhas: a única em aberto é a de B, e o título dela é o mesmo nas duas organizações, então
   * um `$1` perdido a faria aparecer em A.
   *
   * **Os rótulos são únicos por organização, de propósito**: a suíte semeia *"Portaria do Recanto"* contra
   * *"Portaria da Aurora"* e *"Garagem do Recanto"* contra *"Garagem da Aurora"*. É o que faz o vazamento
   * aparecer como frase estranha, e não como número maior.
   *
   * **A janela é explícita e larga**, nunca a padrão: as ocorrências nascem com `registrada_em = now()`, e
   * uma janela fixa em datas literais deixaria o caso amarelo em janeiro. `de` no começo do mês corrente
   * seria frágil na virada; `2000-01-01` até `2099-12-31` não é.
   *
   * O terceiro caso da suíte — *"toda linha carrega a organização pedida"* — fica de fora pela decisão da
   * própria suíte: **nenhum dos dez modelos de leitura expõe `organizacao_id`**, e é assim que o
   * Definition of Done os quer.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /dashboard",
    consultar: async (organizacaoId) => {
      const repo = repositorioEscopadoDeDashboard(escoparConsulta(consulta, organizacaoId));
      const janela = { de: "2000-01-01", ate: "2099-12-31" };

      const [
        status,
        categorias,
        porCategoria,
        porArea,
        resolucoes,
        idades,
        duplas,
        canceladas,
        noInicio,
        velhas,
      ] = await Promise.all([
        repo.backlogPorStatus(),
        repo.abertasPorCategoria(),
        repo.recorrenciaPorCategoria(janela),
        repo.recorrenciaPorArea(janela),
        repo.resolucoesPorMes(janela),
        repo.abertasPorIdade(),
        repo.duplasRecorrentes(janela),
        repo.canceladasPorMes(janela),
        repo.emAbertoNoInicio(janela),
        repo.maisVelhasEmAberto(),
      ]);

      return [
        ...status.map((l) => `status:${l.status}:${String(l.quantidade)}`),
        ...categorias.map(
          (l) =>
            `abertas-categoria:${l.categoria.nome}:${String(l.quantidade)}:${String(l.envelhecidas)}`,
        ),
        ...porCategoria.map(
          (l) => `recorrencia-categoria:${l.categoria.nome}:${l.mes}:${String(l.quantidade)}`,
        ),
        ...porArea.map((l) => `recorrencia-area:${l.area.nome}:${l.mes}:${String(l.quantidade)}`),
        ...resolucoes.map(
          (l) => `resolucao:${l.mes}:${String(l.resolvidas)}:${String(l.avaliadas)}`,
        ),
        ...idades.map((l) => `idade-em-aberto:${String(l.faixa)}:${String(l.quantidade)}`),
        ...duplas.map((l) => `dupla:${l.area.nome}:${l.categoria.nome}:${String(l.quantidade)}`),
        ...canceladas.map((l) => `canceladas:${l.mes}:${String(l.quantidade)}`),
        `em-aberto-no-inicio:${String(noInicio)}`,
        ...velhas.map((l) => `mais-velha:${l.titulo}:${l.status}`),
      ];
    },
    chaveDaLinha: (frase) => frase,
    // **Em getter, e é obrigatório** — o corpo do `describe` roda na coleta, antes de qualquer
    // `beforeAll`. É a mesma nota que a entrada de `GET /ocorrencias/{id}` já carrega. E o mês é lido no
    // instante do caso pela MESMA função que o SQL reproduz com `date_trunc`, para que o caso não vire
    // vermelho na virada do mês.
    esperadas: {
      get emA() {
        const mes = mesEmSaoPaulo(new Date());
        return [
          "status:resolvida:1",
          // **Zero, e é o item 56 acontecendo aqui dentro.** A única ocorrência de A é `resolvida`, e o
          // bloco por categoria passou a contar só o que está em aberto. *Portaria do Recanto* é ativa,
          // então ela continua aparecendo — com zero, que é o critério 32.3 e a primeira metade do 56.6.
          "abertas-categoria:Portaria do Recanto:0:0",
          `recorrencia-categoria:Portaria do Recanto:${mes}:1`,
          `recorrencia-area:Garagem do Recanto:${mes}:1`,
          `resolucao:${mes}:1:1`,
          "em-aberto-no-inicio:0",
        ];
      },
      get emB() {
        const mes = mesEmSaoPaulo(new Date());
        return [
          "status:aberta:1",
          // O segundo número é `envelhecidas`: a ocorrência nasce com `now()`, e nada passou de 7 dias.
          "abertas-categoria:Portaria da Aurora:1:0",
          `recorrencia-categoria:Portaria da Aurora:${mes}:1`,
          `recorrencia-area:Garagem da Aurora:${mes}:1`,
          // **A ocorrência de B nasce com `registrada_em` no instante da corrida**, então a idade é 0 e
          // a faixa é a primeira. **`emA` não ganha linha nenhuma**, e é aí que a prova mora: a única
          // ocorrência de A é `resolvida`, que é terminal — se o filtro de organização escorregar, a
          // linha de B aparece no conjunto de A e o PRIMEIRO caso da suíte cai.
          "idade-em-aberto:0:1",
          "em-aberto-no-inicio:0",
          "mais-velha:Lâmpada queimada na garagem:aberta",
        ];
      },
    },
  });

  /**
   * **A décima primeira entrada — o item 10.** Ela semeia **apenas o seu próprio agregado**, e neste caso
   * o agregado é *nada*: as pessoas, as organizações, as ocorrências, os anexos, as atribuições e as
   * mensagens são da suíte (§7.1), e o que a consulta faz é **derivar** delas.
   *
   * **A `chaveDaLinha` carrega a RAZÃO, e não só o `pessoaId` — sem isso o caso passaria sem provar
   * nada.** No mundo da suíte a síndica está nas duas organizações e tem rastro nas duas, e a moradora,
   * que só existe em Recanto, **não tem impedimento nenhum**: `organizacoes.criada_por_pessoa_id` é nulo
   * no `semear()`, e categorias e áreas entram sem autoria. Com `chaveDaLinha = pessoaId`, `emA` e `emB`
   * seriam o **mesmo** conjunto, e o segundo caso da suíte passaria por vacuidade.
   *
   * Com a razão junto, os conjuntos ficam **disjuntos** — e a diferença é exatamente o que a consulta
   * calcula:
   *
   * | | Papel da síndica | Impedimento |
   * |---|---|---|
   * | **Recanto (A)** | `gestor`, e o único da organização | `ultimo-gestor` — a precedência da spec §3.4 |
   * | **Aurora (B)** | `solicitante`; Aurora não tem Gestor nenhum | `historico` |
   *
   * Um `$1` perdido em qualquer um dos dez `exists` muda a frase de pelo menos uma das duas.
   *
   * O terceiro caso da suíte fica de fora pela decisão dela própria: **o modelo de leitura não expõe
   * `organizacao_id`**, e é assim que o Definition of Done o quer.
   */
  casosDeIsolamento(mundo, {
    nome: "impedimentosDeRemocao",
    consultar: async (organizacaoId) => {
      const repo = repositorioEscopadoDeVinculos(
        escoparConsulta(consulta, organizacaoId),
        escoparTransacao(criarTransacao(), organizacaoId),
      );
      return [...(await repo.impedimentosDeRemocao())].map(
        ([pessoaId, razao]) => `${pessoaId}:${razao}`,
      );
    },
    chaveDaLinha: (frase) => frase,
    esperadas: {
      get emA() {
        // A moradora **não aparece**, e é o terceiro fato que esta entrada prova: sem rastro, sem
        // impedimento, sem entrada no mapa.
        return [`${idSindica}:ultimo-gestor`];
      },
      get emB() {
        return [`${idSindica}:historico`];
      },
    },
  });

  /**
   * **A décima segunda entrada — o recorte de área do item 67.** Ela é a irmã da oitava: aquela pede a
   * **categoria** de B dentro de A, esta pede a **área**.
   *
   * O que ela mira é a condição nova de `condicoesDoRecorte` e o `join` de área do `SELECT_DO_RESUMO`. Se
   * o `and a.organizacao_id = o.organizacao_id` do `join` caísse, ou se a condição do filtro fosse
   * montada fora do repositório escopado, é este caso que acende — e nenhum dos anteriores acenderia,
   * porque nenhum deles filtra por área.
   *
   * **`emA` vazio É a prova**: pedir a área de B dentro de A não traz nada, nem de A nem de B.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias?areaId= (identificador da outra organização)",
    // O identificador é SEMPRE o da área de B — inclusive quando quem pergunta é A.
    consultar: (organizacaoId) =>
      portasDe(organizacaoId).ocorrencias.listar({
        limite: 50,
        deslocamento: 0,
        ate: NO_FUTURO,
        filtro: { areaId: [idDaAreaDeB] },
      }),
    chaveDaLinha: (ocorrencia) => ocorrencia.id,
    // **Em getter, pela razão que as entradas vizinhas já explicam**: o corpo do `describe` roda na
    // coleta, antes de qualquer `beforeAll`, e um `uuid` lido ali ainda é `undefined`.
    esperadas: {
      get emA() {
        return [];
      },
      get emB() {
        return [idDaOcorrenciaEmB];
      },
    },
  });

  /**
   * **A décima terceira entrada — o recorte de responsável, e ela é o cenário do critério A4.**
   *
   * As duas anteriores pedem um identificador que só existe **de um lado**, e por isso `emA` é vazio.
   * Esta pede `idSindica`, que é responsável vigente nas **duas** organizações: o conjunto esperado é
   * diferente em cada lado, e **nenhum dos dois é vazio**. É a armadilha do A4 — uma semente com pessoas
   * distintas por organização não detectaria o vazamento, porque nenhum identificador seria comum.
   *
   * **O que ela prova de fato.** Se o `exists` das atribuições perdesse o
   * `atf.organizacao_id = o.organizacao_id`, nada vazaria aqui: o `where o.organizacao_id = $1` de fora
   * segura a lista. O que morde é o outro lado — que o filtro por uma Pessoa **global** não atravessa o
   * `$1`, e quem pergunta em A recebe a de A e só a de A, mesmo com o responsável sendo a mesma pessoa.
   */
  casosDeIsolamento(mundo, {
    nome: "GET /ocorrencias?responsavelPessoaId= (a mesma Pessoa nas duas organizações)",
    consultar: (organizacaoId) =>
      portasDe(organizacaoId).ocorrencias.listar({
        limite: 50,
        deslocamento: 0,
        ate: NO_FUTURO,
        filtro: { responsavelPessoaId: [idSindica] },
      }),
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

  /**
   * ==========================================================================
   *  14b.6 · As contagens sob a visibilidade — o COUNT ingênuo é o vazamento
   * ==========================================================================
   *
   * **Não entra por `casosDeIsolamento`, e a razão é a assinatura.** A suíte pergunta *"quais linhas
   * voltam"* — `(organizacaoId) => Promise<readonly L[]>` com `chaveDaLinha` — e uma contagem é um
   * escalar. Embrulhá-la numa lista de uma linha provaria menos e leria pior. **A entrada da suíte
   * continua sendo a de `GET /ocorrencias`, acima**; estes casos são a metade que a suíte não sabe fazer.
   *
   * **O risco é de outra natureza que o das listagens.** Uma listagem que vaza mostra títulos, e alguém
   * vê. Uma contagem que vaza mostra **um número**, e o número parece inofensivo: ele revela apenas
   * *quantas existem*. Só que *quantas existem* é justamente o que o Solicitante não pode saber — é a
   * existência de ocorrências alheias, que é o que o multi-tenant deste projeto compra.
   *
   * **E ela é a ÚLTIMA do bloco de propósito, e não a sétima como o plano previa.** Ela é a única
   * entrada deste arquivo que **acrescenta linhas ao mundo compartilhado** — duas ocorrências —, e o
   * mundo é lido por conjunto exato: o `GET /dashboard` afirma `status:resolvida:1` e o
   * `impedimentosDeRemocao` afirma que *"a moradora não aparece, sem rastro, sem impedimento"*. Semeadas
   * antes, as duas ocorrências **quebram as duas entradas** — e quebram por estarem certas, o que é a
   * pior forma de um caso falhar. Semeadas no fim, nenhuma outra entrada as vê.
   *
   * **A entrada semeia só o seu próprio agregado** (§7.1): as duas ocorrências da moradora em Recanto.
   * As pessoas, as organizações, a categoria e a área continuam sendo do mundo compartilhado — e é
   * `idMoradora` quem serve, porque é a única Pessoa cujo recorte de autor é **estritamente menor** que
   * a organização: `solicitante` em Recanto, sem vínculo na Aurora. A ocorrência que a suíte já semeou em
   * Recanto é da **síndica**, então sem estas duas a moradora seria autora de zero e as asserções não
   * teriam o que comparar.
   */
  describe("14b.6 · as contagens respeitam a visibilidade do vínculo", () => {
    beforeAll(async () => {
      const [categoria] = await consulta<{ id: string }>(
        `select id from categorias where organizacao_id = $1 limit 1`,
        [idRecanto],
      );
      const [area] = await consulta<{ id: string }>(
        `select id from areas where organizacao_id = $1 limit 1`,
        [idRecanto],
      );

      for (const titulo of ["Portão da moradora", "Interfone da moradora"]) {
        await consulta(
          `insert into ocorrencias
             (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id)
           values ($1, $2, $3, 'comum', $4, $5, $6)`,
          [
            idRecanto,
            categoria!.id,
            area!.id,
            `${titulo} ${SUFIXO}`,
            "Semeada para o critério 14b.6 — duas, e só duas.",
            idMoradora,
          ],
        );
      }
    });

    it("a Solicitante autora de 2 numa organização de mais recebe contagens ≤ 2", async () => {
      const repo = portasDe(idRecanto).ocorrencias;

      const semRecorte = await repo.contar({
        pessoaIdDeQuemPergunta: idMoradora,
        ate: NO_FUTURO,
      });
      const comVisibilidade = await repo.contar({
        autorPessoaId: idMoradora,
        autorPessoaIdDaPagina: idMoradora,
        pessoaIdDeQuemPergunta: idMoradora,
        ate: NO_FUTURO,
      });

      // Sem o recorte de autor, a organização inteira é contada — é o COUNT ingênuo, e ele existe.
      expect(semRecorte.totalFiltrado).toBeGreaterThan(comVisibilidade.totalFiltrado);

      // **Com ele, nenhum dos SEIS números passa de 2** — nem `emAberto`, nem `semResponsavel`.
      expect(comVisibilidade.totalFiltrado).toBe(2);
      expect(comVisibilidade.todas).toBe(2);
      expect(comVisibilidade.minhas).toBe(2);
      expect(comVisibilidade.emAberto).toBe(2);
      expect(comVisibilidade.semResponsavel).toBe(2);
      expect(comVisibilidade.novas).toBe(0);
    });

    it("as contagens de A não enxergam B — nem por um número", async () => {
      const emA = await portasDe(idRecanto).ocorrencias.contar({
        pessoaIdDeQuemPergunta: idSindica,
        ate: NO_FUTURO,
      });
      const emB = await portasDe(idAurora).ocorrencias.contar({
        pessoaIdDeQuemPergunta: idSindica,
        ate: NO_FUTURO,
      });

      const listadasEmA = await portasDe(idRecanto).ocorrencias.listar({
        limite: 100,
        deslocamento: 0,
        ate: NO_FUTURO,
      });
      const listadasEmB = await portasDe(idAurora).ocorrencias.listar({
        limite: 100,
        deslocamento: 0,
        ate: NO_FUTURO,
      });

      // **O número bate com o que a listagem escopada devolve, nas duas.** É a afirmação forte: se a
      // contagem esquecesse o `organizacao_id`, ela daria a soma das duas nos dois lados.
      expect(emA.totalFiltrado).toBe(listadasEmA.length);
      expect(emB.totalFiltrado).toBe(listadasEmB.length);
      // E os dois lados não são o mesmo conjunto — sem isto o caso passaria por vacuidade.
      expect(emA.totalFiltrado).toBeGreaterThan(emB.totalFiltrado);
    });
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
    const emRecanto = categoriasEm(idRecanto);
    const emAurora = categoriasEm(idAurora);

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
    const emRecanto = areasEm(idRecanto);
    const emAurora = areasEm(idAurora);

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
    const emRecanto = categoriasEm(idRecanto);
    const emAurora = categoriasEm(idAurora);

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
    const emRecanto = categoriasEm(idRecanto);

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
    const emRecanto = categoriasEm(idRecanto);

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
    const emRecanto = categoriasEm(idRecanto);

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

  /**
   * **O `C5` do item 46 · 47, e o que ele prova não é o que o critério parece pedir.**
   *
   * *"Ninguém edita organização em que não tem vínculo de Gestor"* é garantido **por construção**: o
   * caminho não tem `{id}`, o repositório escopado não recebe o identificador, e o `update` sai com
   * `where id = $1`. **Não existe valor a passar**, então não há chamada errada a escrever.
   *
   * O que a estrutura não prova sozinha é o efeito: que escrever em A não toca B. É isto.
   *
   * **E a segunda metade do critério — *"a recusa não confirma se ela existe"* — fecha sem código:** não
   * há recusa por organização inexistente, porque não há como nomear uma. Quem não tem
   * `organizacao.configurar` recebe `403` sobre a **própria** organização.
   */
  it("corrigir o nome em Aurora não muda o nome de Recanto", async () => {
    const emAurora = repositorioEscopadoDaOrganizacao(escoparConsulta(consulta, idAurora));
    const emRecanto = repositorioEscopadoDaOrganizacao(escoparConsulta(consulta, idRecanto));

    const antesEmRecanto = await consulta<{ nome: string }>(
      `select nome from organizacoes where id = $1`,
      [idRecanto],
    );

    const corrigida = await emAurora.corrigir({
      nome: "Residencial Aurora — corrigido",
      atualizadaPorPessoaId: idSindica,
    });

    expect(corrigida.nome).toBe("Residencial Aurora — corrigido");
    expect(corrigida.id).toBe(idAurora);

    const depoisEmRecanto = await consulta<{ nome: string }>(
      `select nome from organizacoes where id = $1`,
      [idRecanto],
    );
    expect(depoisEmRecanto[0]?.nome).toBe(antesEmRecanto[0]?.nome);

    // O rastro é da organização certa, e é a última escrita — não uma segunda trilha.
    const rastro = await consulta<{ atualizado_por_pessoa_id: string | null }>(
      `select atualizado_por_pessoa_id from organizacoes where id = $1`,
      [idAurora],
    );
    expect(rastro[0]?.atualizado_por_pessoa_id).toBe(idSindica);

    const semRastro = await consulta<{ atualizado_por_pessoa_id: string | null }>(
      `select atualizado_por_pessoa_id from organizacoes where id = $1`,
      [idRecanto],
    );
    expect(semRastro[0]?.atualizado_por_pessoa_id).toBeNull();

    // Escrever em Recanto por engano seria impossível sem um repositório escopado nele — e este, sim,
    // escreve só em Recanto. Prova o outro lado da mesma moeda.
    const outra = await emRecanto.corrigir({
      nome: "Condomínio Recanto Azul — corrigido",
      atualizadaPorPessoaId: idSindica,
    });
    expect(outra.id).toBe(idRecanto);
    expect(outra.nome).toBe("Condomínio Recanto Azul — corrigido");
  });

  /**
   * **O par da reclassificação — item 50, spec §4.2 (P2).**
   *
   * A pergunta *"quem tornou esta Área comum, e quando?"* sai da coluna de última escrita, que troca de
   * dono em qualquer campo, e ganha colunas próprias. Elas só andam quando o **valor** de `tipo` muda.
   *
   * **`idMoradora` reclassifica, e a permissão não importa aqui:** ela é da rota. A moradora é a outra
   * Pessoa com vínculo em Recanto, e é isso que distingue *quem reclassificou* de *quem escreveu por
   * último*.
   */
  it("o par de reclassificação só anda quando o tipo muda de valor", async () => {
    const areas = areasEm(idRecanto);
    const criada = await areas.criar({
      nome: "Bicicletário do Recanto",
      tipo: "privativa",
      ordem: 50,
      criadaPorPessoaId: idSindica,
    });
    if (criada.desfecho !== "criada") throw new Error("a criação do Bicicletário falhou");
    const areaId = criada.area.id;

    const par = async () => {
      const [linha] = await consulta<{
        tipo_alterado_em: Date | null;
        tipo_alterado_por_pessoa_id: string | null;
        atualizado_por_pessoa_id: string | null;
      }>(
        `select tipo_alterado_em, tipo_alterado_por_pessoa_id, atualizado_por_pessoa_id
           from areas where id = $1`,
        [areaId],
      );
      return linha;
    };
    const SEM_PAR = { tipo_alterado_em: null, tipo_alterado_por_pessoa_id: null };

    expect(await par()).toMatchObject(SEM_PAR);

    // Renomear não é reclassificar.
    await areas.corrigir({ areaId, nome: "Bicicletário coberto", atualizadaPorPessoaId: idSindica });
    expect(await par()).toMatchObject(SEM_PAR);

    // O mesmo tipo de novo também não.
    await areas.corrigir({ areaId, tipo: "privativa", atualizadaPorPessoaId: idSindica });
    expect(await par()).toMatchObject(SEM_PAR);

    // Tipo diferente carimba, com quem reclassificou.
    await areas.corrigir({ areaId, tipo: "comum", atualizadaPorPessoaId: idMoradora });
    const reclassificada = await par();
    expect(reclassificada?.tipo_alterado_por_pessoa_id).toBe(idMoradora);
    expect(reclassificada?.tipo_alterado_em).toBeInstanceOf(Date);

    // Renomear depois troca a última escrita e NÃO troca a resposta da pergunta de privacidade.
    await areas.corrigir({ areaId, nome: "Bicicletário do Recanto", atualizadaPorPessoaId: idSindica });
    const renomeada = await par();
    expect(renomeada?.atualizado_por_pessoa_id).toBe(idSindica);
    expect(renomeada?.tipo_alterado_por_pessoa_id).toBe(idMoradora);
    expect(renomeada?.tipo_alterado_em).toStrictEqual(reclassificada?.tipo_alterado_em);
  });

  /**
   * **A contagem do tipo anterior — item 44k, Tarefa 8.**
   *
   * `ocorrenciasComTipoAnterior` era a constante `0`, com um docblock que dizia que a tabela
   * `ocorrencias` não existia; ela existe desde a migração `005`. Com a constante, o aviso de atenção de
   * T-14 nunca saía.
   *
   * **Consulta nova, uma entrada na suíte** (arquitetura §7.1). O que ela prova: que a contagem conta as
   * da organização, que ela só existe quando o tipo veio no comando, e que a ocorrência da Aurora — na
   * área homônima de lá — não entra na contagem de Recanto.
   */
  it("a contagem do tipo anterior conta só a organização, e só quando o tipo muda", async () => {
    const semear = async (organizacaoId: string, nomeDaArea: string, autor: string, quantas: number) => {
      const [categoria] = await consulta<{ id: string }>(
        `select id from categorias where organizacao_id = $1 limit 1`,
        [organizacaoId],
      );
      const [area] = await consulta<{ id: string }>(
        `insert into areas (organizacao_id, nome, tipo, ordem) values ($1, $2, 'comum', 90)
         returning id`,
        [organizacaoId, `${nomeDaArea} ${SUFIXO}`],
      );
      for (let indice = 0; indice < quantas; indice += 1) {
        await consulta(
          `insert into ocorrencias
             (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id)
           values ($1, $2, $3, 'comum', $4, $5, $6)`,
          [
            organizacaoId,
            categoria!.id,
            area!.id,
            `Sob o tipo antigo ${String(indice)} ${SUFIXO}`,
            "Semeada para a contagem do tipo anterior.",
            autor,
          ],
        );
      }
      return area!.id;
    };

    const idEmRecanto = await semear(idRecanto, "Depósito com ocorrências", idMoradora, 2);
    await semear(idAurora, "Depósito com ocorrências", idSindica, 1);

    const areas = areasEm(idRecanto);

    // Duas em Recanto sob `comum`; a da Aurora, na área homônima de lá, não entra.
    const reclassificada = await areas.corrigir({
      areaId: idEmRecanto,
      tipo: "privativa",
      atualizadaPorPessoaId: idSindica,
    });
    if (reclassificada.desfecho !== "corrigida") throw new Error("a reclassificação falhou");
    expect(reclassificada.area.ocorrenciasComTipoAnterior).toBe(2);

    // Sem `tipo` no comando, a contagem é zero e não vai ao banco: o campo é da mudança de tipo.
    const renomeada = await areas.corrigir({
      areaId: idEmRecanto,
      nome: `Depósito renomeado ${SUFIXO}`,
      atualizadaPorPessoaId: idSindica,
    });
    if (renomeada.desfecho !== "corrigida") throw new Error("a renomeação falhou");
    expect(renomeada.area.ocorrenciasComTipoAnterior).toBe(0);

    // Uma área sem ocorrência nenhuma conta zero, e o tipo de volta ao original também: a pergunta é
    // *quantas mantêm um tipo diferente do que a área tem agora*.
    const vazia = await areas.criar({
      nome: `Terraço sem ocorrência ${SUFIXO}`,
      tipo: "comum",
      ordem: "no-fim",
      criadaPorPessoaId: idSindica,
    });
    if (vazia.desfecho !== "criada") throw new Error("a criação do Terraço falhou");
    const semNada = await areas.corrigir({
      areaId: vazia.area.id,
      tipo: "privativa",
      atualizadaPorPessoaId: idSindica,
    });
    if (semNada.desfecho !== "corrigida") throw new Error("a correção do Terraço falhou");
    expect(semNada.area.ocorrenciasComTipoAnterior).toBe(0);

    const devolta = await areas.corrigir({
      areaId: idEmRecanto,
      tipo: "comum",
      atualizadaPorPessoaId: idSindica,
    });
    if (devolta.desfecho !== "corrigida") throw new Error("a volta ao tipo original falhou");
    expect(devolta.area.ocorrenciasComTipoAnterior).toBe(0);
  });

  /**
   * ==========================================================================
   *  As reordenações — item 50
   * ==========================================================================
   *
   * **Critério 7, o isolamento.** O Gestor de Recanto manda ids de Aurora, pelas duas portas de entrada:
   * pelo caso de uso, que recusa antes de gravar, e direto pela porta, onde quem recusa é o predicado da
   * transação. Nas duas, **nenhuma das duas listas muda**. Três formas do pedido: só os de B, os de A mais
   * um de B, e os de A com um trocado por um de B (mesmo tamanho, que é o que só o conjunto pega).
   */
  async function provarQueNaoAtravessa(
    tabela: "categorias" | "areas",
    caso: {
      peloCasoDeUso: (ids: readonly string[]) => Promise<unknown>;
      pelaPorta: (reordenacao: Reordenacao) => Promise<{ desfecho: string }>;
      deA: readonly string[];
      deB: readonly string[];
    },
  ): Promise<void> {
    const intrusa = caso.deB[0];
    if (intrusa === undefined) throw new Error(`Aurora precisa de ao menos um item em ${tabela}`);

    const antesEmA = await retratoDe(tabela, idRecanto);
    const antesEmB = await retratoDe(tabela, idAurora);

    const pedidos: (readonly string[])[] = [
      [...caso.deB].reverse(),
      [...caso.deA, intrusa],
      [...caso.deA.slice(1), intrusa],
    ];

    for (const ids of pedidos) {
      await expect(caso.peloCasoDeUso(ids)).rejects.toBeInstanceOf(ListaDesatualizada);

      const pelaPorta = await caso.pelaPorta({
        posicoes: ids.map((id, indice) => ({ id, ordem: indice + 1 })),
        atualizadaPorPessoaId: idSindica,
      });
      expect(pelaPorta.desfecho).toBe("lista-desatualizada");
    }

    expect(await retratoDe(tabela, idRecanto)).toStrictEqual(antesEmA);
    expect(await retratoDe(tabela, idAurora)).toStrictEqual(antesEmB);
  }

  it("reordenar categorias com ids de outra organização é recusado, e nenhuma lista muda", async () => {
    const emRecanto = categoriasEm(idRecanto);
    const deA = (await emRecanto.listar({ apenasAtivas: false })).map((c) => c.id);
    const deB = (await categoriasEm(idAurora).listar({ apenasAtivas: false })).map((c) => c.id);

    await provarQueNaoAtravessa("categorias", {
      peloCasoDeUso: (ids) => reordenarCategorias(emRecanto, { ids, porPessoaId: idSindica }),
      pelaPorta: (reordenacao) => emRecanto.reordenar(reordenacao),
      deA,
      deB,
    });
  });

  it("reordenar áreas com ids de outra organização é recusado, e nenhuma lista muda", async () => {
    const emRecanto = areasEm(idRecanto);
    const deA = (await emRecanto.listar({ apenasAtivas: false })).map((a) => a.id);
    const deB = (await areasEm(idAurora).listar({ apenasAtivas: false })).map((a) => a.id);

    await provarQueNaoAtravessa("areas", {
      peloCasoDeUso: (ids) => reordenarAreas(emRecanto, { ids, porPessoaId: idSindica }),
      pelaPorta: (reordenacao) => emRecanto.reordenar(reordenacao),
      deA,
      deB,
    });
  });

  /** **Critérios 1 e 4.** A lista inteira, inativas incluídas, sai 1 a n e volta na resposta. */
  it("reordenar categorias grava 1 a n na ordem pedida, inativas incluídas, e devolve a lista inteira", async () => {
    const categorias = categoriasEm(idRecanto);
    const inativa = await categorias.criar({
      nome: "Quadra coberta",
      icone: "trees",
      ordem: 95,
      criadaPorPessoaId: idSindica,
    });
    if (inativa.desfecho !== "criada") throw new Error("a criação de Quadra coberta falhou");
    await categorias.corrigir({
      categoriaId: inativa.categoria.id,
      ativa: false,
      atualizadaPorPessoaId: idSindica,
    });

    const pedidas = [...(await categorias.listar({ apenasAtivas: false }))].reverse().map((c) => c.id);
    const devolvidas = await reordenarCategorias(categorias, { ids: pedidas, porPessoaId: idSindica });

    expect(devolvidas.map((c) => c.id)).toStrictEqual(pedidas);
    expect(devolvidas.map((c) => c.ordem)).toStrictEqual(pedidas.map((_, indice) => indice + 1));
    expect(devolvidas.find((c) => c.id === inativa.categoria.id)?.ativa).toBe(false);

    const relidas = await categorias.listar({ apenasAtivas: false });
    expect(relidas.map((c) => c.id)).toStrictEqual(pedidas);
  });

  it("reordenar áreas grava 1 a n na ordem pedida, inativas incluídas", async () => {
    const areas = areasEm(idRecanto);
    const piscina = await areas.criar({
      nome: "Piscina do Recanto",
      tipo: "comum",
      ordem: 5,
      criadaPorPessoaId: idSindica,
    });
    const sala = await areas.criar({
      nome: "Sala 12 do Recanto",
      tipo: "privativa",
      ordem: 5,
      criadaPorPessoaId: idSindica,
    });
    if (piscina.desfecho !== "criada" || sala.desfecho !== "criada") {
      throw new Error("a criação das áreas de Recanto falhou");
    }
    await areas.corrigir({ areaId: sala.area.id, ativa: false, atualizadaPorPessoaId: idSindica });

    const pedidas = [...(await areas.listar({ apenasAtivas: false }))].reverse().map((a) => a.id);
    const devolvidas = await reordenarAreas(areas, { ids: pedidas, porPessoaId: idSindica });

    expect(devolvidas.map((a) => a.id)).toStrictEqual(pedidas);
    expect(devolvidas.map((a) => a.ordem)).toStrictEqual(pedidas.map((_, indice) => indice + 1));
    expect(devolvidas.find((a) => a.id === sala.area.id)?.ativa).toBe(false);
  });

  /**
   * **Critério 5, o alcance do carimbo** (spec §4.2): só as linhas cuja `ordem` mudou trocam
   * `atualizado_por_pessoa_id`, e a reordenação idêntica não grava linha nenhuma.
   *
   * A primeira chamada normaliza a lista para 1 a n, para que só a troca das duas primeiras mude posição.
   * **`idMoradora` reordena a segunda vez** porque é a outra Pessoa com vínculo em Recanto; a permissão é
   * da rota, e o que se mede aqui é o carimbo.
   */
  it("a reordenação carimba só as linhas que mudaram de posição, e a idêntica não grava nada", async () => {
    const categorias = categoriasEm(idRecanto);
    const atuais = (await categorias.listar({ apenasAtivas: false })).map((c) => c.id);
    await reordenarCategorias(categorias, { ids: atuais, porPessoaId: idSindica });
    const antes = await retratoDe("categorias", idRecanto);

    const [primeira, segunda, ...resto] = atuais;
    if (primeira === undefined || segunda === undefined) {
      throw new Error("Recanto precisa de duas categorias");
    }
    const trocadas = [segunda, primeira, ...resto];
    await reordenarCategorias(categorias, { ids: trocadas, porPessoaId: idMoradora });
    const depois = await retratoDe("categorias", idRecanto);

    for (const linha of depois) {
      const anterior = antes.find((a) => a.id === linha.id);
      if (linha.id === primeira || linha.id === segunda) {
        expect(linha.atualizado_por_pessoa_id).toBe(idMoradora);
      } else {
        expect(linha).toStrictEqual(anterior);
      }
    }

    // A idêntica, por outra pessoa: nenhuma linha muda, nem o relógio.
    await reordenarCategorias(categorias, { ids: trocadas, porPessoaId: idSindica });
    expect(await retratoDe("categorias", idRecanto)).toStrictEqual(depois);
  });

  /**
   * **Critério 8, a atomicidade** (spec §4.10). A falha vem **de dentro do banco**: um gatilho de
   * instrução, `after update`, com tabela de transição, que recusa quando a instrução alcançou linha de
   * Recanto. Quando ele dispara, o `update` já escreveu todas as linhas, então a recusa desfaz escrita
   * real, e a lista tem de voltar exatamente ao retrato de antes, carimbo e relógio incluídos.
   *
   * **O teste cria e apaga o gatilho e a função** em `finally`. `aplicarEsquema` derruba a tabela e com
   * ela o gatilho, mas não a função (`esquema.ts`). O nome leva o `SUFIXO` da execução, e os arquivos de
   * integração correm em série, então nada vaza para outro caso.
   */
  it("uma falha no meio da escrita deixa a ordem exatamente como estava", async () => {
    const categorias = categoriasEm(idRecanto);
    const antes = await retratoDe("categorias", idRecanto);
    const pedidas = [...(await categorias.listar({ apenasAtivas: false }))].reverse().map((c) => c.id);
    const recusa = `recusa_reordenacao_${SUFIXO}`;

    try {
      await consulta(
        `create function ${recusa}() returns trigger language plpgsql as $corpo$
         begin
           if exists (select 1 from linhas_novas where organizacao_id = '${idRecanto}') then
             raise exception 'falha provocada pelo teste de atomicidade';
           end if;
           return null;
         end
         $corpo$`,
      );
      await consulta(
        `create trigger ${recusa} after update on categorias
           referencing new table as linhas_novas
           for each statement execute function ${recusa}()`,
      );

      await expect(
        reordenarCategorias(categorias, { ids: pedidas, porPessoaId: idMoradora }),
      ).rejects.toThrow(/falha provocada pelo teste de atomicidade/u);
    } finally {
      await consulta(`drop trigger if exists ${recusa} on categorias`);
      await consulta(`drop function if exists ${recusa}()`);
    }

    expect(await retratoDe("categorias", idRecanto)).toStrictEqual(antes);
  });

  /**
   * **P3, o fim da lista** (spec §4.3): quem nasce recebe a maior `ordem` da organização mais um,
   * **contando as inativas**, por isso o maior valor de cada lista é posto numa linha desativada. **É o
   * único caminho desde o item 44k**, que tirou `ordem` do corpo de `POST`: a porta ainda aceita um
   * número, e nenhum comando da Aplicação o manda.
   *
   * A lista vazia (`1`) não tem caso: nenhuma organização a tem, porque a POL-01 semeia as duas listas e
   * não há `DELETE`. Montar uma terceira organização só para isso mudaria o mundo compartilhado.
   */
  it("quem é criado entra depois do maior, inativas incluídas", async () => {
    const categorias = categoriasEm(idRecanto);
    const guardada = await categorias.criar({
      nome: "Bicicletário",
      icone: "package",
      ordem: 500,
      criadaPorPessoaId: idSindica,
    });
    if (guardada.desfecho !== "criada") throw new Error("a criação de Bicicletário falhou");
    await categorias.corrigir({
      categoriaId: guardada.categoria.id,
      ativa: false,
      atualizadaPorPessoaId: idSindica,
    });

    const lavanderia = await criarCategoria(categorias, { nome: "Lavanderia", porPessoaId: idSindica });
    expect(lavanderia.ordem).toBe(501);

    const areas = areasEm(idRecanto);
    const deposito = await areas.criar({
      nome: "Depósito do Recanto",
      tipo: "comum",
      ordem: 400,
      criadaPorPessoaId: idSindica,
    });
    if (deposito.desfecho !== "criada") throw new Error("a criação do Depósito falhou");
    await areas.corrigir({ areaId: deposito.area.id, ativa: false, atualizadaPorPessoaId: idSindica });

    const terraco = await criarArea(areas, {
      nome: "Terraço do Recanto",
      tipo: "comum",
      porPessoaId: idSindica,
    });
    expect(terraco.ordem).toBe(401);
  });

  /** **P2, do outro lado:** a reordenação é escrita de última escrita, e não toca o par. */
  it("a reordenação não toca o par de reclassificação", async () => {
    const areas = areasEm(idRecanto);
    const criada = await areas.criar({
      nome: "Brinquedoteca do Recanto",
      tipo: "privativa",
      ordem: "no-fim",
      criadaPorPessoaId: idSindica,
    });
    if (criada.desfecho !== "criada") throw new Error("a criação da Brinquedoteca falhou");
    await areas.corrigir({ areaId: criada.area.id, tipo: "comum", atualizadaPorPessoaId: idMoradora });

    const lerPar = async () =>
      (
        await consulta<{ tipo_alterado_em: Date | null; tipo_alterado_por_pessoa_id: string | null }>(
          `select tipo_alterado_em, tipo_alterado_por_pessoa_id from areas where id = $1`,
          [criada.area.id],
        )
      )[0];
    const antes = await lerPar();

    // A área criada está no fim; invertida, ela vai para o topo, então a linha dela muda de fato.
    const pedidas = [...(await areas.listar({ apenasAtivas: false }))].reverse().map((a) => a.id);
    await reordenarAreas(areas, { ids: pedidas, porPessoaId: idSindica });

    expect(antes?.tipo_alterado_por_pessoa_id).toBe(idMoradora);
    expect(await lerPar()).toStrictEqual(antes);
  });
});

/**
 * **O efeito global de renomear a Pessoa — item 49, spec §3.6.**
 *
 * Este bloco não é sobre isolamento **falhar**; é sobre a decisão de que `pessoas` é tabela única e o
 * nome é atributo atual dela. `idSindica` tem vínculo nas **duas** organizações — é o cenário da
 * Persona 1B —, e é por isso que ele detecta o que precisa ser detectado nos dois sentidos.
 */
describe("renomear a Pessoa vale em todas as organizações — pessoas é global", () => {
  it("o nome novo aparece nas duas organizações, e nenhuma outra Pessoa muda", async () => {
    const pessoas = repositorioDePessoas(consulta);
    const emRecanto = repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, idRecanto),
      escoparTransacao(criarTransacao(), idRecanto),
    );
    const emAurora = repositorioEscopadoDeVinculos(
      escoparConsulta(consulta, idAurora),
      escoparTransacao(criarTransacao(), idAurora),
    );

    // **Lido de `pessoas` e não do repositório escopado**, e a razão é de ordem: um caso anterior deste
    // mesmo arquivo revoga o vínculo da moradora em Recanto, então `ativos()` não a traria e a asserção
    // compararia `undefined` com `undefined`. A afirmação é sobre a tabela global, e é dela que se lê.
    const [antesDaMoradora] = await consulta<{ nome: string }>(
      `select nome from pessoas where id = $1`,
      [idMoradora],
    );

    const corrigida = await pessoas.renomear(idSindica, "Helena Rocha");
    expect(corrigida).toEqual({ pessoaId: idSindica, nome: "Helena Rocha" });

    // **As duas leituras são escopadas, e cada uma só vê a própria organização.** O nome mudou nas duas
    // porque a linha é a mesma — é a decisão, não um vazamento.
    for (const [onde, repo] of [
      ["Recanto", emRecanto],
      ["Aurora", emAurora],
    ] as const) {
      const achada = (await repo.ativos()).find((v) => v.pessoa.pessoaId === idSindica);
      expect(achada?.pessoa.nome, `a síndica em ${onde}`).toBe("Helena Rocha");
    }

    // E o outro lado da mesma afirmação: nenhuma outra Pessoa foi tocada.
    const [depoisDaMoradora] = await consulta<{ nome: string }>(
      `select nome from pessoas where id = $1`,
      [idMoradora],
    );
    expect(depoisDaMoradora?.nome).toBe(antesDaMoradora?.nome);
  });

  it("o carimbo de atualizado_em anda, e quem o escreve é o gatilho do banco", async () => {
    const [antes] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from pessoas where id = $1`,
      [idMoradora],
    );
    await repositorioDePessoas(consulta).renomear(idMoradora, "Marta de Souza");
    const [depois] = await consulta<{ atualizado_em: Date }>(
      `select atualizado_em from pessoas where id = $1`,
      [idMoradora],
    );

    // A migração `012` carimba a coluna por gatilho `before update`, e o `update` daqui já não a
    // menciona. **A asserção é estrita de propósito**: com o gatilho, uma coluna de relógio que não anda
    // deixou de ser um esquecimento possível e passou a ser defeito do banco.
    expect(depois!.atualizado_em.getTime()).toBeGreaterThan(antes!.atualizado_em.getTime());
  });
});
