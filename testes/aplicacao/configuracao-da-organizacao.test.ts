import { describe, expect, it } from "vitest";

import {
  AreaNaoEncontrada,
  CategoriaNaoEncontrada,
  NomeDeAreaDuplicado,
  NomeDeCategoriaDuplicado,
  corrigirArea,
  corrigirCategoria,
  corrigirOrganizacao,
  criarArea,
  criarCategoria,
  type AreaAtualizada,
  type AreaLida,
  type CategoriaLida,
  type CorrecaoDeOrganizacao,
  type OrganizacaoLida,
  type RepositorioEscopadoDaOrganizacao,
  type RepositorioEscopadoDeAreas,
  type RepositorioEscopadoDeCategorias,
  type ResultadoDeCorrecaoDeArea,
  type ResultadoDeCorrecaoDeCategoria,
  type ResultadoDeCriacaoDeArea,
  type ResultadoDeCriacaoDeCategoria,
} from "@/aplicacao/organizacao";

/**
 * ============================================================================
 *  Os cinco casos de uso da configuração — itens 4a, 5 e 46 · 47
 * ============================================================================
 *
 * **O que está sob teste é a tradução, e só ela:** desfecho da porta → recusa nomeada do contrato, mais
 * os **dois padrões de produto** que esta camada é dona de aplicar — `icone` ausente vira `tag`, `ordem`
 * ausente vira `0`. As garantias que produzem os desfechos são do banco (`UNIQUE (organizacao_id, nome)`
 * e o `$1` do ponto único), e prová-las contra um duplo provaria que o duplo simula.
 */

const JARDINAGEM: CategoriaLida = {
  id: "categoria-1",
  nome: "Jardinagem",
  icone: "trees",
  ativa: true,
  ordem: 8,
};

const PLAYGROUND: AreaLida = {
  id: "area-1",
  nome: "Playground",
  tipo: "comum",
  ativa: true,
  ordem: 3,
};

function portaDeCategorias(
  criacao: ResultadoDeCriacaoDeCategoria = { desfecho: "criada", categoria: JARDINAGEM },
  correcao: ResultadoDeCorrecaoDeCategoria = { desfecho: "corrigida", categoria: JARDINAGEM },
): { porta: RepositorioEscopadoDeCategorias; recebido: { criar?: unknown; corrigir?: unknown } } {
  const recebido: { criar?: unknown; corrigir?: unknown } = {};
  return {
    recebido,
    porta: {
      listar: () => Promise.resolve([]),
      criar: (nova) => {
        recebido.criar = nova;
        return Promise.resolve(criacao);
      },
      corrigir: (dados) => {
        recebido.corrigir = dados;
        return Promise.resolve(correcao);
      },
    },
  };
}

function portaDeAreas(
  criacao: ResultadoDeCriacaoDeArea = { desfecho: "criada", area: PLAYGROUND },
  correcao: ResultadoDeCorrecaoDeArea = {
    desfecho: "corrigida",
    area: { ...PLAYGROUND, ocorrenciasComTipoAnterior: 0 } satisfies AreaAtualizada,
  },
): { porta: RepositorioEscopadoDeAreas; recebido: { criar?: unknown; corrigir?: unknown } } {
  const recebido: { criar?: unknown; corrigir?: unknown } = {};
  return {
    recebido,
    porta: {
      listar: () => Promise.resolve([]),
      criar: (nova) => {
        recebido.criar = nova;
        return Promise.resolve(criacao);
      },
      corrigir: (dados) => {
        recebido.corrigir = dados;
        return Promise.resolve(correcao);
      },
    },
  };
}

describe("criarCategoria", () => {
  it("grava o padrão `tag` quando o cliente não manda ícone", async () => {
    const { porta, recebido } = portaDeCategorias();

    await criarCategoria(porta, { nome: "Jardinagem", porPessoaId: "pessoa-1" });

    expect(recebido.criar).toStrictEqual({
      nome: "Jardinagem",
      icone: "tag",
      ordem: 0,
      criadaPorPessoaId: "pessoa-1",
    });
  });

  it("respeita o ícone e a ordem quando vêm no comando", async () => {
    const { porta, recebido } = portaDeCategorias();

    await criarCategoria(porta, {
      nome: "Jardinagem",
      icone: "trees",
      ordem: 8,
      porPessoaId: "pessoa-1",
    });

    expect(recebido.criar).toStrictEqual({
      nome: "Jardinagem",
      icone: "trees",
      ordem: 8,
      criadaPorPessoaId: "pessoa-1",
    });
  });

  it("devolve a categoria gravada", async () => {
    const { porta } = portaDeCategorias();
    await expect(criarCategoria(porta, { nome: "Jardinagem", porPessoaId: "p" })).resolves.toStrictEqual(
      JARDINAGEM,
    );
  });

  it("traduz nome duplicado em CATEGORIA_NOME_DUPLICADO", async () => {
    const { porta } = portaDeCategorias({ desfecho: "nome-duplicado" });
    await expect(criarCategoria(porta, { nome: "Vazamentos", porPessoaId: "p" })).rejects.toBeInstanceOf(
      NomeDeCategoriaDuplicado,
    );
  });
});

