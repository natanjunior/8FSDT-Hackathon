import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import {
  analisarOcorrencia,
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

    // O `update` não acha a ocorrência, o `insert` não acha o vínculo — e é o `where exists` que decide.
    const resultado = await deB.atribuirResponsavel(id, {
      responsavelPessoaId: segundoPessoaId,
      atribuidoPorPessoaId: segundoPessoaId,
      em: EM,
    });

    expect(resultado).toStrictEqual({ desfecho: "responsavel-sem-vinculo-ativo" });
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
});
