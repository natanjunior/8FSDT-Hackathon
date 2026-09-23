import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { escoparConsulta } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeDashboard } from "@/infraestrutura/repositorios/dashboard";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  As agregações de `GET /dashboard` contra Postgres
 * ============================================================================
 *
 * **Este é o arquivo de integração do Lote 12**, e ele nasce no item 56. O **58** escreve aqui quando a
 * consulta de resoluções ganhar mediana e p90, e o **59** quando as faixas de idade nascerem — para que
 * ninguém abra um segundo arquivo de dashboard daqui a dois dias.
 *
 * **Por que o item 56 não cabia em duplo em memória.** O que ele muda é um `left join` com filtro de
 * status no `on`, e um duplo devolve o que o teste mandar. As duas metades do critério 56.6 — a categoria
 * com cinco resolvidas aparecendo **com zero**, e a categoria desativada que ainda carrega algo em aberto
 * continuando a aparecer — são resultado do SQL, e só o banco as afirma.
 *
 * **Por que não entrou em `isolamento-de-organizacao.test.ts`.** Aquele arquivo é do critério A4, e o
 * mundo dele é compartilhado por dez entradas: as cinco resolvidas e a categoria desativada mudariam as
 * contagens que as outras afirmam.
 *
 * **Ele não exerce a máquina de estados**, exerce a consulta. As ocorrências nascem com `status` explícito
 * no `insert`, porque o gatilho da migração 005 é o *append-only* de `registros_transicao` e nada exige
 * trilha na inserção. Quem prova transição é `testes/integracao/ocorrencia.test.ts`.
 */

const URL_DO_BANCO = urlDoBancoDeTeste();

/** Sufixo de execução: `auth.users` não é nossa para derrubar, e o e-mail tem índice único. */
const SUFIXO = `${Date.now()}`;

/**
 * O mundo, e ele cabe numa tabela. O que cada linha existe para provar está na coluna da direita.
 *
 * | Categoria | `ativa` | O que carrega | O que a consulta devolve |
 * |---|---|---|---|
 * | `Elevador` | sim | 5 `resolvida` | **0** — critério 56.6, primeira metade |
 * | `Vazamento` | sim | 2 `aberta`, 1 `em_atendimento`, 1 `pausada`, 1 `cancelada` | **4** |
 * | `Jardim` | sim | nada | **0** — o critério 32.3 continua de pé |
 * | `Portaria` | **não** | 1 `pausada` | **1** — critério 56.6, segunda metade |
 * | `Garagem` | **não** | 1 `resolvida` | **ausente** — a única mudança de conjunto do item 56 |
 */
const MUNDO: readonly { nome: string; ativa: boolean; status: readonly string[] }[] = [
  { nome: "Elevador", ativa: true, status: Array.from({ length: 5 }, () => "resolvida") },
  {
    nome: "Vazamento",
    ativa: true,
    status: ["aberta", "aberta", "em_atendimento", "pausada", "cancelada"],
  },
  { nome: "Jardim", ativa: true, status: [] },
  { nome: "Portaria", ativa: false, status: ["pausada"] },
  { nome: "Garagem", ativa: false, status: ["resolvida"] },
];

const ESPERADO = ["Vazamento:4", "Portaria:1", "Elevador:0", "Jardim:0"];

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let idDaOrganizacao: string;
let idDaCategoria: Record<string, string>;

/** O repositório montado como a produção o monta — o `$1` do teste é o `$1` do produto. */
const dashboard = () => repositorioEscopadoDeDashboard(escoparConsulta(consulta, idDaOrganizacao));

const chavesDe = (linhas: readonly { categoria: { nome: string }; quantidade: number }[]) =>
  linhas.map((linha) => `${linha.categoria.nome}:${String(linha.quantidade)}`);

beforeAll(async () => {
  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);
  await semear();
});

afterAll(async () => {
  if (pool !== undefined) {
    await consulta(`delete from auth.users where email like $1`, [`%-${SUFIXO}@exemplo.test`]).catch(
      () => undefined,
    );
    await pool.end();
  }
});

