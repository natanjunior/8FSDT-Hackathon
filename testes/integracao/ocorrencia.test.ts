import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import { registrarOcorrencia } from "@/aplicacao/ocorrencia";
import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import { repositorioEscopadoDeOcorrencias } from "@/infraestrutura/repositorios/ocorrencia";
import {
  repositorioEscopadoDeAreas,
  repositorioEscopadoDeCategorias,
} from "@/infraestrutura/repositorios/organizacao";

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
