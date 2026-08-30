import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import {
  alterarPrioridade,
  analisarOcorrencia,
  avaliarOcorrencia,
  cancelarOcorrencia,
  iniciarAtendimento,
  pausarOcorrencia,
  registrarOcorrencia,
  registrarSolucaoAplicada,
  resolverOcorrencia,
  retomarOcorrencia,
  verOcorrencia,
} from "@/aplicacao/ocorrencia";
import { Ocorrencia } from "@/dominio/ocorrencia";
import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioEscopadoDeAreas,
  repositorioEscopadoDeCategorias,
} from "@/infraestrutura/repositorios/organizacao";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O grupo 2 da ADR-0008 — o que só o Postgres prova
 * ============================================================================
 *
 * A ADR diz que este grupo *"cresce com migração nova e com porta nova"*, e esta fatia traz as duas.
 * Quatro coisas aqui **não têm duplo**:
 *
 * 1. **O `COMMIT` de duas escritas.** Ocorrência e primeiro registro juntos, ou nenhum dos dois.
 * 2. **A premissa P1 no banco.** O `CHECK ((sequencia = 1) = (status_anterior is null))` vale nos DOIS
 *    sentidos, e um duplo não o exerce.
 * 3. **O gatilho *append-only*.** `update` e `delete` na trilha são recusados pelo banco.
 * 4. **A FK composta do autor**, que aponta para `vinculos` e não para `pessoas`.
 */

const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `${Date.now()}`;

let pool: Pool;
let consultaCrua: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;
let organizacaoId: string;
let pessoaId: string;
let categoriaId: string;
let areaId: string;

/** **Nunca chamada aqui**: nenhum caso deste arquivo registra com anexo, e a porta só é tocada dentro
 *  do laço de `entrada.anexos`. Estourar é o ponto — ver o comentário do passo. */
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

function portas() {
  const consulta = escoparConsulta(criarConsulta(), organizacaoId);
  return {
    ocorrencias: repositorioEscopadoDeOcorrencias(
      consulta,
      escoparTransacao(criarTransacao(), organizacaoId),
    ),
    categorias: repositorioEscopadoDeCategorias(consulta),
    areas: repositorioEscopadoDeAreas(consulta),
    armazenamento: SEM_ANEXO,
  };
}

beforeAll(async () => {
  process.env.BANCO_URL = URL_DO_BANCO;

  pool = new Pool({ connectionString: URL_DO_BANCO, max: 4 });
  consultaCrua = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, [...valores])).rows as L[];

  await aplicarEsquema(consultaCrua);

  const [pessoa] = await consultaCrua<{ id: string }>(
    `insert into pessoas (nome) values ($1) returning id`,
    [`Helena ${SUFIXO}`],
  );
  pessoaId = pessoa!.id;

  // **Sem `criada_por_pessoa_id`**, e é o que a suíte de isolamento já faz: a FK
  // `organizacoes_criada_por_vinculo_fk` é `DEFERRABLE INITIALLY DEFERRED` e só é conferida no `COMMIT`
  // — fora de uma transação explícita, cada `insert` é a própria transação, e o vínculo do criador ainda
  // não existe quando ela fecha. A coluna é anulável exatamente por isto: *"organizações semeadas em
  // ambiente de teste não têm criador"* (migração 001). O que este arquivo mede é o agregado
  // `Ocorrência`, não a POL-01 — essa é a `politica-de-semente.test.ts`.
  const [organizacao] = await consultaCrua<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
    [`Recanto ${SUFIXO}`, `RA${SUFIXO}`.slice(0, 12).toUpperCase()],
  );
  organizacaoId = organizacao!.id;

  await consultaCrua(
    `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
    [pessoaId, organizacaoId],
  );

  const [categoria] = await consultaCrua<{ id: string }>(
    `insert into categorias (organizacao_id, nome, icone, ordem)
          values ($1, 'Problemas de iluminação', 'lightbulb', 0) returning id`,
    [organizacaoId],
  );
  categoriaId = categoria!.id;

  const [area] = await consultaCrua<{ id: string }>(
    `insert into areas (organizacao_id, nome, tipo, ordem)
          values ($1, 'Garagem', 'comum', 0) returning id`,
    [organizacaoId],
  );
  areaId = area!.id;
});

afterAll(async () => {
  await pool?.end();
});

describe("o registro contra Postgres", () => {
  it("grava ocorrência E primeiro registro no mesmo COMMIT", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo: "Lâmpada queimada na garagem",
        descricao: "Queimada faz três dias, corredor escuro.",
        categoriaId,
        areaId,
        localizacaoComplemento: "ao lado da vaga 34",
      },
    );

    const registros = await consultaCrua<{ sequencia: number; status_anterior: string | null }>(
      `select sequencia, status_anterior from registros_transicao where ocorrencia_id = $1`,
      [lida.id],
    );

    expect(lida.status).toBe("aberta");
    expect(lida.prioridade).toBe("normal");
    expect(registros).toHaveLength(1);
    expect(registros[0]?.sequencia).toBe(1);
    expect(registros[0]?.status_anterior).toBeNull();
  });

  it("a trilha da ocorrência recém-criada tem EXATAMENTE um registro, com os cinco campos", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo: "Infiltração na parede",
        descricao: "Mancha crescendo depois da chuva.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    const trilha = await portas().ocorrencias.trilha(lida.id);

    expect(trilha).toHaveLength(1);
    expect(trilha[0]).toMatchObject({
      statusAnterior: null,
      statusNovo: "aberta",
      autor: { pessoaId, nome: `Helena ${SUFIXO}` },
      observacao: null,
    });
    expect(typeof trilha[0]?.ocorreuEm).toBe("string");
  });

  it("area_tipo é gravado como cópia congelada, e reclassificar a Área não o muda", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo: "Portão emperrado",
        descricao: "Não fecha sozinho.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    await consultaCrua(`update areas set tipo = 'privativa' where id = $1`, [areaId]);

    const depois = await portas().ocorrencias.porId(lida.id);
    expect(depois?.area.tipo).toBe("comum");

    await consultaCrua(`update areas set tipo = 'comum' where id = $1`, [areaId]);
  });
});

describe("o que o banco recusa", () => {
  it("um segundo registro com status_anterior nulo viola o CHECK de P1", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo: "Lixeira quebrada",
        descricao: "Tampa solta.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    // **`status_novo = 'aberta'`, e não `'em_analise'`, para o alvo ser um só.** Uma linha com destino
    // `em_analise` e `status_anterior` nulo viola **dois** `CHECK` — o de P1 e o
    // `registros_transicao_origem_ck` (*"a criação nasce aberta"*) —, e o Postgres relata o primeiro que
    // avaliar. Com destino `aberta` o `origem_ck` é satisfeito e sobra exatamente a premissa P1:
    // `sequencia` 2 não pode ter `status_anterior` nulo.
    await expect(
      consultaCrua(
        `insert into registros_transicao
           (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
         values ($1, $2, 2, null, 'aberta', $3)`,
        [organizacaoId, lida.id, pessoaId],
      ),
    ).rejects.toThrow(/registros_transicao_p1_ck/u);
  });

  it("o gatilho append-only recusa update e delete na trilha (ADR-0001)", async () => {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo: "Corrimão solto",
        descricao: "Balança ao apoiar.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    await expect(
      consultaCrua(`update registros_transicao set observacao = 'editado' where ocorrencia_id = $1`, [
        lida.id,
      ]),
    ).rejects.toThrow(/append-only/u);

    await expect(
      consultaCrua(`delete from registros_transicao where ocorrencia_id = $1`, [lida.id]),
    ).rejects.toThrow(/append-only/u);
  });

  it("título só de espaços é recusado pelo CHECK, não só pelo NOT NULL", async () => {
    await expect(
      consultaCrua(
        `insert into ocorrencias
           (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo, autor_pessoa_id)
         values ($1, '   ', 'x', $2, $3, 'comum', $4)`,
        [organizacaoId, categoriaId, areaId, pessoaId],
      ),
    ).rejects.toThrow(/ocorrencias_texto_ck/u);
  });

  /**
   * ==========================================================================
   *  As garantias da migração 008 — o critério 19.5, e os dois `CHECK`
   * ==========================================================================
   *
   * **Nenhuma delas tem duplo.** *"Um responsável vigente por ocorrência"* é garantia de **classe B** do
   * modelo §8 — regra sobre um conjunto de linhas —, e o que a opera é o banco. Provar isso com um duplo
   * seria provar o duplo.
   */
  async function ocorrenciaNua(): Promise<string> {
    const [linha] = await consultaCrua<{ id: string }>(
      `insert into ocorrencias
         (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo, autor_pessoa_id)
       values ($1, 'Portão travado', 'Não abre pelo controle.', $2, $3, 'comum', $4)
       returning id`,
      [organizacaoId, categoriaId, areaId, pessoaId],
    );
    return linha!.id;
  }

  it("duas atribuições vigentes na mesma ocorrência violam atribuicoes_vigente_uk — critério 19.5", async () => {
    const ocorrenciaId = await ocorrenciaNua();

    await consultaCrua(
      `insert into atribuicoes (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id)
       values ($1, $2, $3, $3)`,
      [organizacaoId, ocorrenciaId, pessoaId],
    );

    await expect(
      consultaCrua(
        `insert into atribuicoes (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id)
         values ($1, $2, $3, $3)`,
        [organizacaoId, ocorrenciaId, pessoaId],
      ),
    ).rejects.toMatchObject({ code: "23505", constraint: "atribuicoes_vigente_uk" });
  });

  it("a SEGUNDA passa quando a primeira foi encerrada — o índice é PARCIAL, e é o que faz a reatribuição existir", async () => {
    const ocorrenciaId = await ocorrenciaNua();

    await consultaCrua(
      `insert into atribuicoes
         (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id,
          encerrada_em, motivo_encerramento)
       values ($1, $2, $3, $3, now(), 'reatribuicao')`,
      [organizacaoId, ocorrenciaId, pessoaId],
    );

    await consultaCrua(
      `insert into atribuicoes (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id)
       values ($1, $2, $3, $3)`,
      [organizacaoId, ocorrenciaId, pessoaId],
    );

    const linhas = await consultaCrua<{ total: string }>(
      `select count(*) as total from atribuicoes where ocorrencia_id = $1`,
      [ocorrenciaId],
    );
    expect(linhas[0]!.total).toBe("2");
  });

  it("encerrar sem motivo — e ter motivo sem encerrar — viola o CHECK do par, nos dois sentidos", async () => {
    const ocorrenciaId = await ocorrenciaNua();

    await expect(
      consultaCrua(
        `insert into atribuicoes
           (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id, encerrada_em)
         values ($1, $2, $3, $3, now())`,
        [organizacaoId, ocorrenciaId, pessoaId],
      ),
    ).rejects.toMatchObject({ constraint: "atribuicoes_encerramento_ck" });

    await expect(
      consultaCrua(
        `insert into atribuicoes
           (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id, motivo_encerramento)
         values ($1, $2, $3, $3, 'reatribuicao')`,
        [organizacaoId, ocorrenciaId, pessoaId],
      ),
    ).rejects.toMatchObject({ constraint: "atribuicoes_encerramento_ck" });
  });

  it("encerrar ANTES de atribuir viola a ordem temporal — §8.1, classe A", async () => {
    const ocorrenciaId = await ocorrenciaNua();

    await expect(
      consultaCrua(
        `insert into atribuicoes
           (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id,
            atribuido_em, encerrada_em, motivo_encerramento)
         values ($1, $2, $3, $3, now(), now() - interval '1 hour', 'reatribuicao')`,
        [organizacaoId, ocorrenciaId, pessoaId],
      ),
    ).rejects.toMatchObject({ constraint: "atribuicoes_ordem_temporal_ck" });
  });

  it("atribuir a quem NÃO tem vínculo nesta organização é recusado pela FK composta — a D21 no banco", async () => {
    const ocorrenciaId = await ocorrenciaNua();

    // Pessoa global, sem vínculo nenhum. É o cadastro existir e o vínculo não.
    const [forasteira] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Forasteira ${SUFIXO}`],
    );

    await expect(
      consultaCrua(
        `insert into atribuicoes (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id)
         values ($1, $2, $3, $4)`,
        [organizacaoId, ocorrenciaId, forasteira!.id, pessoaId],
      ),
    ).rejects.toMatchObject({ code: "23503", constraint: "atribuicoes_responsavel_fk" });
  });
});

/**
 * ============================================================================
 *  A paginação por cursor — o critério 14.2, e ele não tem duplo
 * ============================================================================
 *
 * **O que só o banco prova:** que o *keyset* `(registrada_em, id) < (…, …)` devolve exatamente a
 * continuação, e que **uma ocorrência registrada entre a página 1 e a página 2 não empurra ninguém para
 * trás**. Com deslocamento numérico este caso falharia — e é literalmente o cenário do Gestor que tria a
 * lista de cima enquanto alguém registra.
 */