/**
 * Uma organização, uma Pessoa com vínculo, uma área e as cinco categorias da tabela acima.
 *
 * **O vínculo não é decoração:** `ocorrencias_autor_fk` aponta para `vinculos (pessoa_id,
 * organizacao_id)`, e não para `pessoas`.
 */
async function semear(): Promise<void> {
  idDaOrganizacao = (
    await consulta<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      ["Condomínio do Painel", "PAINEL12"],
    )
  )[0]!.id;

  const usuario = (
    await consulta<{ id: string }>(
      `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
      [`gestora-${SUFIXO}@exemplo.test`],
    )
  )[0]!.id;

  const pessoa = (
    await consulta<{ id: string }>(
      `insert into pessoas (usuario_id, nome) values ($1, 'Gestora do Painel') returning id`,
      [usuario],
    )
  )[0]!.id;

  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`, [
    pessoa,
    idDaOrganizacao,
  ]);

  const area = (
    await consulta<{ id: string }>(
      `insert into areas (organizacao_id, nome, tipo, ordem) values ($1, 'Hall', 'comum', 1) returning id`,
      [idDaOrganizacao],
    )
  )[0]!.id;

  idDaCategoria = {};
  for (const [i, categoria] of MUNDO.entries()) {
    const linhas = await consulta<{ id: string }>(
      `insert into categorias (organizacao_id, nome, icone, ativa, ordem)
            values ($1, $2, 'tag', $3, $4) returning id`,
      [idDaOrganizacao, categoria.nome, categoria.ativa, i + 1],
    );
    idDaCategoria[categoria.nome] = linhas[0]!.id;

    for (const [j, status] of categoria.status.entries()) {
      await registrar(categoria.nome, area, pessoa, status, `${categoria.nome} ${String(j + 1)}`);
    }
  }
}

async function registrar(
  categoria: string,
  areaId: string,
  pessoaId: string,
  status: string,
  titulo: string,
): Promise<void> {
  await consulta(
    `insert into ocorrencias
          (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id, status)
          values ($1, $2, $3, 'comum', $4, 'Semente de leitura do painel.', $5, $6)`,
    [idDaOrganizacao, idDaCategoria[categoria], areaId, titulo, pessoaId, status],
  );
}

// ---------------------------------------------------------------------------

describe("abertasPorCategoria conta só o que está em aberto", () => {
  /**
   * **O conjunto inteiro numa expectativa só**, e é de propósito: `Garagem` ausente é afirmado pela mesma
   * linha que afirma os outros quatro, sem um `not.toContain` solto ao lado.
   */
  it("devolve cada categoria com o número da tabela, e a desativada e vazia não aparece", async () => {
    const linhas = await dashboard().abertasPorCategoria();
    expect(new Set(chavesDe(linhas))).toStrictEqual(new Set(ESPERADO));
    expect(linhas).toHaveLength(ESPERADO.length);
  });

  /** O item 56 não mexe na ordenação, e sem esta linha ninguém percebe se ela mudar. */
  it("mantém a ordem por quantidade decrescente, com desempate por nome", async () => {
    const linhas = await dashboard().abertasPorCategoria();
    expect(chavesDe(linhas)).toStrictEqual(ESPERADO);
  });

  /**
   * A mesma relação que o teste de ponta a ponta afirma contra a semente, aqui contra um mundo que o teste
   * conhece inteiro. **Se o filtro escorregar para o `where`**, as categorias a zero somem e a contagem de
   * linhas cai; **se o filtro sumir**, a soma passa a incluir os terminais.
   */
  it("a soma das linhas é a contagem de ocorrências não terminais da organização", async () => {
    const linhas = await dashboard().abertasPorCategoria();
    const total = linhas.reduce((soma, linha) => soma + linha.quantidade, 0);

    const [contagem] = await consulta<{ em_aberto: number; tudo: number }>(
      `select count(*) filter (where status not in ('resolvida', 'cancelada'))::int as em_aberto,
              count(*)::int as tudo
         from ocorrencias where organizacao_id = $1`,
      [idDaOrganizacao],
    );

    expect(total).toBe(contagem!.em_aberto);
    expect(total).toBeLessThan(contagem!.tudo);
  });

  /** A asserção que pega o filtro sumindo, e ela é mais barata que ler o SQL. */
  it("uma resolvida a mais numa categoria não muda o número dela", async () => {
    const antes = await dashboard().abertasPorCategoria();
    expect(chavesDe(antes)).toContain("Vazamento:4");

    await registrar("Vazamento", await idDeUmaArea(), await idDeUmVinculo(), "resolvida", "Extra");

    const depois = await dashboard().abertasPorCategoria();
    expect(chavesDe(depois)).toContain("Vazamento:4");
  });
});

