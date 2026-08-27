import { beforeEach, describe, expect, it } from "vitest";

import {
  listarOcorrencias,
  type FiltroDeListagem,
  type OcorrenciaResumoLida,
  type RepositorioEscopadoDeOcorrencias,
} from "@/aplicacao/ocorrencia";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — a página de `GET /ocorrencias` (item 14)
 * ============================================================================
 *
 * **O que este arquivo prova, e o repositório não:** que a visibilidade da primeira entrega vira
 * **filtro** — e não checagem depois de ler —, e que a aritmética da paginação pede uma linha a mais do
 * que devolve. As duas são decisões da camada de Aplicação; o SQL que as executa tem teste próprio, contra
 * Postgres, em `testes/integracao/ocorrencia.test.ts`.
 *
 * **O duplo guarda o filtro recebido.** É o que torna o caso uma prova: se a visibilidade voltasse a ser
 * aplicada *depois* da leitura, `pedidos[0].autorPessoaId` ficaria `undefined` e o caso quebraria — em vez
 * de continuar verde porque o resultado, por acaso, tinha só as ocorrências certas.
 */

const ID_PESSOA = "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d";

/** O filtro que o repositório recebeu, em cada chamada. */
let pedidos: FiltroDeListagem[];
/** O que o repositório devolve, na ordem — o teste corta pelo `limite` pedido, como o SQL faz. */
let linhas: OcorrenciaResumoLida[];

function resumo(n: number): OcorrenciaResumoLida {
  return {
    id: `9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f${n}`,
    titulo: `Ocorrência ${n}`,
    status: "aberta",
    prioridade: "normal",
    categoria: { id: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d", nome: "Problemas de iluminação" },
    area: { id: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e", nome: "Garagem", tipo: "comum" },
    autor: { pessoaId: ID_PESSOA, nome: "Helena Rocha" },
    responsavel: null,
    quantidadeDeAnexos: 0,
    motivoPausa: null,
    registradaEm: `2026-08-2${n}T13:02:11.000Z`,
    atualizadaEm: `2026-08-2${n}T13:02:11.000Z`,
  };
}

const repositorio = () =>
  ({
    listar: async (filtro: FiltroDeListagem) => {
      pedidos.push(filtro);
      return linhas.slice(0, filtro.limite);
    },
  }) as unknown as RepositorioEscopadoDeOcorrencias;

beforeEach(() => {
  pedidos = [];
  linhas = [resumo(1), resumo(2), resumo(3)];
});

describe("a visibilidade da primeira entrega é FILTRO, não checagem", () => {
  it("com ocorrencia.ler_todas: nenhum filtro de autor, e o recorte é 'todas'", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: true,
    });

    expect(pagina.visibilidadeAplicada).toBe("todas");
    expect(pedidos[0]?.autorPessoaId).toBeUndefined();
  });

  it("só com ler_propria: o filtro de autor é quem perguntou, e o recorte é 'apenas_minhas'", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: false,
    });

    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
    expect(pedidos[0]?.autorPessoaId).toBe(ID_PESSOA);
  });
});

describe("a aritmética da página", () => {
  it("pede uma linha a mais do que vai devolver, e a sobra vira temMais", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { limite: 2 },
    );

    expect(pedidos[0]?.limite).toBe(3);
    expect(pagina.itens).toHaveLength(2);
    expect(pagina.temMais).toBe(true);
  });

  it("na última página devolve tudo e temMais é falso", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { limite: 20 },
    );

    expect(pagina.itens).toHaveLength(3);
    expect(pagina.temMais).toBe(false);
  });

  it("sem limite pedido, o padrão é 20 — e o repositório recebe 21", async () => {
    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true });

    expect(pedidos[0]?.limite).toBe(21);
  });

  it("o cursor viaja intacto para o repositório", async () => {
    const cursor = { registradaEm: "2026-08-22T13:02:11.000Z", id: linhas[1]!.id };

    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true }, { cursor });

    expect(pedidos[0]?.cursor).toStrictEqual(cursor);
  });
});

describe("o critério 15.1 — o filtro atravessa a Aplicação sem ser interpretado", () => {
  it("o filtro chega ao repositório exatamente como veio", async () => {
    const filtro = { status: ["pausada"], prioridade: ["alta"] } as const;

    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true }, { filtro });

    expect(pedidos[0]).toMatchObject({ filtro });
  });

  it("quem tem ler_todas e pede autor=eu recebe apenas_minhas", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { filtro: { apenasDoAutor: true } },
    );

    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
    expect(pedidos[0]).toMatchObject({ autorPessoaId: ID_PESSOA });
  });

  it("quem tem ler_todas e NAO pede autor=eu continua vendo todas", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: true,
    });

    expect(pagina.visibilidadeAplicada).toBe("todas");
    expect(pedidos[0]?.autorPessoaId).toBeUndefined();
  });

  it("para quem só tem ler_propria, autor=eu não muda nada — já era apenas_minhas", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: false },
      { filtro: { apenasDoAutor: true } },
    );

    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
    expect(pedidos[0]).toMatchObject({ autorPessoaId: ID_PESSOA });
  });

  /**
   * **A aritmética da página não pode morrer no caminho.** É o caso que pega o erro mais caro desta
   * tarefa: reescrever o corpo de `listarOcorrencias` e perder o `limite + 1` que produz `temMais`.
   */
  it("com filtro, continua pedindo uma linha a mais do que devolve", async () => {
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { limite: 2, filtro: { status: ["aberta"] } },
    );

    expect(pedidos[0]?.limite).toBe(3);
  });
});