describe("a listagem paginada por cursor", () => {
  /** Três ocorrências, registradas em instantes distintos e conhecidos. */
  async function semearTres(): Promise<string[]> {
    const ids: string[] = [];
    for (const titulo of ["Primeira", "Segunda", "Terceira"]) {
      const lida = await registrarOcorrencia(
        portas(),
        { pessoaId, organizacaoId },
        {
          titulo: `${titulo} ${SUFIXO}`,
          descricao: "Descrição suficiente para o CHECK de texto.",
          categoriaId,
          areaId,
          localizacaoComplemento: null,
        },
      );
      ids.push(lida.id);
    }
    return ids;
  }

  it("devolve em registrada_em DESC, e o cursor continua de onde parou", async () => {
    const ids = await semearTres();

    const primeira = await portas().ocorrencias.listar({ limite: 2, cursor: null });
    expect(primeira).toHaveLength(2);
    // A mais recente primeiro: a terceira semeada.
    expect(primeira[0]!.id).toBe(ids[2]);
    expect(primeira[1]!.id).toBe(ids[1]);

    const ultimo = primeira[1]!;
    const segunda = await portas().ocorrencias.listar({
      limite: 2,
      cursor: { registradaEm: ultimo.registradaEm, id: ultimo.id },
    });

    expect(segunda.map((o) => o.id)).toContain(ids[0]);
    // **Nada se repete entre as duas páginas** — é a metade do 14.2 que o cursor existe para garantir.
    expect(segunda.map((o) => o.id)).not.toContain(ids[1]);
    expect(segunda.map((o) => o.id)).not.toContain(ids[2]);
  });

  it("uma ocorrência registrada ENTRE as páginas não faz nenhum item aparecer duas vezes", async () => {
    const ids = await semearTres();

    const primeira = await portas().ocorrencias.listar({ limite: 2, cursor: null });
    const ultimo = primeira[1]!;

    // A intrusa entra no topo da lista, depois de a página 1 já ter sido lida.
    const intrusa = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo: `Intrusa ${SUFIXO}`,
        descricao: "Registrada entre a página 1 e a 2.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );

    const segunda = await portas().ocorrencias.listar({
      limite: 2,
      cursor: { registradaEm: ultimo.registradaEm, id: ultimo.id },
    });

    const lidos = [...primeira, ...segunda].map((o) => o.id);
    expect(new Set(lidos).size).toBe(lidos.length);
    // A intrusa é mais nova que o cursor: ela **não** entra na página seguinte, e não empurra ninguém.
    expect(segunda.map((o) => o.id)).not.toContain(intrusa.id);
    expect(segunda.map((o) => o.id)).toContain(ids[0]);
  });

  it("o filtro de autor devolve só as de quem pediu — e o resumo não traz descrição", async () => {
    await semearTres();

    const minhas = await portas().ocorrencias.listar({
      autorPessoaId: pessoaId,
      limite: 50,
      cursor: null,
    });
    expect(minhas.length).toBeGreaterThan(0);
    for (const item of minhas) expect(item.autor.pessoaId).toBe(pessoaId);

    const nenhuma = await portas().ocorrencias.listar({
      autorPessoaId: "00000000-0000-4000-8000-000000000000",
      limite: 50,
      cursor: null,
    });
    expect(nenhuma).toStrictEqual([]);

    // O modelo de leitura do resumo **não tem** `descricao` — e é o que faz a lista não pagar por ela.
    expect(minhas[0]).not.toHaveProperty("descricao");
  });
});

describe("o critério 15.1 no banco — OU dentro da dimensão, E entre dimensões", () => {
  /** Duas `aberta`, uma `cancelada` e uma `alta`, com títulos próprios deste bloco. */
  async function semearParaFiltro(): Promise<{ cancelada: string; alta: string }> {
    const ids: string[] = [];
    for (const titulo of ["Filtro A", "Filtro B", "Filtro C"]) {
      const lida = await registrarOcorrencia(
        portas(),
        { pessoaId, organizacaoId },
        {
          titulo: `${titulo} ${SUFIXO}`,
          descricao: "Descrição suficiente para o CHECK de texto.",
          categoriaId,
          areaId,
          localizacaoComplemento: null,
        },
      );
      ids.push(lida.id);
    }

    // **`cancelada` e `alta` não têm comando que as produza** — são os itens 17 e 18. Semente de teste
    // por `update` direto, que é o caminho que este arquivo já usa para o que o produto ainda não faz.
    // O gatilho *append-only* é de `registros_transicao`, não de `ocorrencias`: o `update` passa.
    await consultaCrua(`update ocorrencias set status = 'cancelada' where id = $1`, [ids[2]]);
    await consultaCrua(`update ocorrencias set prioridade = 'alta' where id = $1`, [ids[0]]);
    return { cancelada: ids[2]!, alta: ids[0]! };
  }

  it("dois status devolvem a união dos dois, e nada fora dela", async () => {
    const { cancelada } = await semearParaFiltro();

    const linhas = await portas().ocorrencias.listar({
      limite: 50,
      cursor: null,
      filtro: { status: ["aberta", "cancelada"] },
    });

    expect(linhas.map((o) => o.id)).toContain(cancelada);
    for (const linha of linhas) expect(["aberta", "cancelada"]).toContain(linha.status);
  });

  it("duas dimensões estreitam uma à outra", async () => {
    const { alta } = await semearParaFiltro();

    const linhas = await portas().ocorrencias.listar({
      limite: 50,
      cursor: null,
      filtro: { status: ["aberta"], prioridade: ["alta"] },
    });

    expect(linhas.map((o) => o.id)).toContain(alta);
    for (const linha of linhas) {
      expect(linha.status).toBe("aberta");
      expect(linha.prioridade).toBe("alta");
    }
  });

  it("categoriaId que não existe devolve lista vazia, e não erro", async () => {
    await semearParaFiltro();

    const linhas = await portas().ocorrencias.listar({
      limite: 50,
      cursor: null,
      filtro: { categoriaId: ["00000000-0000-4000-8000-000000000000"] },
    });

    expect(linhas).toStrictEqual([]);
  });

  it("o cursor continua valendo COM o filtro — a segunda página não repete nem perde", async () => {
    await semearParaFiltro();
    const recorte = { status: ["aberta"] } as const;

    const primeira = await portas().ocorrencias.listar({
      limite: 2,
      cursor: null,
      filtro: recorte,
    });
    expect(primeira).toHaveLength(2);

    const ultimo = primeira[1]!;
    const segunda = await portas().ocorrencias.listar({
      limite: 2,
      cursor: { registradaEm: ultimo.registradaEm, id: ultimo.id },
      filtro: recorte,
    });

    for (const linha of segunda) expect(linha.status).toBe("aberta");
    // **Nada se repete entre as duas páginas**, com filtro como sem.
    const lidos = [...primeira, ...segunda].map((o) => o.id);
    expect(new Set(lidos).size).toBe(lidos.length);
  });
});

/**
 * ============================================================================
 *  A transição contra Postgres — o item 16
 * ============================================================================
 *
 * **Três coisas aqui não têm duplo:** o `COMMIT` das duas escritas, o `update … where status` como
 * controle otimista, e o escopo de `$1` valendo na **escrita** — onde errar não devolve dado de outra
 * organização: **grava** numa.
 */