async function idDeUmaArea(): Promise<string> {
  const linhas = await consulta<{ id: string }>(
    `select id from areas where organizacao_id = $1 limit 1`,
    [idDaOrganizacao],
  );
  return linhas[0]!.id;
}

async function idDeUmVinculo(): Promise<string> {
  const linhas = await consulta<{ pessoa_id: string }>(
    `select pessoa_id from vinculos where organizacao_id = $1 limit 1`,
    [idDaOrganizacao],
  );
  return linhas[0]!.pessoa_id;
}

// ---------------------------------------------------------------------------

/**
 * A amostra do critério 58.6, em minutos, e os dois números esperados escritos ao lado dela.
 *
 * **`percentile_cont` é o percentil CONTÍNUO**: ele ordena os valores, calcula o índice
 * `fração × (n − 1)` e **interpola linearmente** entre os dois vizinhos desse índice. O irmão
 * `percentile_disc` devolveria sempre um valor observado, e daria outro número sobre estes mesmos dados —
 * que é o motivo de o critério 58.2 mandar declarar o método.
 *
 * **O p90 desta amostra não é o máximo, e nem é o 55**: é um valor que ninguém observou, entre os dois
 * maiores. É o que torna a regra do critério 58.4 necessária.
 */
const AMOSTRA_EM_MINUTOS = [4, 6, 7, 9, 12, 18, 55, 180];
const MEDIANA_ESPERADA_EM_MINUTOS = 10.5; // índice 0,5 × 7 = 3,5 → 9 + 0,5 × (12 − 9)
const P90_ESPERADO_EM_MINUTOS = 92.5; //     índice 0,9 × 7 = 6,3 → 55 + 0,3 × (180 − 55)

/** Um mês inteiro dentro da janela do teste, longe das duas bordas e longe da virada do mês. */
const JANELA_DA_AMOSTRA = { de: "2026-04-01", ate: "2026-04-30" };
const MES_DA_AMOSTRA = "2026-04";
const REGISTRADA_EM = "2026-04-10T12:00:00-03:00";

/**
 * Uma ocorrência resolvida, com a duração exata que o caso pede.
 *
 * **Duas linhas de trilha, e as duas são obrigatórias.** A migração 005 tem
 * `registros_transicao_p1_ck` — `(sequencia = 1) = (status_anterior is null)` — e
 * `registros_transicao_origem_ck` — `status_anterior is not null or status_novo = 'aberta'`. Uma
 * `sequencia = 1` com `status_novo = 'resolvida'` é recusada pelas duas. A abertura entra em
 * `registrada_em`, e a resolução `minutos` depois; a consulta filtra `status_novo = 'resolvida'`, então a
 * linha de abertura não entra em número nenhum. É o mesmo formato de
 * `isolamento-de-organizacao.test.ts:288-292`, e é fixture de leitura, não caminho de produção.
 */
async function resolverEm(minutos: number, titulo: string): Promise<void> {
  const [ocorrencia] = await consulta<{ id: string }>(
    `insert into ocorrencias
          (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id,
           status, registrada_em)
          values ($1, $2, $3, 'comum', $4, 'Semente da amostra de oito.', $5, 'resolvida', $6::timestamptz)
       returning id`,
    [
      idDaOrganizacao,
      idDaCategoria["Elevador"],
      await idDeUmaArea(),
      titulo,
      await idDeUmVinculo(),
      REGISTRADA_EM,
    ],
  );

  await consulta(
    `insert into registros_transicao
       (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id, ocorreu_em)
     values ($1, $2, 1, null, 'aberta', $3, $4::timestamptz),
            ($1, $2, 2, 'aberta', 'resolvida', $3, $4::timestamptz + make_interval(mins => $5))`,
    [idDaOrganizacao, ocorrencia!.id, await idDeUmVinculo(), REGISTRADA_EM, minutos],
  );
}

