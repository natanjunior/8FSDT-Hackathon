import { describe, expect, it } from "vitest";

import {
  AreaNaoEncontrada,
  CategoriaNaoEncontrada,
  ListaDesatualizada,
  NomeDeAreaDuplicado,
  NomeDeCategoriaDuplicado,
  corrigirArea,
  corrigirCategoria,
  corrigirOrganizacao,
  criarArea,
  criarCategoria,
  reordenarAreas,
  reordenarCategorias,
  type AreaAtualizada,
  type AreaLida,
  type CategoriaLida,
  type CorrecaoDeOrganizacao,
  type OrganizacaoLida,
  type RepositorioEscopadoDaOrganizacao,
  type RepositorioEscopadoDeAreas,
  type RepositorioEscopadoDeCategorias,
  type Reordenacao,
  type ResultadoDeCorrecaoDeArea,
  type ResultadoDeCorrecaoDeCategoria,
  type ResultadoDeCriacaoDeArea,
  type ResultadoDeCriacaoDeCategoria,
} from "@/aplicacao/organizacao";

/**
 * ============================================================================
 *  Os sete casos de uso da configuração — itens 4a, 5, 46 · 47 e 50
 * ============================================================================
 *
 * **O que está sob teste é a tradução, e só ela:** desfecho da porta → recusa nomeada do contrato, mais
 * os **dois padrões de produto** que esta camada é dona de aplicar — `icone` ausente vira `tag`, e a
 * posição de quem é criado é sempre a intenção `"no-fim"`, que o repositório resolve no `insert`. As garantias que produzem os
 * desfechos são do banco (`UNIQUE (organizacao_id, nome)` e o `$1` do ponto único), e prová-las contra um
 * duplo provaria que o duplo simula.
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
      reordenar: () => Promise.reject(new Error("este duplo não reordena")),
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
      reordenar: () => Promise.reject(new Error("este duplo não reordena")),
    },
  };
}

describe("criarCategoria", () => {
  it("grava o padrão `tag` e pede o fim da lista quando o cliente não manda ícone", async () => {
    const { porta, recebido } = portaDeCategorias();

    await criarCategoria(porta, { nome: "Jardinagem", porPessoaId: "pessoa-1" });

    expect(recebido.criar).toStrictEqual({
      nome: "Jardinagem",
      icone: "tag",
      ordem: "no-fim",
      criadaPorPessoaId: "pessoa-1",
    });
  });

  it("respeita o ícone quando vem no comando, e a posição continua sendo o fim", async () => {
    const { porta, recebido } = portaDeCategorias();

    await criarCategoria(porta, {
      nome: "Jardinagem",
      icone: "trees",
      porPessoaId: "pessoa-1",
    });

    // **`ordem` saiu do comando com o item 44k:** quem muda posição é `PUT /categorias/ordem`, e quem é
    // criado entra no fim, sempre.
    expect(recebido.criar).toStrictEqual({
      nome: "Jardinagem",
      icone: "trees",
      ordem: "no-fim",
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
      ordem: "no-fim",
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

/**
 * ============================================================================
 *  As duas reordenações — item 50
 * ============================================================================
 *
 * **O que está sob teste é a regra do conjunto, e ela mora na Aplicação** (spec §4.7): a lista pedida tem
 * de ser uma permutação da lista atual, e a posição sai de 1 a n. **A recusa acontece antes de a porta
 * gravar**, e é isso que os casos conferem. O predicado dentro da transação é garantia do banco, e mora no
 * teste de integração.
 */
const ID_A = "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d";
const ID_B = "6b1c8f2e-2222-4a2b-8c3d-4e5f6a7b8c9d";
const ID_C = "6b1c8f2e-3333-4a2b-8c3d-4e5f6a7b8c9d";
const ID_DE_FORA = "6b1c8f2e-9999-4a2b-8c3d-4e5f6a7b8c9d";

/** Empate e lacuna de propósito: é o estado de uma lista que nunca foi reordenada. */
const CATEGORIAS_ATUAIS: readonly CategoriaLida[] = [
  { id: ID_A, nome: "Iluminação", icone: "lightbulb", ativa: true, ordem: 1 },
  { id: ID_B, nome: "Vazamentos", icone: "droplets", ativa: true, ordem: 1 },
  { id: ID_C, nome: "Jardinagem", icone: "trees", ativa: false, ordem: 7 },
];

function portaQueReordena(desfecho: "reordenada" | "lista-desatualizada" = "reordenada"): {
  porta: RepositorioEscopadoDeCategorias;
  listadas: { apenasAtivas: boolean }[];
  gravadas: Reordenacao[];
} {
  const listadas: { apenasAtivas: boolean }[] = [];
  const gravadas: Reordenacao[] = [];
  return {
    listadas,
    gravadas,
    porta: {
      listar: (opcoes) => {
        listadas.push(opcoes);
        return Promise.resolve(CATEGORIAS_ATUAIS);
      },
      criar: () => Promise.reject(new Error("este duplo só reordena")),
      corrigir: () => Promise.reject(new Error("este duplo só reordena")),
      reordenar: (reordenacao) => {
        gravadas.push(reordenacao);
        if (desfecho === "lista-desatualizada") {
          return Promise.resolve({ desfecho: "lista-desatualizada" as const });
        }
        const itens = reordenacao.posicoes.map(({ id, ordem }) => {
          const categoria = CATEGORIAS_ATUAIS.find((c) => c.id === id);
          if (categoria === undefined) throw new Error(`id fora da lista: ${id}`);
          return { ...categoria, ordem };
        });
        return Promise.resolve({ desfecho: "reordenada" as const, itens });
      },
    },
  };
}