describe("a transição contra Postgres", () => {
  /** Registra uma ocorrência nova e devolve o id — cada caso quer a sua, e o arquivo semeia por cima. */
  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      {
        titulo,
        descricao: "Semeada para o teste de transição.",
        categoriaId,
        areaId,
        localizacaoComplemento: null,
      },
    );
    return lida.id;
  }

  /** O agregado carregado, já analisado — o que a porta de escrita recebe. */
  async function analisado(id: string): Promise<Ocorrencia> {
    const carregada = await portas().ocorrencias.carregar(id);
    expect(carregada).not.toBeNull();
    return carregada!.ocorrencia.analisar({
      autorPessoaId: pessoaId,
      ocorreuEm: new Date().toISOString(),
    });
  }

  it("carregar reidrata o agregado com a trilha inteira", async () => {
    const id = await registrada("Reidratação");
    const carregada = await portas().ocorrencias.carregar(id);

    expect(carregada?.ocorrencia.status).toBe("aberta");
    expect(carregada?.ocorrencia.prioridade).toBe("normal");
    expect(carregada?.ocorrencia.autorPessoaId).toBe(pessoaId);
    expect(carregada?.ocorrencia.areaTipo).toBe("comum");
    expect(carregada?.ocorrencia.trilha).toHaveLength(1);
    expect(carregada?.ocorrencia.ultimaTransicao.sequencia).toBe(1);
    expect(carregada?.ocorrencia.ultimaTransicao.statusAnterior).toBeNull();
  });

  it("carregar apura temResponsavel no MESMO select — sem atribuição é false, com atribuição vigente é true", async () => {
    const id = await registrada("O exists da invariante 9");

    expect((await portas().ocorrencias.carregar(id))?.temResponsavel).toBe(false);

    await consultaCrua(
      `insert into atribuicoes (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id)
       values ($1, $2, $3, $3)`,
      [organizacaoId, id, pessoaId],
    );

    expect((await portas().ocorrencias.carregar(id))?.temResponsavel).toBe(true);

    // **Encerrada não conta**, e é o `where encerrada_em is null` do `exists`: o índice único parcial
    // permite a segunda linha justamente porque a primeira saiu de cena.
    await consultaCrua(
      `update atribuicoes set encerrada_em = now(), motivo_encerramento = 'reatribuicao'
        where ocorrencia_id = $1`,
      [id],
    );

    expect((await portas().ocorrencias.carregar(id))?.temResponsavel).toBe(false);
  });

  it("carregar devolve null para id que não existe nesta organização", async () => {
    expect(await portas().ocorrencias.carregar("2f9b0f6c-0000-4a00-8000-000000000000")).toBeNull();
  });

  it("aplicarTransicao grava o update E o registro no mesmo COMMIT — critérios 16.1 e 16.2", async () => {
    const id = await registrada("Mesmo COMMIT");
    const resultado = await portas().ocorrencias.aplicarTransicao(id, await analisado(id));

    expect(resultado.desfecho).toBe("aplicada");

    const [linha] = await consultaCrua<{ status: string; atualizada_em: Date }>(
      `select status, atualizada_em from ocorrencias where id = $1`,
      [id],
    );
    const registros = await consultaCrua<{
      sequencia: number;
      status_anterior: string | null;
      status_novo: string;
      ocorreu_em: Date;
      observacao: string | null;
    }>(
      `select sequencia, status_anterior, status_novo, ocorreu_em, observacao
          from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );

    expect(linha?.status).toBe("em_analise");
    // **Exatamente dois** — a origem e a transição. Nem um a mais.
    expect(registros).toHaveLength(2);
    expect(registros[1]).toMatchObject({
      sequencia: 2,
      status_anterior: "aberta",
      status_novo: "em_analise",
      observacao: null,
    });
    // `atualizada_em` é o INSTANTE DA TRANSIÇÃO, nunca `now()` — dois relógios produziriam uma
    // ocorrência atualizada milissegundos antes ou depois do registro que a atualizou.
    expect(linha?.atualizada_em.toISOString()).toBe(registros[1]?.ocorreu_em.toISOString());
  });

  it("a corrida: a SEGUNDA aplicação devolve conflito e NÃO escreve nada", async () => {
    const id = await registrada("Corrida");
    // Os dois Gestores leem `aberta` e montam a transição a partir dali. É a corrida da §3.3 da spec.
    const primeiro = await analisado(id);
    const segundo = await analisado(id);

    expect((await portas().ocorrencias.aplicarTransicao(id, primeiro)).desfecho).toBe("aplicada");
    expect((await portas().ocorrencias.aplicarTransicao(id, segundo)).desfecho).toBe("conflito");

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    // **Continua com dois.** O `where status = 'aberta'` não achou linha, e o `insert` não rodou.
    expect(registros).toHaveLength(2);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não transiciona — critério A4", async () => {
    const id = await registrada("Isolamento de escrita");
    const agregado = await analisado(id);

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA (`consultar`
    // devolve lista), então o caso é nomeado aqui.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho ${SUFIXO}`, `VZ${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    expect((await deOutra.aplicarTransicao(id, agregado)).desfecho).toBe("conflito");

    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    // **Não escreveu.** O `organizacao_id = $1` do `update` é o que impede, e ele vem do escopo.
    expect(linha?.status).toBe("aberta");
  });

  it("pelo comando: analisar duas vezes dá 409 na segunda, e a trilha continua com dois", async () => {
    const id = await registrada("Analisar duas vezes");
    const ctx = { pessoaId, permissoes: ["ocorrencia.ler_todas", "ocorrencia.analisar"] };

    const lida = await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    expect(lida.status).toBe("em_analise");
    expect(lida.ultimaTransicao.statusAnterior).toBe("aberta");

    const erro = await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id }).catch(
      (causa: unknown) => causa,
    );
    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "em_analise",
    );

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(2);
  });
});

/**
 * ============================================================================
 *  A atribuição contra Postgres — o item 19
 * ============================================================================
 *
 * **Cinco coisas aqui não têm duplo**, e é por isso que este bloco existe:
 *
 * 1. **O `COMMIT` de três escritas.** `update` da vigente, `insert` da nova e `atualizada_em`, ou nenhum.
 * 2. **O `rollback` do `422`.** É o único caso que prova que o sentinela existe — sem ele, a atribuição
 *    anterior sairia encerrada e a ocorrência ficaria **sem responsável nenhum**.
 * 3. **O `where exists` contra `vinculos`**, que é o que traduz *"vínculo **ativo**"* — a FK não olha
 *    `revogado_em`.
 * 4. **A trilha NÃO cresce**, que é a metade conferível do critério 19.4.
 * 5. **O isolamento de escrita:** outra organização não encontra e não escreve.
 */
describe("a atribuição contra Postgres — item 19", () => {
  const EM = "2026-08-28T14:05:00.000Z";

  /** Um segundo Gestor nesta organização, para a reatribuição ter para quem ir. */
  let segundoPessoaId: string;
  /** Um vínculo que será revogado no meio do caminho. */
  let revogadoPessoaId: string;

  beforeAll(async () => {
    const [segunda] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Zelador ${SUFIXO}`],
    );
    segundoPessoaId = segunda!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [segundoPessoaId, organizacaoId],
    );

    const [revogada] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Ex-zelador ${SUFIXO}`],
    );
    revogadoPessoaId = revogada!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel, revogado_em)
       values ($1, $2, 'encarregado', now())`,
      [revogadoPessoaId, organizacaoId],
    );
  });

  /**
   * Registra uma ocorrência pelo caminho de verdade — com trilha, como o produto a cria.
   *
   * **Os três argumentos são os de `registrarOcorrencia`**: as portas, o contexto
   * (`{ pessoaId, organizacaoId }`) e a entrada. É a mesma chamada que os outros `describe` deste arquivo
   * já fazem.
   */
  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa de alguém.", categoriaId, areaId },
    );
    return lida.id;
  }

  it("atribui: UMA linha em atribuicoes, responsavel preenchido, e reatribuicao false — critério 19.1", async () => {
    const id = await registrada("Lâmpada da escada");
    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    expect(resultado.desfecho).toBe("atribuida");
    if (resultado.desfecho !== "atribuida") return;

    expect(resultado.reatribuicao).toBe(false);
    expect(resultado.ocorrencia.responsavel).toStrictEqual({
      pessoaId: segundoPessoaId,
      nome: `Zelador ${SUFIXO}`,
    });

    const linhas = await consultaCrua<{ total: string }>(
      `select count(*) as total from atribuicoes where ocorrencia_id = $1 and encerrada_em is null`,
      [id],
    );
    expect(linhas[0]!.total).toBe("1");
  });

  it("NÃO transiciona e NÃO grava registro — a trilha continua com exatamente um — critérios 19.1 e 19.4", async () => {
    const id = await registrada("Portão do estacionamento");
    const antes = await portas().ocorrencias.trilha(id);

    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    const depois = await portas().ocorrencias.trilha(id);
    expect(depois).toStrictEqual(antes);
    expect(depois).toHaveLength(1);

    if (resultado.desfecho !== "atribuida") throw new Error("esperava atribuida");
    expect(resultado.ocorrencia.status).toBe("aberta");
    expect(resultado.ocorrencia.ultimaTransicao.statusNovo).toBe("aberta");
    // **`atualizada_em` avança para o INSTANTE da atribuição**, e não para `now()`.
    expect(resultado.ocorrencia.atualizadaEm).toBe(EM);
  });

  it("atribuir DUAS vezes encerra a primeira com motivo reatribuicao, e sobra uma vigente — 19.5 e 21.2", async () => {
    const id = await registrada("Infiltração na garagem");
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    const segunda = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: pessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: "2026-08-28T15:00:00.000Z",
    });

    expect(segunda.desfecho).toBe("atribuida");
    if (segunda.desfecho !== "atribuida") return;
    expect(segunda.reatribuicao).toBe(true);
    expect(segunda.ocorrencia.responsavel?.pessoaId).toBe(pessoaId);

    const linhas = await consultaCrua<{
      responsavel_pessoa_id: string;
      encerrada_em: Date | null;
      motivo_encerramento: string | null;
    }>(
      `select responsavel_pessoa_id, encerrada_em, motivo_encerramento
         from atribuicoes where ocorrencia_id = $1 order by atribuido_em`,
      [id],
    );

    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.responsavel_pessoa_id).toBe(segundoPessoaId);
    expect(linhas[0]!.encerrada_em).not.toBeNull();
    expect(linhas[0]!.motivo_encerramento).toBe("reatribuicao");
    // **Nunca apagada** — critério 21.2.
    expect(linhas[1]!.encerrada_em).toBeNull();
  });

  it("atribuicoes() devolve UMA linha por atribuição, em ordem, com o encerramento da primeira — critério 29.3", async () => {
    const repo = portas().ocorrencias;
    const id = await registrada("Reatribuição para a linha do tempo");

    await repo.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: "2026-08-20T13:00:00.000Z",
    });
    await repo.atribuirResponsavel(id, {
      responsavelPessoaId: pessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: "2026-08-21T09:30:00.000Z",
    });

    const lidas = await repo.atribuicoes(id);

    // **n atribuições, n linhas** — o `select` não filtra `encerrada_em`, e é o que faz a reatribuição
    // "aparecer duas vezes" na linha do tempo.
    expect(lidas).toHaveLength(2);
    // **Ordem crescente por `atribuido_em`** — é o `order by` que casa com o índice do item 19.
    expect(lidas.map((a) => a.atribuidoEm)).toStrictEqual([
      "2026-08-20T13:00:00.000Z",
      "2026-08-21T09:30:00.000Z",
    ]);

    // A primeira ficou encerrada, com motivo, no MESMO instante em que a segunda começou.
    expect(lidas[0]?.encerradaEm).toBe("2026-08-21T09:30:00.000Z");
    expect(lidas[0]?.motivoEncerramento).toBe("reatribuicao");
    expect(lidas[0]?.responsavel).toStrictEqual({
      pessoaId: segundoPessoaId,
      nome: `Zelador ${SUFIXO}`,
    });

    // A vigente não tem encerramento — e é o par do CHECK: sem `encerrada_em`, sem motivo.
    expect(lidas[1]?.encerradaEm).toBeNull();
    expect(lidas[1]?.motivoEncerramento).toBeNull();
    expect(lidas[1]?.responsavel.pessoaId).toBe(pessoaId);

    // **O autor é quem ATRIBUIU**, nunca o responsável — é a colisão nº 2 do glossário, e é o campo
    // `autor` que o `EventoAtribuicao` do contrato exige. Na primeira linha os dois são pessoas
    // DIFERENTES, que é o único jeito de o caso provar que não foram trocados.
    expect(lidas[0]?.autor.pessoaId).toBe(pessoaId);
    expect(lidas[0]?.autor.pessoaId).not.toBe(lidas[0]?.responsavel.pessoaId);
  });

  it("vínculo REVOGADO devolve o desfecho de 422 — a FK sozinha o aceitaria", async () => {
    const id = await registrada("Corrimão solto");
    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: revogadoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    expect(resultado).toStrictEqual({ desfecho: "responsavel-sem-vinculo-ativo" });
  });

  it("O ROLLBACK: reatribuir para vínculo revogado deixa a atribuição vigente INTACTA", async () => {
    // **É o único caso que prova que o sentinela existe.** Sem ele, o `update` de encerramento comitaria
    // e a ocorrência ficaria sem responsável nenhum, com um `422` na tela dizendo que nada mudou.
    const id = await registrada("Bomba do reservatório");
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: revogadoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: "2026-08-28T15:30:00.000Z",
    });
    expect(resultado).toStrictEqual({ desfecho: "responsavel-sem-vinculo-ativo" });

    const linhas = await consultaCrua<{ responsavel_pessoa_id: string }>(
      `select responsavel_pessoa_id from atribuicoes
        where ocorrencia_id = $1 and encerrada_em is null`,
      [id],
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.responsavel_pessoa_id).toBe(segundoPessoaId);

    const lida = await portas().ocorrencias.porId(id);
    expect(lida?.responsavel?.pessoaId).toBe(segundoPessoaId);
  });

  it("pessoa de OUTRA organização recebe o mesmo desfecho, e nada é escrito — §6.3", async () => {
    const id = await registrada("Grelha do ralo");

    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Aurora ${SUFIXO}`, `AU${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    const [forasteira] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Forasteira A ${SUFIXO}`],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [forasteira!.id, outra!.id],
    );

    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: forasteira!.id,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    expect(resultado).toStrictEqual({ desfecho: "responsavel-sem-vinculo-ativo" });
    const linhas = await consultaCrua(`select 1 from atribuicoes where ocorrencia_id = $1`, [id]);
    expect(linhas).toHaveLength(0);
  });

  it("ISOLAMENTO DE ESCRITA: a ocorrência de outra organização não é encontrada e nada é escrito — A4", async () => {
    const id = await registrada("Fechadura do salão");

    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Bosque ${SUFIXO}`, `BO${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    const consultaDeB = escoparConsulta(criarConsulta(), outra!.id);
    const deB = repositorioEscopadoDeOcorrencias(
      consultaDeB,
      escoparTransacao(criarTransacao(), outra!.id),
    );

    // **Desde o item 21 quem decide é o guarda de estado da PRÓPRIA ocorrência**, e não mais o
    // `where exists` do `insert`: o `update` da raiz, escopado em B, não acha a linha de A e a porta
    // recusa antes de escrever qualquer coisa. **A garantia A4 fica menos acidental** — ela deixa de
    // depender de o responsável por acaso não ter vínculo em B. E na borda HTTP o comando relê, não acha
    // e responde `404`, que é a verdade sobre uma ocorrência de outra organização.
    const resultado = await deB.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: segundoPessoaId,
      em: EM,
    });

    expect(resultado).toStrictEqual({ desfecho: "conflito" });
    const linhas = await consultaCrua(`select 1 from atribuicoes where ocorrencia_id = $1`, [id]);
    expect(linhas).toHaveLength(0);
  });

  it("a LISTAGEM também traz o responsável — o LATERAL entra nas duas leituras", async () => {
    const id = await registrada("Luz do hall");
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: EM,
    });

    const pagina = await portas().ocorrencias.listar({ limite: 50, cursor: null });
    const item = pagina.find((linha) => linha.id === id);
    expect(item?.responsavel).toStrictEqual({
      pessoaId: segundoPessoaId,
      nome: `Zelador ${SUFIXO}`,
    });
  });

  it("sem atribuição, responsavel continua null nas duas leituras — e null é a verdade, não reserva", async () => {
    const id = await registrada("Campainha do bloco B");
    expect((await portas().ocorrencias.porId(id))?.responsavel).toBeNull();

    const pagina = await portas().ocorrencias.listar({ limite: 50, cursor: null });
    expect(pagina.find((linha) => linha.id === id)?.responsavel).toBeNull();
  });
});

/**
 * ============================================================================
 *  A corrida da atribuição — o item 21, e o predicado da porta
 * ============================================================================
 *
 * **Duas coisas aqui não têm duplo**, e as duas são sobre a janela entre o `carregar` do comando e o
 * `COMMIT` da porta:
 *
 * 1. **A corrida terminal.** A ocorrência fecha no meio, e a porta recusa **sem** encerrar a atribuição
 *    vigente e **sem** gravar linha nova. Sem o predicado, a atribuição entrava num registro fechado —
 *    a mutação silenciosa que a ADR-0001 existe para impedir (contrato §8.4).
 * 2. **A corrida legal.** O movimento do meio foi para outro estado que **continua admitindo** o comando,
 *    e a porta **grava**. É este caso que prova QUAL predicado foi escrito: com
 *    `status = <o que o agregado leu>` — a forma dos itens 25 e 27 — ele responderia `conflito`, e o
 *    `409` sairia com `statusAtual: "em_analise"` ao lado de um `acoesDisponiveis` **contendo
 *    `atribuir-responsavel`**. Corpo que se contradiz em dois campos vizinhos (`respostas.md` P1).
 *
 * **A corrida é construída segurando o agregado carregado**, como os dois casos do item 17
 * (`:2350` e `:2387`) já fazem. Não há duas sessões simultâneas: há uma leitura, uma transição por outro
 * caminho, e só então a chamada à porta.
 */
describe("a corrida da atribuição contra Postgres — item 21", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.resolver",
  ];

  /** O primeiro responsável — o que a corrida terminal NÃO pode perder. */
  let executorPessoaId: string;
  /** Para quem a reatribuição recusada iria. */
  let substitutoPessoaId: string;

  beforeAll(async () => {
    const [executor] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Executor da corrida ${SUFIXO}`],
    );
    executorPessoaId = executor!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [executorPessoaId, organizacaoId],
    );

    const [substituto] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Substituto da corrida ${SUFIXO}`],
    );
    substitutoPessoaId = substituto!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [substitutoPessoaId, organizacaoId],
    );
  });

  /** Uma ocorrência nova, pelo caminho de verdade — com trilha, como o produto a cria. */
  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa de alguém, e o estado vai mudar no meio.", categoriaId, areaId },
    );
    return lida.id;
  }

  it("A CORRIDA TERMINAL: a ocorrência foi resolvida no meio — recusa, sem gravar e sem encerrar a vigente", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Corrida terminal da atribuicao");

    // A atribuição vigente que a recusa tem de PRESERVAR. Sem ela, o caso provaria metade do critério.
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: "2026-08-29T09:00:00.000Z",
    });

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });

    // **A janela abre aqui**: é o que o comando faz antes de chamar a porta.
    const carregada = await portas().ocorrencias.carregar(id);
    expect(carregada!.ocorrencia.status).toBe("em_atendimento");

    // Outro Gestor chega antes e FECHA a ocorrência.
    await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Fechada antes de a reatribuição gravar.",
    });

    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: substitutoPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });

    expect(resultado).toStrictEqual({ desfecho: "conflito" });

    // **As três asserções juntas são o critério 21.4 sob corrida.** Uma linha só, dela, ainda vigente.
    const linhas = await consultaCrua<{
      responsavel_pessoa_id: string;
      encerrada_em: Date | null;
    }>(
      `select responsavel_pessoa_id, encerrada_em
         from atribuicoes where ocorrencia_id = $1 order by atribuido_em`,
      [id],
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.responsavel_pessoa_id).toBe(executorPessoaId);
    expect(linhas[0]!.encerrada_em).toBeNull();
  });

  it("A CORRIDA LEGAL: o estado mudou para outro que ADMITE o comando, e a porta GRAVA", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Corrida legal da atribuicao");

    // **A janela abre aqui, com a ocorrência em `aberta`.** É o valor que quem trocasse o predicado por
    // `status = <o que o agregado leu>` passaria ao SQL — e é por isso que este caso o reprova.
    const carregada = await portas().ocorrencias.carregar(id);
    expect(carregada!.ocorrencia.status).toBe("aberta");

    // Outro Gestor move a ocorrência — para um estado que **continua admitindo** o comando.
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const resultado = await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });

    expect(resultado.desfecho).toBe("atribuida");

    // **Os dois juntos são a asserção.** A atribuição entrou, e o status é o que o outro Gestor deixou —
    // o `update` da raiz não toca a coluna de status.
    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.status).toBe("em_analise");

    const vigentes = await consultaCrua(
      `select 1 from atribuicoes where ocorrencia_id = $1 and encerrada_em is null`,
      [id],
    );
    expect(vigentes).toHaveLength(1);
  });
});

/**
 * ============================================================================
 *  O atendimento contra Postgres — o item 22
 * ============================================================================
 *
 * **Três coisas aqui não têm duplo:**
 *
 * 1. **A trilha de TRÊS registros**, no banco, com o terceiro gravado no mesmo `COMMIT` do `update`.
 * 2. **O `exists` da invariante 9 decidindo de verdade** — com e sem atribuição vigente, contra a tabela.
 * 3. **A recusa não escrevendo nada:** `ocorrencias.status` continua `em_analise` e a trilha continua
 *    com dois.
 */
describe("o atendimento contra Postgres — item 22", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
  ];

  /** Quem vai ser o responsável — precisa de vínculo ATIVO nesta organização (D21 como FK). */
  let zeladorPessoaId: string;

  beforeAll(async () => {
    const [zelador] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Atendente ${SUFIXO}`],
    );
    zeladorPessoaId = zelador!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [zeladorPessoaId, organizacaoId],
    );
  });

  /** Uma ocorrência nova, pelo caminho de verdade. */
  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa começar.", categoriaId, areaId },
    );
    return lida.id;
  }

  it("o ciclo mínimo: analisar → atribuir → iniciar-atendimento, e a trilha fica com TRÊS — critério 22.1", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Ciclo mínimo");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });

    const lida = await iniciarAtendimento(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      observacao: "O Zelador começa amanhã.",
    });

    // **`em_atendimento` existe pela primeira vez em banco.**
    expect(lida.status).toBe("em_atendimento");
    expect(lida.ultimaTransicao.statusAnterior).toBe("em_analise");
    expect(lida.ultimaTransicao.observacao).toBe("O Zelador começa amanhã.");

    const registros = await consultaCrua<{ sequencia: number; status_novo: string }>(
      `select sequencia, status_novo from registros_transicao
        where ocorrencia_id = $1 order by sequencia`,
      [id],
    );
    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
    ]);

    // **A atribuição NÃO entrou na trilha** — critério 19.4, conferido de novo agora que há três.
    expect(registros).toHaveLength(3);
  });

  it("SEM atribuição, o comando recusa e o banco não muda — critério 22.2", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Sem responsável");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const erro = await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id }).catch(
      (causa: unknown) => causa,
    );

    expect((erro as { codigo?: string }).codigo).toBe("RESPONSAVEL_NAO_ATRIBUIDO");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "em_analise",
    );

    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.status).toBe("em_analise");

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    // **Continua com dois.** Nenhum registro é criado na recusa.
    expect(registros).toHaveLength(2);
  });

  it("iniciar duas vezes dá 409 na segunda, e a trilha continua com três — critério 22.4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Iniciar duas vezes");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });

    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const erro = await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id }).catch(
      (causa: unknown) => causa,
    );
    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "em_atendimento",
    );

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(3);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não inicia — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Isolamento do atendimento");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho22 ${SUFIXO}`, `V2${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(iniciarAtendimento(deOutra, ctx, { ocorrenciaId: id })).rejects.toMatchObject({
      codigo: "OCORRENCIA_NAO_ENCONTRADA",
    });

    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    // **Não escreveu.** O `organizacao_id = $1` vem do escopo, e o comando nem chegou à escrita.
    expect(linha?.status).toBe("em_analise");
  });
});