const linhaDoMes = async (mes: string) =>
  (await dashboard().resolucoesPorMes(JANELA_DA_AMOSTRA)).find((linha) => linha.mes === mes);

describe("resolucoesPorMes devolve mediana e p90 por percentile_cont", () => {
  beforeAll(async () => {
    for (const [i, minutos] of AMOSTRA_EM_MINUTOS.entries()) {
      await resolverEm(minutos, `Amostra ${String(i + 1)}`);
    }
  });

  it("os oito valores devolvem a mediana e o p90 da interpolação linear, em horas", async () => {
    const linha = await linhaDoMes(MES_DA_AMOSTRA);

    expect(linha).toBeDefined();
    expect(linha!.medianaDeHoras * 60).toBeCloseTo(MEDIANA_ESPERADA_EM_MINUTOS, 6);
    expect(linha!.p90DeHoras * 60).toBeCloseTo(P90_ESPERADO_EM_MINUTOS, 6);
  });

  it("acima do teto da amostra pequena o array vem VAZIO, e o denominador é oito", async () => {
    const linha = await linhaDoMes(MES_DA_AMOSTRA);

    expect(linha!.resolvidas).toBe(AMOSTRA_EM_MINUTOS.length);
    expect(linha!.amostraEmHoras).toStrictEqual([]);
  });

  it("mês com três resoluções devolve a amostra ORDENADA, e a mediana no valor do meio", async () => {
    // Um mês só dele, para que as oito acima não entrem na conta. A ordem de inserção é decrescente
    // **de propósito**: o que ordena é o `order by` de dentro do `array_agg`, e sem ele esta asserção
    // devolveria a ordem física das linhas.
    //
    // **Os `::status_ocorrencia` são obrigatórios nesta forma, e só nela.** Num `insert … select … union
    // all`, o Postgres resolve o tipo da coluna entre os dois ramos antes de olhar o destino: `null` e
    // `'aberta'` são ambos `unknown`, a resolução cai em `text`, e o `insert` é recusado com *"column
    // status_anterior is of type status_ocorrencia but expression is of type text"*. A forma com `values`
    // do `resolverEm` acima não precisa deles, porque ali o tipo do destino é conhecido de saída.
    const mes = "2026-03";
    const registradaEm = "2026-03-10T12:00:00-03:00";
    for (const [i, minutos] of [90, 30, 60].entries()) {
      await consulta(
        `with nova as (
           insert into ocorrencias
                (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id,
                 status, registrada_em)
                values ($1, $2, $3, 'comum', $4, 'Semente do mes pequeno.', $5, 'resolvida', $6::timestamptz)
             returning id
         )
         insert into registros_transicao
           (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id, ocorreu_em)
         select $1, nova.id, 1, null::status_ocorrencia, 'aberta'::status_ocorrencia, $5,
                $6::timestamptz from nova
          union all
         select $1, nova.id, 2, 'aberta'::status_ocorrencia, 'resolvida'::status_ocorrencia, $5,
                $6::timestamptz + make_interval(mins => $7) from nova`,
        [
          idDaOrganizacao,
          idDaCategoria["Elevador"],
          await idDeUmaArea(),
          `Mes pequeno ${String(i + 1)}`,
          await idDeUmVinculo(),
          registradaEm,
          minutos,
        ],
      );
    }

    const linhas = await dashboard().resolucoesPorMes({ de: "2026-03-01", ate: "2026-03-31" });
    const linha = linhas.find((l) => l.mes === mes);

    expect(linha!.resolvidas).toBe(3);
    expect(linha!.amostraEmHoras.map((horas) => Math.round(horas * 60))).toStrictEqual([30, 60, 90]);
    expect(linha!.medianaDeHoras * 60).toBeCloseTo(60, 6);
  });
});