describe("corrigirCategoria", () => {
  it("leva só os campos presentes, e sempre quem alterou", async () => {
    const { porta, recebido } = portaDeCategorias();

    await corrigirCategoria(porta, {
      categoriaId: "categoria-1",
      ativa: false,
      porPessoaId: "pessoa-1",
    });

    expect(recebido.corrigir).toStrictEqual({
      categoriaId: "categoria-1",
      ativa: false,
      atualizadaPorPessoaId: "pessoa-1",
    });
  });

  it("traduz não encontrada em CATEGORIA_NAO_ENCONTRADA", async () => {
    const { porta } = portaDeCategorias(undefined, { desfecho: "nao-encontrada" });
    await expect(
      corrigirCategoria(porta, { categoriaId: "de-outra", porPessoaId: "p" }),
    ).rejects.toBeInstanceOf(CategoriaNaoEncontrada);
  });

  it("traduz nome duplicado em CATEGORIA_NOME_DUPLICADO", async () => {
    const { porta } = portaDeCategorias(undefined, { desfecho: "nome-duplicado" });
    await expect(
      corrigirCategoria(porta, { categoriaId: "c", nome: "Vazamentos", porPessoaId: "p" }),
    ).rejects.toBeInstanceOf(NomeDeCategoriaDuplicado);
  });
});

describe("criarArea", () => {
  it("leva o tipo e o padrão de ordem", async () => {
    const { porta, recebido } = portaDeAreas();

    await criarArea(porta, { nome: "Playground", tipo: "comum", porPessoaId: "pessoa-1" });

    expect(recebido.criar).toStrictEqual({
      nome: "Playground",
      tipo: "comum",
      ordem: 0,
      criadaPorPessoaId: "pessoa-1",
    });
  });

  it("traduz nome duplicado em AREA_NOME_DUPLICADO", async () => {
    const { porta } = portaDeAreas({ desfecho: "nome-duplicado" });
    await expect(
      criarArea(porta, { nome: "Garagem", tipo: "comum", porPessoaId: "p" }),
    ).rejects.toBeInstanceOf(NomeDeAreaDuplicado);
  });
});

describe("corrigirArea", () => {
  it("devolve a contagem que a frase de T-14 consome", async () => {
    const { porta } = portaDeAreas();

    const area = await corrigirArea(porta, {
      areaId: "area-1",
      tipo: "comum",
      porPessoaId: "pessoa-1",
    });

    expect(area.ocorrenciasComTipoAnterior).toBe(0);
  });

  it("traduz não encontrada em AREA_NAO_ENCONTRADA", async () => {
    const { porta } = portaDeAreas(undefined, { desfecho: "nao-encontrada" });
    await expect(
      corrigirArea(porta, { areaId: "de-outra", porPessoaId: "p" }),
    ).rejects.toBeInstanceOf(AreaNaoEncontrada);
  });
});

const AURORA: OrganizacaoLida = {
  id: "organizacao-1",
  nome: "Residencial Aurora",
  codigoPublico: "AURORA42",
};

/**
 * ============================================================================
 *  O quinto caso de uso da configuração — item 46 · 47
 * ============================================================================
 *
 * **O que está sob teste é a tradução, e ela é o vocabulário:** o comando fala `porPessoaId`, que é
 * `ctx.pessoaId`; a porta fala `atualizadaPorPessoaId`, que é a coluna de auditoria de configuração
 * (modelo §6.5). E o campo ausente **não chega à porta como chave** — quem monta o `update` decide pela
 * ausência da chave, não por `undefined`.
 *
 * **Não há recusa a traduzir, e é por isso que há dois casos e não cinco.** Sem `{id}` no caminho e sem
 * `UNIQUE` sobre `nome`, a porta não tem desfecho de domínio: a organização é a da sessão e ela existe.
 */
describe("corrigirOrganizacao — o nome da organização ativa", () => {
  function porta(): {
    repositorio: RepositorioEscopadoDaOrganizacao;
    recebidas: CorrecaoDeOrganizacao[];
  } {
    const recebidas: CorrecaoDeOrganizacao[] = [];
    return {
      recebidas,
      repositorio: {
        corrigir(correcao) {
          recebidas.push(correcao);
          return Promise.resolve({ ...AURORA, nome: correcao.nome ?? AURORA.nome });
        },
      },
    };
  }

  it("leva o nome e o autor para a porta, e devolve a organização lida", async () => {
    const { repositorio, recebidas } = porta();

    const lida = await corrigirOrganizacao(repositorio, {
      nome: "Residencial Aurora II",
      porPessoaId: "pessoa-1",
    });

    expect(recebidas).toStrictEqual([
      { nome: "Residencial Aurora II", atualizadaPorPessoaId: "pessoa-1" },
    ]);
    expect(lida).toStrictEqual({
      id: "organizacao-1",
      nome: "Residencial Aurora II",
      codigoPublico: "AURORA42",
    });
  });

  it("sem nome no comando, `nome` NÃO chega à porta como chave", async () => {
    const { repositorio, recebidas } = porta();

    await corrigirOrganizacao(repositorio, { porPessoaId: "pessoa-1" });

    expect(recebidas).toStrictEqual([{ atualizadaPorPessoaId: "pessoa-1" }]);
    expect(recebidas[0]).not.toHaveProperty("nome");
  });
});