describe("a resolução contra Postgres — item 26", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.resolver",
  ];

  /** Quem vai ser o responsável — precisa de vínculo ATIVO nesta organização (D21 como FK). */
  let executorPessoaId: string;

  beforeAll(async () => {
    const [executor] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Executor ${SUFIXO}`],
    );
    executorPessoaId = executor!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [executorPessoaId, organizacaoId],
    );
  });

  /** Uma ocorrência nova, pelo caminho de verdade. */
  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa acabar.", categoriaId, areaId },
    );
    return lida.id;
  }

  /** Leva a ocorrência até `em_atendimento` pelo caminho de verdade — analisar, atribuir, iniciar. */
  async function emAtendimento(titulo: string): Promise<string> {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada(titulo);
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    return id;
  }

  it("carregar reidrata o agregado COM a solução aplicada gravada", async () => {
    const id = await emAtendimento("Reidratação da solução");

    // Escrita por fora, de propósito: aqui o que se prova é a LEITURA do agregado, e o único escritor
    // do produto ainda não rodou neste caso.
    await consultaCrua(`update ocorrencias set solucao_aplicada = $2 where id = $1`, [
      id,
      "Gravada por fora, para provar a leitura.",
    ]);

    const carregada = await portas().ocorrencias.carregar(id);

    expect(carregada!.ocorrencia.solucaoAplicada).toBe("Gravada por fora, para provar a leitura.");
  });

  it("aplicarTransicao grava a solução aplicada no MESMO update — e a trilha ganha UM registro", async () => {
    const id = await emAtendimento("Solução no mesmo commit");

    const carregada = await portas().ocorrencias.carregar(id);
    const resolvida = carregada!.ocorrencia.resolver({
      autorPessoaId: pessoaId,
      ocorreuEm: new Date().toISOString(),
      observacao: "Conferido com a moradora.",
      solucaoAplicada: "Trocada a lâmpada da vaga 34.",
    });

    const resultado = await portas().ocorrencias.aplicarTransicao(id, resolvida);

    expect(resultado.desfecho).toBe("aplicada");

    const [linha] = await consultaCrua<{ status: string; solucao_aplicada: string | null }>(
      `select status, solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    // **Uma instrução, duas colunas, um `COMMIT`** — é a metade do critério 25.3 que esta fatia entrega.
    expect(linha?.status).toBe("resolvida");
    expect(linha?.solucao_aplicada).toBe("Trocada a lâmpada da vaga 34.");

    const registros = await consultaCrua<{ status_novo: string }>(
      `select status_novo from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );
    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "resolvida",
    ]);
  });

  it("resolver SEM solução aplicada não apaga a que já estava na coluna", async () => {
    const id = await emAtendimento("Preservação em banco");

    await consultaCrua(`update ocorrencias set solucao_aplicada = $2 where id = $1`, [
      id,
      "Escrita antes de resolver.",
    ]);

    const carregada = await portas().ocorrencias.carregar(id);
    await portas().ocorrencias.aplicarTransicao(
      id,
      carregada!.ocorrencia.resolver({
        autorPessoaId: pessoaId,
        ocorreuEm: new Date().toISOString(),
      }),
    );

    const [linha] = await consultaCrua<{ solucao_aplicada: string | null }>(
      `select solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    // **O agregado carregou o valor e o devolveu.** Sem a coluna no `SELECT_DO_AGREGADO`, o `update`
    // gravaria `null` aqui — e a coluna congela em `resolvida`, então não haveria conserto.
    expect(linha?.solucao_aplicada).toBe("Escrita antes de resolver.");
  });

  it("a corrida: a SEGUNDA aplicação devolve conflito e NÃO escreve a solução", async () => {
    const id = await emAtendimento("Corrida de resolução");

    const carregada = await portas().ocorrencias.carregar(id);
    const resolvida = carregada!.ocorrencia.resolver({
      autorPessoaId: pessoaId,
      ocorreuEm: new Date().toISOString(),
      solucaoAplicada: "A primeira ganha.",
    });

    // O mesmo agregado, aplicado duas vezes: o `where status = 'em_atendimento'` da segunda não acha
    // linha, porque a primeira já moveu para `resolvida`.
    expect((await portas().ocorrencias.aplicarTransicao(id, resolvida)).desfecho).toBe("aplicada");

    const segunda = await portas().ocorrencias.aplicarTransicao(
      id,
      carregada!.ocorrencia.resolver({
        autorPessoaId: pessoaId,
        ocorreuEm: new Date().toISOString(),
        solucaoAplicada: "A segunda NÃO pode gravar.",
      }),
    );

    expect(segunda.desfecho).toBe("conflito");

    const [linha] = await consultaCrua<{ solucao_aplicada: string | null }>(
      `select solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    // **O predicado otimista protege a coluna junto com o status**, porque os dois estão no mesmo
    // `update`. É a frase da §3.3 da spec conferida — e ela deixa de valer quando o item 25 criar o
    // segundo escritor, que não move `status` e por isso não é visto por este predicado (achado A-2).
    expect(linha?.solucao_aplicada).toBe("A primeira ganha.");

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(4);
  });

  it("o ciclo mínimo: registrar → analisar → atribuir → iniciar → resolver, com QUATRO registros", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Ciclo completo");

    const lida = await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      observacao: "Conferido com a moradora.",
      solucaoAplicada: "Trocada a lâmpada da vaga 34 e revisado o reator do corredor.",
    });

    // **`resolvida` existe pela primeira vez em banco, pelo caminho de verdade.**
    expect(lida.status).toBe("resolvida");
    expect(lida.ultimaTransicao.statusAnterior).toBe("em_atendimento");
    expect(lida.solucaoAplicada).toBe(
      "Trocada a lâmpada da vaga 34 e revisado o reator do corredor.",
    );

    const registros = await consultaCrua<{ status_novo: string }>(
      `select status_novo from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );
    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "resolvida",
    ]);
    // **Um registro para a resolução, mesmo tendo gravado a solução junto** — critério 25.3.
    expect(registros).toHaveLength(4);
  });

  it("resolver DUAS vezes dá 409 na segunda, e a trilha continua com quatro — critério 26.5", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Idempotência pela máquina");

    await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "A primeira, e a única.",
    });

    const erro = await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Esta NÃO pode entrar.",
    }).catch((causa: unknown) => causa);

    // **A máquina de estados faz o papel da chave de idempotência** (contrato §7.10).
    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "resolvida",
    );
    expect(
      (erro as { extensoes?: Record<string, unknown> }).extensoes?.["acoesDisponiveis"],
    ).toStrictEqual([]);

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(4);

    const [linha] = await consultaCrua<{ solucao_aplicada: string | null }>(
      `select solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.solucao_aplicada).toBe("A primeira, e a única.");
  });

  it("o Solicitante autor NÃO recebe resolver em acoesDisponiveis — o critério 26.3 onde ele é decidível", async () => {
    /**
     * **O `403` do critério 26.3 é do `comContexto`, e este caminho não passa por ele** (D-P3, furo
     * F-5): chamar `resolverOcorrencia` com permissões pobres **teria sucesso**, porque o autor enxerga
     * a própria ocorrência e a transição está permitida. O que é decidível aqui é a metade que a tela
     * consome — e é a que impede o botão de existir.
     */
    const id = await emAtendimento("O autor não resolve");

    const lida = await verOcorrencia(portas().ocorrencias, id);
    const doAutor = projetarOcorrenciaDetalhe(lida, {
      pessoaId,
      permissoes: ["ocorrencia.ler_propria", "ocorrencia.cancelar_propria", "ocorrencia.avaliar"],
    });

    expect(doAutor.acoesDisponiveis).not.toContain("resolver");
    expect(doAutor.acoesDisponiveis).toStrictEqual([]);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não resolve — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Isolamento da resolução");

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho26 ${SUFIXO}`, `V6${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(
      resolverOcorrencia(deOutra, ctx, { ocorrenciaId: id, solucaoAplicada: "Da organização errada." }),
    ).rejects.toMatchObject({ codigo: "OCORRENCIA_NAO_ENCONTRADA" });

    const [linha] = await consultaCrua<{ status: string; solucao_aplicada: string | null }>(
      `select status, solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    // **Não escreveu nem o status nem a coluna nova.** O `organizacao_id = $1` vem do escopo, e o
    // comando nem chegou à escrita.
    expect(linha?.status).toBe("em_atendimento");
    expect(linha?.solucao_aplicada).toBeNull();
  });
});