describe("reordenarCategorias — a regra do conjunto", () => {
  it("conjunto igual: grava 1 a n na ordem pedida, lê as inativas junto, e devolve a lista da porta", async () => {
    const { porta, listadas, gravadas } = portaQueReordena();

    const itens = await reordenarCategorias(porta, { ids: [ID_C, ID_A, ID_B], porPessoaId: "pessoa-1" });

    expect(listadas).toStrictEqual([{ apenasAtivas: false }]);
    expect(gravadas).toStrictEqual([
      {
        posicoes: [
          { id: ID_C, ordem: 1 },
          { id: ID_A, ordem: 2 },
          { id: ID_B, ordem: 3 },
        ],
        atualizadaPorPessoaId: "pessoa-1",
      },
    ]);
    expect(itens.map((c) => [c.id, c.ordem])).toStrictEqual([
      [ID_C, 1],
      [ID_A, 2],
      [ID_B, 3],
    ]);
  });

  it.each([
    ["faltando um item", [ID_A, ID_B]],
    ["sobrando um item", [ID_A, ID_B, ID_C, ID_DE_FORA]],
    ["com um de fora no lugar de um de dentro", [ID_A, ID_B, ID_DE_FORA]],
    ["com um item repetido", [ID_A, ID_A, ID_B]],
  ])("%s: LISTA_DESATUALIZADA, e a porta não grava", async (_caso, ids) => {
    const { porta, gravadas } = portaQueReordena();

    await expect(reordenarCategorias(porta, { ids, porPessoaId: "pessoa-1" })).rejects.toBeInstanceOf(
      ListaDesatualizada,
    );
    expect(gravadas).toStrictEqual([]);
  });

  it("ids em maiúsculas conferem, e chegam à porta em minúsculas", async () => {
    const { porta, gravadas } = portaQueReordena();

    await reordenarCategorias(porta, {
      ids: [ID_B.toUpperCase(), ID_A, ID_C.toUpperCase()],
      porPessoaId: "pessoa-1",
    });

    expect(gravadas[0]?.posicoes.map((p) => p.id)).toStrictEqual([ID_B, ID_A, ID_C]);
  });

  it("o desfecho lista-desatualizada da porta vira LISTA_DESATUALIZADA", async () => {
    const { porta } = portaQueReordena("lista-desatualizada");

    await expect(
      reordenarCategorias(porta, { ids: [ID_A, ID_B, ID_C], porPessoaId: "pessoa-1" }),
    ).rejects.toBeInstanceOf(ListaDesatualizada);
  });

  it("a recusa carrega o código que o 44k compara e a frase que ele mostra", () => {
    const erro = new ListaDesatualizada();

    expect(erro.codigo).toBe("LISTA_DESATUALIZADA");
    expect(erro.titulo).toBe("Lista desatualizada");
    expect(erro.detalhe).toBe("A lista mudou desde que você a abriu.");
  });
});

describe("reordenarAreas — a mesma regra, na outra lista", () => {
  const AREAS_ATUAIS: readonly AreaLida[] = [
    { id: ID_A, nome: "Garagem", tipo: "comum", ativa: true, ordem: 0 },
    { id: ID_B, nome: "Apartamento 302", tipo: "privativa", ativa: false, ordem: 0 },
  ];

  function porta(): { repositorio: RepositorioEscopadoDeAreas; gravadas: Reordenacao[] } {
    const gravadas: Reordenacao[] = [];
    return {
      gravadas,
      repositorio: {
        listar: () => Promise.resolve(AREAS_ATUAIS),
        criar: () => Promise.reject(new Error("este duplo só reordena")),
        corrigir: () => Promise.reject(new Error("este duplo só reordena")),
        reordenar: (reordenacao) => {
          gravadas.push(reordenacao);
          const itens = reordenacao.posicoes.map(({ id, ordem }) => {
            const area = AREAS_ATUAIS.find((a) => a.id === id);
            if (area === undefined) throw new Error(`id fora da lista: ${id}`);
            return { ...area, ordem };
          });
          return Promise.resolve({ desfecho: "reordenada" as const, itens });
        },
      },
    };
  }

  it("o empate vira 1 a n, na ordem pedida", async () => {
    const { repositorio, gravadas } = porta();

    const itens = await reordenarAreas(repositorio, { ids: [ID_B, ID_A], porPessoaId: "pessoa-1" });

    expect(gravadas[0]?.posicoes).toStrictEqual([
      { id: ID_B, ordem: 1 },
      { id: ID_A, ordem: 2 },
    ]);
    expect(itens.map((a) => a.ordem)).toStrictEqual([1, 2]);
  });

  it("conjunto divergente é LISTA_DESATUALIZADA, e a porta não grava", async () => {
    const { repositorio, gravadas } = porta();

    await expect(
      reordenarAreas(repositorio, { ids: [ID_A], porPessoaId: "pessoa-1" }),
    ).rejects.toBeInstanceOf(ListaDesatualizada);
    expect(gravadas).toStrictEqual([]);
  });
});