describe("a pausa contra Postgres — item 23", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.pausar",
  ];

  let zeladorPessoaId: string;

  beforeAll(async () => {
    const [zelador] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Pausador ${SUFIXO}`],
    );
    zeladorPessoaId = zelador!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [zeladorPessoaId, organizacaoId],
    );
  });

  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa esperar.", categoriaId, areaId },
    );
    return lida.id;
  }

  it("analisar → atribuir → iniciar → pausar: QUATRO registros, e motivo_pausa gravado — critérios 23.1 e 23.3", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Pausa depois do atendimento");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const lida = await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "Sem lâmpada no estoque; pedido feito ao fornecedor.",
    });

    // **`pausada` existe pela primeira vez em banco.**
    expect(lida.status).toBe("pausada");
    expect(lida.ultimaTransicao.statusAnterior).toBe("em_atendimento");
    expect(lida.ultimaTransicao.motivoPausa).toBe("aguardando_peca");

    const registros = await consultaCrua<{
      status_novo: string;
      motivo_pausa: string | null;
      motivo_cancelamento: string | null;
      observacao: string | null;
    }>(
      `select status_novo, motivo_pausa, motivo_cancelamento, observacao
         from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );

    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "pausada",
    ]);

    const pausa = registros[3]!;
    // **Os dois lados do CHECK registros_transicao_motivo_ck, conferidos no banco de verdade.**
    expect(pausa.motivo_pausa).toBe("aguardando_peca");
    expect(pausa.motivo_cancelamento).toBeNull();
    expect(pausa.observacao).toBe("Sem lâmpada no estoque; pedido feito ao fornecedor.");
  });

  it("pausar DIRETO de em_analise grava status_anterior = 'em_analise' — é o dado que o item 24 vai ler", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Pausa antes de atender");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_autorizacao",
      observacao: "Esperando o síndico autorizar a compra.",
    });

    const [pausa] = await consultaCrua<{ status_anterior: string; sequencia: number }>(
      `select status_anterior, sequencia from registros_transicao
        where ocorrencia_id = $1 and status_novo = 'pausada'`,
      [id],
    );

    // **A trilha tem TRÊS aqui, não quatro — e o statusAnterior é a outra origem.**
    expect(pausa?.status_anterior).toBe("em_analise");
    expect(pausa?.sequencia).toBe(3);
  });

  it("pausar duas vezes dá 409 na segunda, e a trilha continua com três — critério 23.2", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Pausar duas vezes");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_terceiro",
      observacao: "A empresa de elevadores vem quinta.",
    });

    const erro = await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "De novo.",
    }).catch((causa: unknown) => causa);

    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "pausada",
    );

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(3);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não pausa — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Isolamento da pausa");
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho23 ${SUFIXO}`, `V3${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(
      pausarOcorrencia(deOutra, ctx, {
        ocorrenciaId: id,
        motivo: "aguardando_peca",
        observacao: "Da organização errada.",
      }),
    ).rejects.toMatchObject({ codigo: "OCORRENCIA_NAO_ENCONTRADA" });

    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    // **Não escreveu o status, e não gravou registro.** O `organizacao_id = $1` vem do escopo, e o
    // comando nem chegou à escrita.
    expect(linha?.status).toBe("em_analise");

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(2);
  });
});
describe("a retomada contra Postgres — item 24", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.pausar",
    "ocorrencia.retomar",
  ];

  let zeladorPessoaId: string;

  beforeAll(async () => {
    const [zelador] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Retomador ${SUFIXO}`],
    );
    zeladorPessoaId = zelador!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [zeladorPessoaId, organizacaoId],
    );
  });

  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa esperar e voltar.", categoriaId, areaId },
    );
    return lida.id;
  }

  it("analisar → atribuir → iniciar → pausar → retomar volta a em_atendimento, com CINCO registros — critérios 24.1 e 24.4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Retomada depois do atendimento");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "Sem lâmpada no estoque; pedido feito ao fornecedor.",
    });

    const lida = await retomarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      observacao: "Peça chegou hoje de manhã.",
    });

    // **O destino saiu da trilha, e ninguém o informou.**
    expect(lida.status).toBe("em_atendimento");
    expect(lida.ultimaTransicao.statusAnterior).toBe("pausada");
    // **O motivo da pausa some sozinho na resposta**, por construção e não por código: `montarOcorrencia`
    // o deriva do último registro, e o último registro já não é de pausa.
    expect(lida.motivoPausa).toBeNull();

    const registros = await consultaCrua<{
      status_anterior: string | null;
      status_novo: string;
      motivo_pausa: string | null;
      observacao: string | null;
    }>(
      `select status_anterior, status_novo, motivo_pausa, observacao
         from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );

    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "pausada",
      "em_atendimento",
    ]);

    const retomada = registros[4]!;
    expect(retomada.status_anterior).toBe("pausada");
    // **Os dois lados do `registros_transicao_motivo_ck`:** destino que não é `pausada` nem `cancelada`
    // NÃO pode ter motivo, e o banco confere.
    expect(retomada.motivo_pausa).toBeNull();
    expect(retomada.observacao).toBe("Peça chegou hoje de manhã.");

    // **A pausa continua na trilha, intacta.** É o que "auditável" quer dizer.
    expect(registros[3]!.motivo_pausa).toBe("aguardando_peca");
  });

  it("pausada DIRETO de em_analise volta a em_analise — é o caso que prova o critério 24.1", async () => {
    // **O item 23 já deixou este dado gravado**, e o caso dele diz isso em letra. Aqui a outra ponta:
    // a MESMA chamada de `retomar` produz outro destino, porque a trilha é outra.
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Retomada antes de atender");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_autorizacao",
      observacao: "Esperando o síndico autorizar a compra.",
    });

    const lida = await retomarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    expect(lida.status).toBe("em_analise");

    const [retomada] = await consultaCrua<{ status_novo: string; sequencia: number }>(
      `select status_novo, sequencia from registros_transicao
        where ocorrencia_id = $1 and status_anterior = 'pausada'`,
      [id],
    );

    // **QUATRO registros aqui, não cinco** — e o destino é a outra origem.
    expect(retomada?.status_novo).toBe("em_analise");
    expect(retomada?.sequencia).toBe(4);
  });

  it("retomar SEM responsável atribuído passa, e volta a em_atendimento — a invariante 9 não é desta porta", async () => {
    // O caminho não é produzível pela API hoje (não há desatribuição), mas o banco o admite: o que
    // este caso fixa é que `retomar` **não** consulta `atribuicoes` para decidir (spec §3.4).
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Retomada sem responsavel");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_terceiro",
      observacao: "A empresa de elevadores vem quinta.",
    });

    // **Encerra a atribuição por SQL cru** — é a única forma de produzir o estado, e dizê-lo é o ponto.
    await consultaCrua(
      `update atribuicoes set encerrada_em = now(), motivo_encerramento = 'reatribuicao'
        where ocorrencia_id = $1 and encerrada_em is null`,
      [id],
    );

    const lida = await retomarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    expect(lida.status).toBe("em_atendimento");
    expect(lida.responsavel).toBeNull();
  });

  it("retomar duas vezes dá 409 na segunda, e a trilha continua com quatro — critério 24.3", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Retomar duas vezes");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "Sem peça.",
    });
    await retomarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const erro = await retomarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
    }).catch((causa: unknown) => causa);

    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "em_analise",
    );

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(4);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não retoma — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Isolamento da retomada");
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "Sem peça.",
    });

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho24 ${SUFIXO}`, `V4${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(retomarOcorrencia(deOutra, ctx, { ocorrenciaId: id })).rejects.toMatchObject({
      codigo: "OCORRENCIA_NAO_ENCONTRADA",
    });

    // E a ocorrência continua **pausada** na organização dona dela.
    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.status).toBe("pausada");
  });
});

describe("a solução aplicada contra Postgres — item 25", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.pausar",
    "ocorrencia.registrar_solucao",
    "ocorrencia.resolver",
  ];

  let executorPessoaId: string;

  beforeAll(async () => {
    const [executor] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Solucionador ${SUFIXO}`],
    );
    executorPessoaId = executor!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [executorPessoaId, organizacaoId],
    );
  });

  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa ser descrito depois.", categoriaId, areaId },
    );
    return lida.id;
  }

  /** Leva a ocorrência até `em_atendimento` pelo caminho de verdade — analisar, atribuir, iniciar. */
  async function emAtendimento(titulo: string): Promise<string> {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada(titulo);
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    return id;
  }

  /** `pausada` pelo caminho mais curto — a pausa sai de `em_analise` também (critério 23.2). */
  async function pausada(titulo: string): Promise<string> {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada(titulo);
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "Sem lâmpada no estoque.",
    });
    return id;
  }

  /** Quantos registros a trilha tem agora. */
  async function registrosDe(id: string): Promise<number> {
    const linhas = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    return linhas.length;
  }

  it("a coluna é gravada e a TRILHA CONTINUA DO MESMO TAMANHO — o critério 25.1 contra Postgres", async () => {
    const id = await emAtendimento("Solução sem registro");
    const antes = await registrosDe(id);

    const carregada = await portas().ocorrencias.carregar(id);
    const gravada = carregada!.ocorrencia.registrarSolucaoAplicada({
      solucaoAplicada: "Trocada a lâmpada da vaga 34.",
    });

    const resultado = await portas().ocorrencias.registrarSolucaoAplicada(
      id,
      gravada,
      new Date().toISOString(),
    );

    expect(resultado.desfecho).toBe("gravada");

    const [linha] = await consultaCrua<{ status: string; solucao_aplicada: string | null }>(
      `select status, solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.solucao_aplicada).toBe("Trocada a lâmpada da vaga 34.");
    // **O status não muda**, e a trilha não cresce. É o único comando construído até aqui do qual os dois
    // são verdade — e a segunda asserção é a que nenhum outro item pôde fazer.
    expect(linha?.status).toBe("em_atendimento");
    expect(await registrosDe(id)).toBe(antes);
  });

  it("grava a partir de pausada também — a segunda origem da tabela companheira", async () => {
    const id = await pausada("Solução durante a espera");
    const antes = await registrosDe(id);

    const carregada = await portas().ocorrencias.carregar(id);
    await portas().ocorrencias.registrarSolucaoAplicada(
      id,
      carregada!.ocorrencia.registrarSolucaoAplicada({ solucaoAplicada: "Peça pedida e instalada." }),
      new Date().toISOString(),
    );

    const [linha] = await consultaCrua<{ status: string; solucao_aplicada: string | null }>(
      `select status, solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.solucao_aplicada).toBe("Peça pedida e instalada.");
    expect(linha?.status).toBe("pausada");
    expect(await registrosDe(id)).toBe(antes);
  });

  it("atualizada_em AVANÇA, e é o carimbo que o comando leu — nunca now()", async () => {
    const id = await emAtendimento("Carimbo de atividade");

    const [antes] = await consultaCrua<{ atualizada_em: Date }>(
      `select atualizada_em from ocorrencias where id = $1`,
      [id],
    );

    // **Um instante escolhido, e não o relógio do banco.** A §7.4 do modelo diz que o campo é escrito
    // pelo agregado a cada comando; a §5.8 da arquitetura diz que ele significa *"houve atividade"*.
    const instante = new Date(Date.now() + 60_000).toISOString();
    const carregada = await portas().ocorrencias.carregar(id);
    await portas().ocorrencias.registrarSolucaoAplicada(
      id,
      carregada!.ocorrencia.registrarSolucaoAplicada({ solucaoAplicada: "Feito." }),
      instante,
    );

    const [depois] = await consultaCrua<{ atualizada_em: Date }>(
      `select atualizada_em from ocorrencias where id = $1`,
      [id],
    );
    expect(new Date(depois!.atualizada_em).getTime()).toBe(new Date(instante).getTime());
    expect(new Date(depois!.atualizada_em).getTime()).toBeGreaterThan(
      new Date(antes!.atualizada_em).getTime(),
    );
  });

  it("A CORRIDA: o estado mudou entre o carregar e o update, e o predicado recusa — a §3.3 provada", async () => {
    // **É o furo F-4 do plano, e o caso que a spec julgou inalcançável.** Ele é alcançável porque o teste
    // SEGURA o agregado carregado: resolvemos a ocorrência por outro caminho e só então chamamos a porta
    // com a instância velha. É literalmente a janela entre `carregar` e `update`.
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Corrida com o resolver");

    const carregada = await portas().ocorrencias.carregar(id);
    const gravada = carregada!.ocorrencia.registrarSolucaoAplicada({
      solucaoAplicada: "Escrita tarde demais.",
    });

    // Outro Gestor chega antes e encerra a ocorrência.
    await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "A que ficou.",
    });

    const resultado = await portas().ocorrencias.registrarSolucaoAplicada(
      id,
      gravada,
      new Date().toISOString(),
    );

    // **`conflito`, e não escrita.** Sem o predicado, o texto de cima teria entrado numa ocorrência
    // `resolvida`, sem nada na linha do tempo dizendo quando nem por quem.
    expect(resultado.desfecho).toBe("conflito");

    const [linha] = await consultaCrua<{ status: string; solucao_aplicada: string | null }>(
      `select status, solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.status).toBe("resolvida");
    expect(linha?.solucao_aplicada).toBe("A que ficou.");
  });

  it("em resolvida responde 409 E A COLUNA NÃO MUDA — o critério 25.2 no estado que importa", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Recusa no estado terminal");

    await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "A que ficou, e não há caminho de volta.",
    });

    const erro = await registrarSolucaoAplicada(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Não deveria entrar.",
    }).catch((causa: unknown) => causa);

    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "resolvida",
    );

    const [linha] = await consultaCrua<{ solucao_aplicada: string | null }>(
      `select solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    // **O custo aceito do contrato, do lado bom:** *"uma ocorrência resolvida com o campo vazio fica sem
    // solução aplicada para sempre. Não há caminho de volta, e não deve haver."*
    expect(linha?.solucao_aplicada).toBe("A que ficou, e não há caminho de volta.");
  });

  it("registrar e DEPOIS resolver deixa UMA transição a mais, não duas — o critério 25.3 do outro lado", async () => {
    // **A metade que faltava.** O item 26 provou que `solucaoAplicada` no corpo de `/resolver` grava a
    // coluna com **um** registro. Aqui prova-se o outro caminho: registrar primeiro **não cria registro
    // nenhum**, e o `resolver` seguinte cria exatamente um. Os dois caminhos chegam ao mesmo lugar.
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Dois passos, uma transição");
    const antes = await registrosDe(id);

    await registrarSolucaoAplicada(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Trocado o rufo e refeita a vedação.",
    });

    // Nada na trilha, e é o item.
    expect(await registrosDe(id)).toBe(antes);

    // **`resolver` SEM o campo** — e o agregado preserva a que já havia (`Ocorrencia.ts`), que é a
    // semântica *"ausente = preserva"* que o item 26 construiu exatamente para isto.
    const lida = await resolverOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    expect(lida.status).toBe("resolvida");
    expect(lida.solucaoAplicada).toBe("Trocado o rufo e refeita a vedação.");
    expect(await registrosDe(id)).toBe(antes + 1);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não grava — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Isolamento da solução");

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho25 ${SUFIXO}`, `V5${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(
      registrarSolucaoAplicada(deOutra, ctx, { ocorrenciaId: id, solucaoAplicada: "De fora." }),
    ).rejects.toMatchObject({ codigo: "OCORRENCIA_NAO_ENCONTRADA" });

    const [linha] = await consultaCrua<{ solucao_aplicada: string | null }>(
      `select solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.solucao_aplicada).toBeNull();
  });
});

describe("a prioridade contra Postgres — item 17", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.alterar_prioridade",
    "ocorrencia.resolver",
  ];

  let executorPessoaId: string;

  beforeAll(async () => {
    const [executor] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Triador ${SUFIXO}`],
    );
    executorPessoaId = executor!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [executorPessoaId, organizacaoId],
    );
  });

  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa ser triado.", categoriaId, areaId },
    );
    return lida.id;
  }

  /** Leva a ocorrência até `em_atendimento` pelo caminho de verdade — analisar, atribuir, iniciar. */
  async function emAtendimento(titulo: string): Promise<string> {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada(titulo);
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    return id;
  }

  /** Quantos registros a trilha tem agora. */
  async function registrosDe(id: string): Promise<number> {
    const linhas = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    return linhas.length;
  }

  /** A porta, chamada com o agregado atravessado — o caminho que o comando de aplicação usa. */
  async function gravarPrioridade(id: string, prioridade: "baixa" | "normal" | "alta") {
    const carregada = await portas().ocorrencias.carregar(id);
    return portas().ocorrencias.alterarPrioridade(
      id,
      carregada!.ocorrencia.alterarPrioridade({ prioridade }),
      new Date().toISOString(),
    );
  }

  it("a coluna é gravada e a TRILHA CONTINUA DO MESMO TAMANHO — o critério 17.3 contra Postgres", async () => {
    const id = await registrada("Prioridade sem registro");
    const antes = await registrosDe(id);

    const resultado = await gravarPrioridade(id, "alta");
    expect(resultado.desfecho).toBe("alterada");

    const [linha] = await consultaCrua<{ status: string; prioridade: string }>(
      `select status, prioridade from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.prioridade).toBe("alta");
    // **O status não muda**, e a trilha não cresce. É o segundo comando construído do qual os dois são
    // verdade, e o único cuja alteração não aparece nem na linha do tempo (PA-21).
    expect(linha?.status).toBe("aberta");
    expect(await registrosDe(id)).toBe(antes);
  });

  it("grava a partir dos QUATRO estados admitidos — o complemento de TERMINAIS", async () => {
    // `aberta` e `em_atendimento` cobrem as duas pontas do intervalo admitido; os outros dois estados
    // passam pelo mesmo predicado, e o unitário do domínio cobre os quatro.
    for (const [titulo, id] of [
      ["Prioridade em aberta", await registrada("Prioridade em aberta")],
      ["Prioridade em atendimento", await emAtendimento("Prioridade em atendimento")],
    ] as const) {
      const resultado = await gravarPrioridade(id, "baixa");
      expect(resultado.desfecho, titulo).toBe("alterada");

      const [linha] = await consultaCrua<{ prioridade: string }>(
        `select prioridade from ocorrencias where id = $1`,
        [id],
      );
      expect(linha?.prioridade, titulo).toBe("baixa");
    }
  });

  it("atualizada_em AVANÇA, e é o carimbo que o comando leu — nunca now()", async () => {
    const id = await registrada("Carimbo de atividade da prioridade");

    const [antes] = await consultaCrua<{ atualizada_em: Date }>(
      `select atualizada_em from ocorrencias where id = $1`,
      [id],
    );

    // **Um instante escolhido, e não o relógio do banco.** A §5.8 da arquitetura diz que o campo significa
    // *"houve atividade nesta ocorrência"*, e alterar prioridade é atividade.
    const instante = new Date(Date.now() + 60_000).toISOString();
    const carregada = await portas().ocorrencias.carregar(id);
    await portas().ocorrencias.alterarPrioridade(
      id,
      carregada!.ocorrencia.alterarPrioridade({ prioridade: "alta" }),
      instante,
    );

    const [depois] = await consultaCrua<{ atualizada_em: Date }>(
      `select atualizada_em from ocorrencias where id = $1`,
      [id],
    );
    expect(new Date(depois!.atualizada_em).getTime()).toBe(new Date(instante).getTime());
    expect(new Date(depois!.atualizada_em).getTime()).toBeGreaterThan(
      new Date(antes!.atualizada_em).getTime(),
    );
  });

  it("A CORRIDA LEGAL: o estado mudou para outro NÃO terminal, e a porta GRAVA — a §3.4 provada", async () => {
    // **É o caso que nenhum item anterior tem, e é o que distingue este predicado do do item 25.** Ele é
    // alcançável porque o teste SEGURA o agregado carregado: analisamos a ocorrência por outro caminho e
    // só então chamamos a porta com a instância velha. É literalmente a janela entre `carregar` e `update`.
    //
    // **Com o predicado do item 25 (`status = <o que leu>`) este caso responderia `conflito`**, e a tela
    // mostraria o `detail` publicado — *"a prioridade não muda depois de resolvida ou cancelada"* — sobre
    // uma ocorrência `em_analise`. Frase falsa, sem compensatória (`inventario-de-telas.md:1532-1536`).
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Corrida legal com o analisar");

    const carregada = await portas().ocorrencias.carregar(id);
    const comAlta = carregada!.ocorrencia.alterarPrioridade({ prioridade: "alta" });

    // Outro Gestor chega antes e move a ocorrência — para um estado que **continua admitindo** o comando.
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    // **O instante é lido AGORA**, depois da transição, para que o carimbo não ande para trás. Que a porta
    // *possa* escrever um carimbo mais antigo se quem chama entregar um instante velho é verdade também no
    // item 25, e é achado, não conserto desta fatia.
    const resultado = await portas().ocorrencias.alterarPrioridade(
      id,
      comAlta,
      new Date().toISOString(),
    );

    expect(resultado.desfecho).toBe("alterada");

    const [linha] = await consultaCrua<{ status: string; prioridade: string }>(
      `select status, prioridade from ocorrencias where id = $1`,
      [id],
    );
    // **Os dois juntos são a asserção.** A prioridade entrou, e o status é o que o outro Gestor deixou —
    // o `update` não tocou a coluna de status.
    expect(linha?.prioridade).toBe("alta");
    expect(linha?.status).toBe("em_analise");
  });

  it("A CORRIDA TERMINAL: a ocorrência foi resolvida no meio, e a porta RECUSA — o predicado provado", async () => {
    // A outra metade. **Sem o predicado, esta escrita cairia numa ocorrência `resolvida`**, mudando o
    // detalhe de um registro fechado sem nada na trilha nem na linha do tempo dizendo quando nem por quem
    // — a mutação silenciosa que a ADR-0001 existe para impedir (contrato §8.4).
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Corrida terminal com o resolver");

    const carregada = await portas().ocorrencias.carregar(id);
    const comAlta = carregada!.ocorrencia.alterarPrioridade({ prioridade: "alta" });

    await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Fechada antes de a prioridade mudar.",
    });

    const resultado = await portas().ocorrencias.alterarPrioridade(
      id,
      comAlta,
      new Date().toISOString(),
    );

    expect(resultado.desfecho).toBe("conflito");

    const [linha] = await consultaCrua<{ status: string; prioridade: string }>(
      `select status, prioridade from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.status).toBe("resolvida");
    // **A coluna NÃO mudou** — é o critério 17.2 no estado que importa, medido no banco.
    expect(linha?.prioridade).toBe("normal");
  });

  it("aplicarTransicao NÃO toca prioridade — o critério 17.5 do lado do banco", async () => {
    // **O critério 17.5 é uma AUSÊNCIA:** *"nenhuma política altera prioridade sozinha"*. Não há código
    // para exercitar, então o que se prova é que nenhum outro caminho de escrita mexe na coluna.
    //
    // **Este caso é o mais barato e o mais fácil de esquecer**, e ele quebra no dia em que alguém
    // acrescentar `prioridade` ao `set` de uma transição.
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Prioridade que atravessa a transicao");

    await gravarPrioridade(id, "alta");
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const [linha] = await consultaCrua<{ status: string; prioridade: string }>(
      `select status, prioridade from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.status).toBe("em_analise");
    expect(linha?.prioridade).toBe("alta");
  });

  it("em resolvida o COMANDO responde 409 e a coluna não muda — o critério 17.2 ponta a ponta", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await emAtendimento("Recusa do comando no terminal");

    await resolverOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Fechada, e a prioridade congela com ela.",
    });

    const erro = await alterarPrioridade(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      prioridade: "alta",
    }).catch((causa: unknown) => causa);

    expect((erro as { codigo?: string }).codigo).toBe("PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "resolvida",
    );

    const [linha] = await consultaCrua<{ prioridade: string }>(
      `select prioridade from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.prioridade).toBe("normal");
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não altera — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Isolamento da prioridade");

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho17 ${SUFIXO}`, `V7${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(
      alterarPrioridade(deOutra, ctx, { ocorrenciaId: id, prioridade: "alta" }),
    ).rejects.toMatchObject({ codigo: "OCORRENCIA_NAO_ENCONTRADA" });

    const [linha] = await consultaCrua<{ prioridade: string }>(
      `select prioridade from ocorrencias where id = $1`,
      [id],
    );
    expect(linha?.prioridade).toBe("normal");
  });
});

describe("o cancelamento contra Postgres — item 18", () => {
  /** As permissões do Gestor que este bloco usa. Lista, nunca papel (contrato §4.5). */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.pausar",
    "ocorrencia.registrar_solucao",
    "ocorrencia.cancelar_propria",
    "ocorrencia.cancelar_qualquer",
  ];

  let zeladorPessoaId: string;

  beforeAll(async () => {
    const [zelador] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Cancelador ${SUFIXO}`],
    );
    zeladorPessoaId = zelador!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [zeladorPessoaId, organizacaoId],
    );
  });

  async function registrada(titulo: string): Promise<string> {
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Vai ser cancelada.", categoriaId, areaId },
    );
    return lida.id;
  }

  it("analisar → cancelar: TRÊS registros, e motivo_cancelamento gravado — critérios 18.1 e 18.2", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Cancelada depois da análise");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    const lida = await cancelarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "improcedente",
      observacao: "Vistoriado no local: não há vazamento.",
    });

    // **`cancelada` existe pela primeira vez em banco, e com ela os SEIS estados existem.**
    expect(lida.status).toBe("cancelada");
    expect(lida.ultimaTransicao.statusAnterior).toBe("em_analise");
    expect(lida.ultimaTransicao.motivoCancelamento).toBe("improcedente");

    const registros = await consultaCrua<{
      status_novo: string;
      motivo_pausa: string | null;
      motivo_cancelamento: string | null;
      observacao: string | null;
    }>(
      `select status_novo, motivo_pausa, motivo_cancelamento, observacao
         from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );

    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "cancelada",
    ]);

    const cancelamento = registros[2]!;
    // **A SEGUNDA metade do `registros_transicao_motivo_ck`, exercitada pela primeira vez.** A do
    // `pausada` chegou no item 23; esta é a irmã, e com ela o `CHECK` fecha nos dois lados.
    expect(cancelamento.motivo_cancelamento).toBe("improcedente");
    expect(cancelamento.motivo_pausa).toBeNull();
    expect(cancelamento.observacao).toBe("Vistoriado no local: não há vazamento.");
  });

  it("cancelar DIRETO de aberta grava status_anterior = 'aberta' — a primeira das quatro origens", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Cancelada sem análise");

    await cancelarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aberta_por_engano",
      observacao: "Abri sem querer.",
    });

    const [cancelamento] = await consultaCrua<{ status_anterior: string; sequencia: number }>(
      `select status_anterior, sequencia from registros_transicao
        where ocorrencia_id = $1 and status_novo = 'cancelada'`,
      [id],
    );

    expect(cancelamento?.status_anterior).toBe("aberta");
    expect(cancelamento?.sequencia).toBe(2);
  });

  it("cancelar a partir de PAUSADA: o motivo_pausa do registro anterior continua lá — a trilha é append-only", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Cancelada durante a pausa");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await pausarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "aguardando_peca",
      observacao: "Sem lâmpada no estoque.",
    });

    await cancelarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "fora_de_escopo",
      observacao: "A peça é da concessionária, não da organização.",
    });

    const registros = await consultaCrua<{
      status_novo: string;
      motivo_pausa: string | null;
      motivo_cancelamento: string | null;
    }>(
      `select status_novo, motivo_pausa, motivo_cancelamento
         from registros_transicao where ocorrencia_id = $1 order by sequencia`,
      [id],
    );

    expect(registros.map((registro) => registro.status_novo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "pausada",
      "cancelada",
    ]);

    // **O registro da pausa não é tocado** — a trilha é *append-only*, e o gatilho do banco a defende.
    expect(registros[3]?.motivo_pausa).toBe("aguardando_peca");
    expect(registros[3]?.motivo_cancelamento).toBeNull();
    expect(registros[4]?.motivo_pausa).toBeNull();
    expect(registros[4]?.motivo_cancelamento).toBe("fora_de_escopo");
  });

  it("o CHECK recusa em voz alta os DOIS lados — e é o que só o banco prova", async () => {
    const id = await registrada("O CHECK do cancelamento");

    // 1 · destino `cancelada` **sem** motivo de cancelamento.
    await expect(
      consultaCrua(
        `insert into registros_transicao
           (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id, observacao)
         values ($1, $2, 2, 'aberta', 'cancelada', $3, 'sem motivo')`,
        [organizacaoId, id, pessoaId],
      ),
    ).rejects.toThrow(/registros_transicao_motivo_ck/u);

    // 2 · destino rotineiro **com** motivo de cancelamento.
    await expect(
      consultaCrua(
        `insert into registros_transicao
           (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id,
            observacao, motivo_cancelamento)
         values ($1, $2, 2, 'aberta', 'em_analise', $3, 'motivo a mais', 'duplicada')`,
        [organizacaoId, id, pessoaId],
      ),
    ).rejects.toThrow(/registros_transicao_motivo_ck/u);
  });

  it("solucao_aplicada SOBREVIVE ao cancelamento — encerrar não é apagar o trabalho descrito", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Cancelada com solução registrada");

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: zeladorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await registrarSolucaoAplicada(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      solucaoAplicada: "Trocada a lâmpada da vaga 34.",
    });

    await cancelarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "sem_informacao_suficiente",
      observacao: "O solicitante não respondeu.",
    });

    const [linha] = await consultaCrua<{ status: string; solucao_aplicada: string | null }>(
      `select status, solucao_aplicada from ocorrencias where id = $1`,
      [id],
    );

    expect(linha?.status).toBe("cancelada");
    expect(linha?.solucao_aplicada).toBe("Trocada a lâmpada da vaga 34.");
  });

  it("cancelar duas vezes dá 409 na segunda, e a trilha NÃO cresce", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Cancelar duas vezes");

    await cancelarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "desistencia",
      observacao: "Desisti.",
    });

    const erro = await cancelarOcorrencia(portas().ocorrencias, ctx, {
      ocorrenciaId: id,
      motivo: "duplicada",
      observacao: "De novo.",
    }).catch((causa: unknown) => causa);

    expect((erro as { codigo?: string }).codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect((erro as { extensoes?: Record<string, unknown> }).extensoes?.["statusAtual"]).toBe(
      "cancelada",
    );

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(2);
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não cancela — critério A4", async () => {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const id = await registrada("Isolamento do cancelamento");
    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });

    // Uma segunda organização, com o **mesmo** Postgres e a mesma Pessoa — o cenário que detecta o
    // vazamento de verdade. A suíte de isolamento não sabe expressar o lado de ESCRITA.
    const [outra] = await consultaCrua<{ id: string }>(
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      [`Vizinho18 ${SUFIXO}`, `V8${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();
    await expect(
      cancelarOcorrencia(deOutra, ctx, {
        ocorrenciaId: id,
        motivo: "improcedente",
        observacao: "Da organização errada.",
      }),
    ).rejects.toMatchObject({ codigo: "OCORRENCIA_NAO_ENCONTRADA" });

    const [linha] = await consultaCrua<{ status: string }>(
      `select status from ocorrencias where id = $1`,
      [id],
    );
    // **Não escreveu o status, e não gravou registro.** O `organizacao_id = $1` vem do escopo, e o
    // comando nem chegou à escrita.
    expect(linha?.status).toBe("em_analise");

    const registros = await consultaCrua(
      `select sequencia from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros).toHaveLength(2);
  });
});

describe("a avaliação contra Postgres — item 27", () => {
  /** As permissões do Gestor que este bloco usa para LEVAR a ocorrência até `resolvida`. */
  const DO_GESTOR = [
    "ocorrencia.ler_todas",
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    "ocorrencia.resolver",
  ];

  /**
   * As permissões do **autor**, e é a lista que o comando novo usa.
   *
   * **`ler_todas` NÃO está aqui, e a ausência é teste:** quem tenta avaliar ocorrência de outra pessoa
   * sem `ler_todas` leva `404`, nunca `403`.
   */
  const DO_AUTOR = ["ocorrencia.ler_propria", "ocorrencia.avaliar"];

  /** O Gestor que NÃO é o autor — precisa de `ler_todas` para chegar ao `403` em vez do `404`. */
  const DO_GESTOR_NAO_AUTOR = ["ocorrencia.ler_todas", "ocorrencia.avaliar"];

  let executorPessoaId: string;
  let outraPessoaId: string;

  beforeAll(async () => {
    const [executor] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Executor da avaliação ${SUFIXO}`],
    );
    executorPessoaId = executor!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'encarregado')`,
      [executorPessoaId, organizacaoId],
    );

    const [outra] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Gestor nao autor ${SUFIXO}`],
    );
    outraPessoaId = outra!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [outraPessoaId, organizacaoId],
    );
  });

  /** Leva a ocorrência até `resolvida` pelo caminho de verdade — o ciclo inteiro do produto. */
  async function resolvida(titulo: string): Promise<string> {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa acabar.", categoriaId, areaId },
    );
    const id = lida.id;

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await resolverOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    return id;
  }

  /**
   * O mesmo caminho de `resolvida()`, **menos a última linha** — para o caso do `409` de estado.
   *
   * **Não reusa o `emAtendimento` do bloco do item 26**: aquele é local àquele `describe` e usa o
   * `executorPessoaId` dele.
   */
  async function emAtendimentoParaAvaliar(titulo: string): Promise<string> {
    const ctx = { pessoaId, permissoes: DO_GESTOR };
    const lida = await registrarOcorrencia(
      portas(),
      { pessoaId, organizacaoId },
      { titulo, descricao: "Precisa acabar.", categoriaId, areaId },
    );
    const id = lida.id;

    await analisarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id });
    await portas().ocorrencias.atribuirResponsavel(id, {
      responsavelPessoaId: executorPessoaId,
      atribuidoPorPessoaId: pessoaId,
      em: new Date().toISOString(),
    });
    await iniciarAtendimento(portas().ocorrencias, ctx, { ocorrenciaId: id });
    return id;
  }

  it("carregar reidrata o agregado COM a avaliação gravada", async () => {
    const id = await resolvida("Reidratação da avaliação");

    // Escrita por fora, de propósito: aqui o que se prova é a LEITURA do agregado, e o escritor do
    // produto é exercitado nos casos seguintes.
    await consultaCrua(
      `update ocorrencias
          set avaliacao_nota = 4, avaliacao_comentario = 'Demorou, mas resolveram.',
              avaliada_em = now()
        where id = $1`,
      [id],
    );

    const carregada = await portas().ocorrencias.carregar(id);

    expect(carregada?.ocorrencia.avaliacao?.nota).toBe(4);
    expect(carregada?.ocorrencia.avaliacao?.comentario).toBe("Demorou, mas resolveram.");
    expect(carregada?.ocorrencia.avaliacao?.avaliadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
  });

  it("sem avaliação, o agregado volta com null — e null é a verdade, não reserva", async () => {
    const id = await resolvida("Sem avaliação ainda");
    const carregada = await portas().ocorrencias.carregar(id);

    expect(carregada?.ocorrencia.avaliacao).toBeNull();
  });

  it("a porta grava as TRÊS colunas e a TRILHA CONTINUA DO MESMO TAMANHO — o critério 27.4 no banco", async () => {
    const id = await resolvida("A gravação");
    const carregada = await portas().ocorrencias.carregar(id);
    // **O relógio é lido UMA vez, e é o mesmo dos dois usos** — como o comando de aplicação faz.
    const agora = new Date().toISOString();
    const avaliado = carregada!.ocorrencia.avaliar({
      autorPessoaId: pessoaId,
      nota: 5,
      comentario: "Resolveram no mesmo dia.",
      avaliadaEm: agora,
    });

    const antes = await consultaCrua<{ n: string }>(
      `select count(*) as n from registros_transicao where ocorrencia_id = $1`,
      [id],
    );

    const resultado = await portas().ocorrencias.avaliar(id, avaliado, agora);

    expect(resultado.desfecho).toBe("avaliada");

    const [linha] = await consultaCrua<{
      avaliacao_nota: number;
      avaliacao_comentario: string | null;
      avaliada_em: Date;
      status: string;
    }>(
      `select avaliacao_nota, avaliacao_comentario, avaliada_em, status
         from ocorrencias where id = $1`,
      [id],
    );

    expect(linha!.avaliacao_nota).toBe(5);
    expect(linha!.avaliacao_comentario).toBe("Resolveram no mesmo dia.");
    expect(linha!.avaliada_em.toISOString()).toBe(agora);
    // **O critério 27.4 no banco: o status NÃO muda.**
    expect(linha!.status).toBe("resolvida");

    const depois = await consultaCrua<{ n: string }>(
      `select count(*) as n from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(depois[0]!.n).toBe(antes[0]!.n);
  });

  it("atualizada_em AVANÇA, e é o carimbo que o chamador leu — nunca now()", async () => {
    const id = await resolvida("O carimbo");
    const [antes] = await consultaCrua<{ atualizada_em: Date }>(
      `select atualizada_em from ocorrencias where id = $1`,
      [id],
    );

    const carregada = await portas().ocorrencias.carregar(id);
    const agora = new Date(Date.now() + 1000).toISOString();
    const avaliado = carregada!.ocorrencia.avaliar({
      autorPessoaId: pessoaId,
      nota: 3,
      comentario: null,
      avaliadaEm: agora,
    });

    await portas().ocorrencias.avaliar(id, avaliado, agora);

    const [depois] = await consultaCrua<{ atualizada_em: Date; avaliada_em: Date }>(
      `select atualizada_em, avaliada_em from ocorrencias where id = $1`,
      [id],
    );
    expect(depois!.atualizada_em.getTime()).toBeGreaterThan(antes!.atualizada_em.getTime());
    // **Os dois recebem o MESMO instante**, e é o que o `CHECK` de ordem temporal exige que não divirja.
    expect(depois!.atualizada_em.toISOString()).toBe(depois!.avaliada_em.toISOString());
  });

  it("A CORRIDA: a SEGUNDA gravação devolve conflito e NÃO sobrescreve a nota — o predicado provado", async () => {
    /**
     * **É o caso que paga o `and avaliacao_nota is null`, e é o único lugar onde ele é observável.** Em
     * memória o agregado já recusa a segunda avaliação — é a guarda 2 de `Ocorrencia.avaliar`. O que este
     * caso exercita é a janela **entre duas requisições**: as duas abas carregam o agregado sem
     * avaliação, as duas atravessam a guarda, e só o banco pode decidir quem chega primeiro.
     *
     * **Sem o predicado, a segunda venceria em silêncio** — `status = 'resolvida'` continua verdadeiro, e
     * o `CHECK` também.
     */
    const id = await resolvida("Duas abas");
    const carregadaA = await portas().ocorrencias.carregar(id);
    const carregadaB = await portas().ocorrencias.carregar(id);

    const primeiro = new Date().toISOString();
    await portas().ocorrencias.avaliar(
      id,
      carregadaA!.ocorrencia.avaliar({
        autorPessoaId: pessoaId,
        nota: 5,
        comentario: "A primeira.",
        avaliadaEm: primeiro,
      }),
      primeiro,
    );

    const segundo = new Date(Date.now() + 2000).toISOString();
    const resultado = await portas().ocorrencias.avaliar(
      id,
      carregadaB!.ocorrencia.avaliar({
        autorPessoaId: pessoaId,
        nota: 1,
        comentario: "A segunda.",
        avaliadaEm: segundo,
      }),
      segundo,
    );

    expect(resultado.desfecho).toBe("conflito");

    const [linha] = await consultaCrua<{ avaliacao_nota: number; avaliacao_comentario: string }>(
      `select avaliacao_nota, avaliacao_comentario from ocorrencias where id = $1`,
      [id],
    );
    expect(linha!.avaliacao_nota).toBe(5);
    expect(linha!.avaliacao_comentario).toBe("A primeira.");
  });

  it("ISOLAMENTO DE ESCRITA: outra organização não carrega e não avalia — critério A4", async () => {
    // O molde é o do item 25 (`:2139`), **copiado e não reinventado**: o repositório escopado na
    // organização B não enxerga a ocorrência de A, então `carregar` devolve `null` e não há agregado para
    // passar à porta. **A garantia é do código, não do banco.**
    //
    // **A metade do COMANDO fica na tarefa 4**, e não aqui: `avaliarOcorrencia` ainda não existe nesta
    // tarefa, e o plano não intercala. O caso *"o GESTOR não autor leva 403, e o SOLICITANTE não autor
    // leva 404"* daquela tarefa é o que exercita a recusa pelo comando.
    const id = await resolvida("Isolamento da avaliação");
    const [outra] = await consultaCrua<{ id: string }>(
      // **`codigo_publico` é `not null` e não tem default** (`001_pessoas_organizacoes_vinculos.sql:119`).
      // Os vinte `insert into organizacoes` do repositório passam o par, e um `insert` só com `nome`
      // estoura com violação de `not null` em vez de falhar na asserção.
      `insert into organizacoes (nome, codigo_publico) values ($1, $2) returning id`,
      // **`V9` e não `V7`**: o `V7` é do bloco do item 17 (`:2427`), e `codigo_publico` tem índice
      // único — repetir o prefixo estoura com `organizacoes_codigo_publico_uk` antes de qualquer
      // asserção. O plano trazia `V7`; é o único desvio deste passo.
      [`Outra org da avaliação ${SUFIXO}`, `V9${SUFIXO}`.slice(0, 12).toUpperCase()],
    );
    // A **mesma** Pessoa nas duas organizações — é o cenário que detecta o vazamento de verdade, e é o
    // que o molde do item 25 faz.
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [pessoaId, outra!.id],
    );

    const deOutra = repositorioEscopadoDeOcorrencias(
      escoparConsulta(criarConsulta(), outra!.id),
      escoparTransacao(criarTransacao(), outra!.id),
    );

    expect(await deOutra.carregar(id)).toBeNull();

    const [linha] = await consultaCrua<{ avaliacao_nota: number | null }>(
      `select avaliacao_nota from ocorrencias where id = $1`,
      [id],
    );
    expect(linha!.avaliacao_nota).toBeNull();
  });

  it("O CICLO COMPLETO: registrar → analisar → atribuir → iniciar → resolver → avaliar, com QUATRO registros", async () => {
    /**
     * **É o caminho crítico inteiro, dentro do produto** — a pré-condição declarada do item **41b**
     * (`backlog.md:1289`) e o que o lote 9 precisa para o `mediaDasAvaliacoes` deixar de ser `null`.
     *
     * **Quatro registros, e não cinco:** `avaliar` não transiciona e não grava trilha. É o critério 27.4
     * contra Postgres, e é a asserção que separa este comando dos seis que transicionam.
     */
    const id = await resolvida("O ciclo completo");

    const lida = await avaliarOcorrencia(
      portas().ocorrencias,
      { pessoaId, permissoes: DO_AUTOR },
      { ocorrenciaId: id, nota: 5, comentario: "Resolveram no mesmo dia e avisaram." },
    );

    expect(lida.status).toBe("resolvida");
    expect(lida.avaliacao?.nota).toBe(5);
    expect(lida.avaliacao?.comentario).toBe("Resolveram no mesmo dia e avisaram.");

    const registros = await consultaCrua<{ n: string }>(
      `select count(*) as n from registros_transicao where ocorrencia_id = $1`,
      [id],
    );
    expect(registros[0]!.n).toBe("4");
  });

  it("o SEGUNDO avaliar responde 409 e a nota NÃO muda — o critério 27.2 ponta a ponta", async () => {
    const id = await resolvida("Duas avaliações pelo comando");
    const ctx = { pessoaId, permissoes: DO_AUTOR };

    await avaliarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id, nota: 5 });

    await expect(
      avaliarOcorrencia(portas().ocorrencias, ctx, { ocorrenciaId: id, nota: 1 }),
    ).rejects.toMatchObject({ codigo: "JA_AVALIADA" });

    const [linha] = await consultaCrua<{ avaliacao_nota: number }>(
      `select avaliacao_nota from ocorrencias where id = $1`,
      [id],
    );
    expect(linha!.avaliacao_nota).toBe(5);
  });

  it("em em_atendimento o comando responde 409 AVALIACAO_EXIGE_RESOLVIDA e as colunas não mudam", async () => {
    // **A transição inválida do item do DoD**, no estado que importa: a ocorrência está viva, e avaliar
    // agora seria dar nota a um trabalho que ainda não acabou.
    const id = await emAtendimentoParaAvaliar("Ainda em atendimento");

    await expect(
      avaliarOcorrencia(
        portas().ocorrencias,
        { pessoaId, permissoes: DO_AUTOR },
        { ocorrenciaId: id, nota: 5 },
      ),
    ).rejects.toMatchObject({ codigo: "AVALIACAO_EXIGE_RESOLVIDA" });

    const [linha] = await consultaCrua<{ avaliacao_nota: number | null; avaliada_em: Date | null }>(
      `select avaliacao_nota, avaliada_em from ocorrencias where id = $1`,
      [id],
    );
    expect(linha!.avaliacao_nota).toBeNull();
    expect(linha!.avaliada_em).toBeNull();
  });

  it("o GESTOR não autor leva 403, e o SOLICITANTE não autor leva 404 — as duas metades da §6.3", async () => {
    /**
     * **É o caso que só a integração prova**, porque ele depende de a ocorrência ter autor de verdade no
     * banco: as duas pessoas existem, as duas têm vínculo, e o que as separa é `ler_todas`.
     */
    const id = await resolvida("Quem pode avaliar");

    await expect(
      avaliarOcorrencia(
        portas().ocorrencias,
        { pessoaId: outraPessoaId, permissoes: DO_GESTOR_NAO_AUTOR },
        { ocorrenciaId: id, nota: 5 },
      ),
    ).rejects.toMatchObject({ codigo: "SOMENTE_O_AUTOR_PODE_AVALIAR" });

    await expect(
      avaliarOcorrencia(
        portas().ocorrencias,
        { pessoaId: outraPessoaId, permissoes: DO_AUTOR },
        { ocorrenciaId: id, nota: 5 },
      ),
    ).rejects.toMatchObject({ codigo: "OCORRENCIA_NAO_ENCONTRADA" });
  });
});

/**
 * ============================================================================
 *  O canal e a mensagem no banco — o que a migração 009 recusa (item 30)
 * ============================================================================
 *
 * **Nenhuma destas garantias tem duplo.** As quatro são do banco: um `CHECK` que vale nos dois sentidos,
 * um índice único **parcial**, um `CHECK` de texto aparado e uma FK **composta** que parte de `vinculos`.
 * Provar qualquer uma delas com um duplo seria provar o duplo.
 */
describe("o canal e a mensagem no banco — o que a migração 009 recusa", () => {
  /** A mesma forma de `ocorrenciaNua()`: a linha crua, sem trilha, porque o que se mede é a 009. */
  async function ocorrenciaParaConversa(titulo: string): Promise<string> {
    const [linha] = await consultaCrua<{ id: string }>(
      `insert into ocorrencias
         (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo, autor_pessoa_id)
       values ($1, $2, 'Descrição de apoio.', $3, $4, 'comum', $5)
       returning id`,
      [organizacaoId, titulo, categoriaId, areaId, pessoaId],
    );
    return linha!.id;
  }

  it("canal `comentario` COM atribuicao_id é recusado, e canal `atribuicao` SEM ele também", async () => {
    const id = await ocorrenciaParaConversa("Canal com atribuição indevida");

    await expect(
      consultaCrua(
        `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo, atribuicao_id)
         values ($1, $2, 'comentario', gen_random_uuid())`,
        [organizacaoId, id],
      ),
    ).rejects.toThrow(/canais_conversa_atribuicao_ck|violates foreign key/u);

    await expect(
      consultaCrua(
        `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo)
         values ($1, $2, 'atribuicao')`,
        [organizacaoId, id],
      ),
    ).rejects.toThrow(/canais_conversa_atribuicao_ck/u);
  });

  it("dois canais `comentario` na mesma ocorrência violam o índice único PARCIAL", async () => {
    const id = await ocorrenciaParaConversa("Dois canais de comentário");

    await consultaCrua(
      `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo) values ($1, $2, 'comentario')`,
      [organizacaoId, id],
    );

    await expect(
      consultaCrua(
        `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo) values ($1, $2, 'comentario')`,
        [organizacaoId, id],
      ),
    ).rejects.toThrow(/canais_conversa_tipo_uk/u);
  });

  it("mensagem só de espaços é recusada pelo CHECK, não só pelo NOT NULL", async () => {
    const id = await ocorrenciaParaConversa("Mensagem em branco");
    const [canal] = await consultaCrua<{ id: string }>(
      `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo)
       values ($1, $2, 'comentario') returning id`,
      [organizacaoId, id],
    );

    await expect(
      consultaCrua(
        `insert into mensagens (organizacao_id, canal_id, autor_pessoa_id, texto)
         values ($1, $2, $3, '   ')`,
        [organizacaoId, canal!.id, pessoaId],
      ),
    ).rejects.toThrow(/mensagens_texto_ck/u);
  });

  it("mensagem de quem NÃO tem vínculo nesta organização é recusada pela FK composta", async () => {
    const id = await ocorrenciaParaConversa("Autora sem vínculo");
    const [canal] = await consultaCrua<{ id: string }>(
      `insert into canais_conversa (organizacao_id, ocorrencia_id, tipo)
       values ($1, $2, 'comentario') returning id`,
      [organizacaoId, id],
    );

    await expect(
      consultaCrua(
        `insert into mensagens (organizacao_id, canal_id, autor_pessoa_id, texto)
         values ($1, $2, gen_random_uuid(), 'olá')`,
        [organizacaoId, canal!.id],
      ),
    ).rejects.toThrow(/mensagens_autor_fk|violates foreign key/u);
  });
});

/**
 * ============================================================================
 *  A conversa contra Postgres — item 30
 * ============================================================================
 *
 * **O que só o Postgres prova aqui:** que o canal nasce **uma** vez e a segunda mensagem o reusa (o
 * `on conflict do nothing` sobre um índice **parcial**); que `atualizada_em` recebe o **mesmo** instante
 * da mensagem, num `COMMIT` só; que a trilha **não** cresce; e que a página em ordem crescente continua
 * de onde o cursor parou.
 */
describe("a conversa contra Postgres — item 30", () => {
  /** Um segundo Gestor nesta organização, para a conversa ter dois lados. */
  let gestorPessoaId: string;

  beforeAll(async () => {
    const [gestor] = await consultaCrua<{ id: string }>(
      `insert into pessoas (nome) values ($1) returning id`,
      [`Roberto ${SUFIXO}`],
    );
    gestorPessoaId = gestor!.id;
    await consultaCrua(
      `insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`,
      [gestorPessoaId, organizacaoId],
    );
  });

  /** A mesma forma de `ocorrenciaNua()`: o que se mede é a conversa, não o registro. */
  async function ocorrenciaParaConversa(titulo: string): Promise<string> {
    const [linha] = await consultaCrua<{ id: string }>(
      `insert into ocorrencias
         (organizacao_id, titulo, descricao, categoria_id, area_id, area_tipo, autor_pessoa_id)
       values ($1, $2, 'Descrição de apoio.', $3, $4, 'comum', $5)
       returning id`,
      [organizacaoId, titulo, categoriaId, areaId, pessoaId],
    );
    return linha!.id;
  }

  it("o canal nasce UMA vez, e a segunda mensagem o reusa", async () => {
    const id = await ocorrenciaParaConversa("Infiltração na garagem");
    const repo = portas().ocorrencias;

    await repo.comentar(id, {
      autorPessoaId: pessoaId,
      texto: "Continua pingando.",
      em: "2026-08-20T15:00:00.000Z",
    });
    await repo.comentar(id, {
      autorPessoaId: gestorPessoaId,
      texto: "Vi sim, o material foi pedido.",
      em: "2026-08-20T15:10:00.000Z",
    });

    const canais = await consultaCrua<{ n: string }>(
      `select count(*)::text as n from canais_conversa where organizacao_id = $1 and ocorrencia_id = $2`,
      [organizacaoId, id],
    );
    expect(canais[0]?.n).toBe("1");

    const lidas = await repo.comentarios(id, { limite: 20, cursor: null });
    expect(lidas.map((m) => m.texto)).toStrictEqual([
      "Continua pingando.",
      "Vi sim, o material foi pedido.",
    ]);
    // O nome sai do `join vinculos → pessoas`, e não de `pessoas` direto.
    expect(lidas[0]?.autor.nome).not.toBe("");
  });

  it("comentar carimba ocorrencias.atualizada_em com o MESMO instante da mensagem", async () => {
    const id = await ocorrenciaParaConversa("Carimbo da atividade");
    const repo = portas().ocorrencias;

    const em = "2026-08-21T09:30:00.000Z";
    const criada = await repo.comentar(id, { autorPessoaId: pessoaId, texto: "oi", em });

    const [linha] = await consultaCrua<{ atualizada_em: Date }>(
      `select atualizada_em from ocorrencias where organizacao_id = $1 and id = $2`,
      [organizacaoId, id],
    );
    expect(linha?.atualizada_em.toISOString()).toBe(em);
    expect(criada.criadoEm).toBe(em);
  });

  it("comentar NÃO acrescenta linha na trilha — a forma dos critérios 19.4 e 25.1", async () => {
    const id = await ocorrenciaParaConversa("Trilha intocada");
    const repo = portas().ocorrencias;

    const contar = async () =>
      (
        await consultaCrua<{ n: string }>(
          `select count(*)::text as n from registros_transicao
            where organizacao_id = $1 and ocorrencia_id = $2`,
          [organizacaoId, id],
        )
      )[0]?.n;

    const antes = await contar();
    await repo.comentar(id, {
      autorPessoaId: pessoaId,
      texto: "nada disto vira transição",
      em: "2026-08-21T10:00:00.000Z",
    });
    expect(await contar()).toBe(antes);
  });

  it("dois comentários idênticos criam DUAS mensagens — critério 30.3, sem chave de idempotência", async () => {
    const id = await ocorrenciaParaConversa("Toque duplo");
    const repo = portas().ocorrencias;

    const dados = {
      autorPessoaId: pessoaId,
      texto: "toque duplo",
      em: "2026-08-21T11:00:00.000Z",
    };
    const primeira = await repo.comentar(id, dados);
    const segunda = await repo.comentar(id, dados);

    expect(primeira.id).not.toBe(segunda.id);
    expect((await repo.comentarios(id, { limite: 20, cursor: null })).length).toBe(2);
  });

  it("a página vem do mais antigo para o mais recente, e o cursor continua de onde parou", async () => {
    const id = await ocorrenciaParaConversa("Página e cursor");
    const repo = portas().ocorrencias;

    for (const minuto of [1, 2, 3]) {
      await repo.comentar(id, {
        autorPessoaId: pessoaId,
        texto: `mensagem ${String(minuto)}`,
        em: `2026-08-22T08:0${String(minuto)}:00.000Z`,
      });
    }

    const primeira = await repo.comentarios(id, { limite: 2, cursor: null });
    expect(primeira.map((m) => m.texto)).toStrictEqual(["mensagem 1", "mensagem 2"]);

    const ultima = primeira[primeira.length - 1];
    const segunda = await repo.comentarios(id, {
      limite: 2,
      cursor: { criadoEm: ultima?.criadoEm ?? "", id: ultima?.id ?? "" },
    });
    expect(segunda.map((m) => m.texto)).toStrictEqual(["mensagem 3"]);
  });

  it("mensagens() traz TODAS, sem limite e sem cursor — a fonte da linha do tempo", async () => {
    const id = await ocorrenciaParaConversa("Fonte da linha do tempo");
    const repo = portas().ocorrencias;

    for (const minuto of [1, 2, 3]) {
      await repo.comentar(id, {
        autorPessoaId: pessoaId,
        texto: `m${String(minuto)}`,
        em: `2026-08-23T08:0${String(minuto)}:00.000Z`,
      });
    }

    expect((await repo.mensagens(id)).map((m) => m.texto)).toStrictEqual(["m1", "m2", "m3"]);
  });
});
