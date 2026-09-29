import { beforeEach, describe, expect, it } from "vitest";

import {
  listarOcorrencias,
  type FiltroDeContagem,
  type FiltroDeListagem,
  type OcorrenciaResumoLida,
  type RepositorioEscopadoDeOcorrencias,
} from "@/aplicacao/ocorrencia";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — a página de `GET /ocorrencias` (itens 14 e 14b)
 * ============================================================================
 *
 * **O que este arquivo prova, e o repositório não:** que a visibilidade da primeira entrega vira
 * **filtro** — e não checagem depois de ler —, e que a **compensação de deslocamento** do item 14b
 * acontece na Aplicação, sobre números que já estão na mão. As duas são decisões da camada de Aplicação;
 * o SQL que as executa tem teste próprio, contra Postgres, em `testes/integracao/ocorrencia.test.ts`.
 *
 * **Os duplos guardam o filtro recebido.** É o que torna o caso uma prova: se a visibilidade voltasse a
 * ser aplicada *depois* da leitura, `pedidosDeListagem[0].autorPessoaId` ficaria `undefined` e o caso
 * quebraria — em vez de continuar verde porque o resultado, por acaso, tinha só as ocorrências certas.
 */

const ID_PESSOA = "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d";

/** O que cada porta recebeu, em cada chamada — o rastro que torna o caso uma prova. */
let pedidosDeListagem: FiltroDeListagem[];
let pedidosDeContagem: FiltroDeContagem[];
/** O tamanho do conjunto filtrado que o duplo de `contar` declara. */
let totalFiltrado: number;
/** Quantas não abertas o duplo declara **quando a contagem é pedida** (item 88). */
let compartilhadasNaoAbertas: number;
/** O que o repositório devolve, na ordem — o teste corta pelo deslocamento e pelo limite, como o SQL. */
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
    avaliada: false,
    naoAberta: null,
    motivoPausa: null,
    registradaEm: `2026-08-2${n}T13:02:11.000Z`,
    atualizadaEm: `2026-08-2${n}T13:02:11.000Z`,
  };
}

const repositorio = () =>
  ({
    // **O duplo corta pelo deslocamento, como o SQL faz.** Se a Aplicação passar um deslocamento errado,
    // o caso quebra pelo conteúdo da página — e não só pelo número que ela guardou.
    listar: async (filtro: FiltroDeListagem) => {
      pedidosDeListagem.push(filtro);
      return linhas.slice(filtro.deslocamento, filtro.deslocamento + filtro.limite);
    },
    contar: async (filtro: FiltroDeContagem) => {
      pedidosDeContagem.push(filtro);
      return {
        totalFiltrado,
        todas: 9,
        minhas: 2,
        emAberto: 7,
        semResponsavel: 3,
        novas: 5,
        // **O duplo honra o contrato do campo** (item 88): sem `naoAbertasDePessoaId` o SQL não calcula a
        // subconsulta e devolve `0`. Um duplo que devolvesse o número sempre faria o caso de quem tem
        // `ler_todas` passar por acaso.
        compartilhadasNaoAbertas:
          filtro.naoAbertasDePessoaId === undefined ? 0 : compartilhadasNaoAbertas,
      };
    },
  }) as unknown as RepositorioEscopadoDeOcorrencias;

beforeEach(() => {
  pedidosDeListagem = [];
  pedidosDeContagem = [];
  totalFiltrado = 3;
  compartilhadasNaoAbertas = 0;
  linhas = [resumo(1), resumo(2), resumo(3)];
});

describe("a visibilidade da primeira entrega é FILTRO, não checagem", () => {
  it("com ocorrencia.ler_todas: nenhum filtro de autor, e o recorte é todas", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: true,
    });

    expect(pagina.visibilidadeAplicada).toBe("todas");
    expect(pedidosDeListagem[0]?.autorPessoaId).toBeUndefined();
  });

  it("só com ler_propria: o filtro de autor é quem perguntou, e o recorte é apenas_minhas", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: false,
    });

    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
    expect(pedidosDeListagem[0]?.autorPessoaId).toBe(ID_PESSOA);
  });
});

describe("o instante de corte — a primeira página o fixa, as seguintes o repassam", () => {
  it("sem `ate`, o corte é AGORA, e ele volta no envelope", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { agora: "2026-09-09T12:00:00.000Z" },
    );

    expect(pagina.ate).toBe("2026-09-09T12:00:00.000Z");
    expect(pedidosDeListagem[0]?.ate).toBe("2026-09-09T12:00:00.000Z");
    expect(pedidosDeContagem[0]?.ate).toBe("2026-09-09T12:00:00.000Z");
  });

  it("com `ate`, ele desce INTACTO às duas consultas — o corte é um só", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { ate: "2026-09-09T08:00:00.000Z", agora: "2026-09-09T12:00:00.000Z" },
    );

    expect(pagina.ate).toBe("2026-09-09T08:00:00.000Z");
    expect(pedidosDeListagem[0]?.ate).toBe("2026-09-09T08:00:00.000Z");
    expect(pedidosDeContagem[0]?.ate).toBe("2026-09-09T08:00:00.000Z");
  });
});

describe("a compensação de deslocamento — §3.3, e é a razão de a fatia existir", () => {
  it("sem saídas, o deslocamento é o cru: (pagina − 1) × limite", async () => {
    totalFiltrado = 100;
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 3, limite: 20, totalNoCorte: 100, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pedidosDeListagem[0]?.deslocamento).toBe(40);
  });

  it("com 3 saídas na página 2, o deslocamento RECUA 3 — e é isso que impede o pulo", async () => {
    totalFiltrado = 97;
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 2, limite: 20, totalNoCorte: 100, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pagina.saidasDesdeOCorte).toBe(3);
    expect(pedidosDeListagem[0]?.deslocamento).toBe(17);
  });

  it("as saídas se acumulam por profundidade: página 4 com 5 saídas recua para 55", async () => {
    totalFiltrado = 95;
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 4, limite: 20, totalNoCorte: 100, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pedidosDeListagem[0]?.deslocamento).toBe(55);
  });
});

describe("`totalNoCorte` é DICA, não autoridade — nenhum valor produz salto", () => {
  it("absurdamente alto: o deslocamento é limitado em 0, e repete a página 1", async () => {
    totalFiltrado = 100;
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 3, limite: 20, totalNoCorte: 999999, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pedidosDeListagem[0]?.deslocamento).toBe(0);
    expect(pagina.saidasDesdeOCorte).toBe(999899);
  });

  it("menor que o total atual: saídas é 0, e o deslocamento é o cru — nunca negativo", async () => {
    totalFiltrado = 100;
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 2, limite: 20, totalNoCorte: 40, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pagina.saidasDesdeOCorte).toBe(0);
    expect(pedidosDeListagem[0]?.deslocamento).toBe(20);
  });

  it("ausente: saídas é 0 — o caso da primeira página e o do link colado à mão", async () => {
    totalFiltrado = 100;
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 2, limite: 20, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pagina.saidasDesdeOCorte).toBe(0);
    expect(pedidosDeListagem[0]?.deslocamento).toBe(20);
  });
});

describe("o eco de `totalNoCorte` — ele existe para o cliente copiar UM campo", () => {
  it("na primeira página, o eco é o próprio total", async () => {
    totalFiltrado = 137;
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: true,
    });

    expect(pagina.total).toBe(137);
    expect(pagina.totalNoCorte).toBe(137);
  });

  it("nas seguintes, o eco é o RECEBIDO — nunca o recalculado", async () => {
    totalFiltrado = 134;
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 2, limite: 20, totalNoCorte: 137, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pagina.total).toBe(134);
    expect(pagina.totalNoCorte).toBe(137);
  });
});

describe("o painel NÃO obedece a autor=eu — §3.6, e é o que faz `minhas` continuar existindo", () => {
  it("com ler_todas e autor=eu: a PÁGINA recorta por autor, o PAINEL não", async () => {
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { filtro: { apenasDoAutor: true } },
    );

    expect(pedidosDeListagem[0]?.autorPessoaId).toBe(ID_PESSOA);
    expect(pedidosDeContagem[0]?.autorPessoaId).toBeUndefined();
    expect(pedidosDeContagem[0]?.pessoaIdDeQuemPergunta).toBe(ID_PESSOA);
  });

  // **O caso que impede o R-1 de voltar.** Sem ele, o caso acima sozinho *aprova* o defeito: ele afirma
  // que o painel ignora `?autor=eu` — o que é certo para `minhas`, `emAberto` e `semResponsavel` — e
  // ficaria verde com o `total` contando a organização inteira ao lado de uma lista com as próprias.
  it("R-1 · mas o `total` viaja com o recorte da PÁGINA, e não com o do painel", async () => {
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { filtro: { apenasDoAutor: true } },
    );

    expect(pedidosDeContagem[0]?.autorPessoaIdDaPagina).toBe(ID_PESSOA);
    // E sem `?autor=eu` ele não existe — o Gestor conta a organização, que é o que está na tela.
    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true });
    expect(pedidosDeContagem[1]?.autorPessoaIdDaPagina).toBeUndefined();
  });

  it("SEM ler_todas os TRÊS coincidem — e é a coincidência que o 14b.6 fixa", async () => {
    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: false });

    expect(pedidosDeListagem[0]?.autorPessoaId).toBe(ID_PESSOA);
    expect(pedidosDeContagem[0]?.autorPessoaId).toBe(ID_PESSOA);
    expect(pedidosDeContagem[0]?.autorPessoaIdDaPagina).toBe(ID_PESSOA);
  });

  it("o recorte de G2 desce às DUAS — a página inteiro, a contagem só para `novas`", async () => {
    const filtro = { status: ["aberta"] } as const;
    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true }, { filtro });

    expect(pedidosDeListagem[0]?.filtro).toStrictEqual(filtro);
    expect(pedidosDeContagem[0]?.filtro).toStrictEqual(filtro);
  });
});

describe("página além do fim: 200 com lista vazia, e o total VERDADEIRO", () => {
  it("devolve lista vazia sem inventar erro, e o total continua sendo o do conjunto", async () => {
    totalFiltrado = 3;
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { pagina: 9, limite: 20, totalNoCorte: 3, ate: "2026-09-09T08:00:00.000Z" },
    );

    expect(pagina.itens).toStrictEqual([]);
    expect(pagina.total).toBe(3);
    expect(pagina.pagina).toBe(9);
  });
});

describe("as contagens chegam ao envelope, e `novas` sai da porta de contagem", () => {
  it("o painel vem inteiro, e `novasDesdeOCorte` vem de `contar`, não de aritmética", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: true,
    });

    expect(pagina.contagens).toStrictEqual({
      todas: 9,
      minhas: 2,
      emAberto: 7,
      semResponsavel: 3,
      // Quem tem `ler_todas` não recebe compartilhamento: o número não é calculado e vem `0` (item 88).
      compartilhadasNaoAbertas: 0,
    });
    expect(pagina.novasDesdeOCorte).toBe(5);
  });
});

describe("o critério 15.1 — o filtro atravessa a Aplicação sem ser interpretado", () => {
  it("o filtro chega ao repositório exatamente como veio", async () => {
    const filtro = { status: ["pausada"], prioridade: ["alta"] } as const;

    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true }, { filtro });

    expect(pedidosDeListagem[0]).toMatchObject({ filtro });
  });

  it("quem tem ler_todas e pede autor=eu recebe apenas_minhas", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { filtro: { apenasDoAutor: true } },
    );

    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
    expect(pedidosDeListagem[0]).toMatchObject({ autorPessoaId: ID_PESSOA });
  });

  it("quem tem ler_todas e NAO pede autor=eu continua vendo todas", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: true,
    });

    expect(pagina.visibilidadeAplicada).toBe("todas");
    expect(pedidosDeListagem[0]?.autorPessoaId).toBeUndefined();
  });

  it("para quem só tem ler_propria, autor=eu não muda nada — já era apenas_minhas", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: false },
      { filtro: { apenasDoAutor: true } },
    );

    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
    expect(pedidosDeListagem[0]).toMatchObject({ autorPessoaId: ID_PESSOA });
  });

  /**
   * **A aritmética da página não pode morrer no caminho.** A intenção deste caso é a de sempre; o que
   * mudou foi a aritmética que ele vigia. Antes era o `limite + 1` que produzia `temMais`; desde o item
   * 14b é o **limite pedido, sem sobra**, mais o deslocamento — que na página 1 é zero.
   */
  it("com filtro, pede exatamente o limite — e o deslocamento da página 1 é zero", async () => {
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { limite: 2, filtro: { status: ["aberta"] } },
    );

    expect(pedidosDeListagem[0]?.limite).toBe(2);
    expect(pedidosDeListagem[0]?.deslocamento).toBe(0);
  });
});

describe("o critério 67.5 — a ordenação vai para a página, e não para a contagem", () => {
  /**
   * **O que este caso prende:** que `ordenacao` não virou recorte. Se ela entrasse em
   * `FiltroDeOcorrencias`, chegaria também a `contar`, e os quatro números do painel passariam a depender
   * da ordem pedida — que não muda quantas linhas existem.
   */
  it("a ordenação chega à listagem e não à contagem", async () => {
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { ordenacao: { ordem: "titulo", sentido: "decrescente" } },
    );

    expect(pedidosDeListagem[0]?.ordenacao).toStrictEqual({
      ordem: "titulo",
      sentido: "decrescente",
    });
    expect(pedidosDeContagem[0]).not.toHaveProperty("ordenacao");
  });

  it("sem ordenação pedida, a listagem não recebe a chave — ausente é o padrão", async () => {
    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true });

    expect(pedidosDeListagem[0]).not.toHaveProperty("ordenacao");
  });
});

/**
 * ============================================================================
 *  87 · A aba Compartilhadas comigo
 * ============================================================================
 *
 * **Dois riscos, e os dois moram aqui.** O primeiro: a aba tira o filtro de autor da página, e se o filtro
 * de compartilhamento não entrar no lugar, a aba vira *"todas"* para um Solicitante. O segundo: o painel
 * não pode afrouxar — `todas` medindo as compartilhadas faria o número que existe para escolher o recorte
 * deixar de descrever o recorte.
 */
describe("87 · a aba Compartilhadas comigo", () => {
  it("a Solicitante na aba: a página recorta por compartilhamento e NÃO por autor", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: false },
      { filtro: { compartilhadasComigo: true } },
    );

    expect(pedidosDeListagem[0]?.compartilhadaComPessoaId).toBe(ID_PESSOA);
    expect(pedidosDeListagem[0]?.autorPessoaId).toBeUndefined();
    expect(pagina.visibilidadeAplicada).toBe("compartilhadas_comigo");
  });

  it("o painel continua medindo só as próprias da Solicitante (a visibilidade não afrouxa)", async () => {
    await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: false },
      { filtro: { compartilhadasComigo: true } },
    );

    expect(pedidosDeContagem[0]?.autorPessoaId).toBe(ID_PESSOA);
    expect(pedidosDeContagem[0]?.compartilhadaComPessoaIdDaPagina).toBe(ID_PESSOA);
    expect(pedidosDeContagem[0]?.autorPessoaIdDaPagina).toBeUndefined();
  });

  it("sem a aba, nada muda", async () => {
    const pagina = await listarOcorrencias(repositorio(), {
      pessoaId: ID_PESSOA,
      podeLerTodas: false,
    });

    expect(pedidosDeListagem[0]?.compartilhadaComPessoaId).toBeUndefined();
    expect(pedidosDeContagem[0]?.compartilhadaComPessoaIdDaPagina).toBeUndefined();
    expect(pagina.visibilidadeAplicada).toBe("apenas_minhas");
  });

  it("o Gestor na aba também recorta por compartilhamento, e o painel dele continua inteiro", async () => {
    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: true },
      { filtro: { compartilhadasComigo: true } },
    );

    expect(pedidosDeListagem[0]?.compartilhadaComPessoaId).toBe(ID_PESSOA);
    expect(pedidosDeContagem[0]?.autorPessoaId).toBeUndefined();
    expect(pagina.visibilidadeAplicada).toBe("compartilhadas_comigo");
  });
});

/**
 * ============================================================================
 *  88 · o número das não abertas
 * ============================================================================
 *
 * **O que só esta camada prova:** que o número é pedido de quem tem a aba e **não** de quem lê todas, e
 * que ele atravessa a Aplicação sem ser recalculado. A subconsulta que o produz tem teste contra Postgres
 * em `testes/integracao/ocorrencia.test.ts`.
 */
describe("88 · o número das não abertas", () => {
  it("sem ler_todas, a contagem é pedida para quem pergunta — em Minhas também", async () => {
    await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: false });

    expect(pedidosDeContagem[0]?.naoAbertasDePessoaId).toBe(ID_PESSOA);
  });

  it("com ler_todas, a contagem não é pedida e o número vem zero", async () => {
    compartilhadasNaoAbertas = 7;

    const pagina = await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: true });

    expect(pedidosDeContagem[0]?.naoAbertasDePessoaId).toBeUndefined();
    expect(pagina.contagens.compartilhadasNaoAbertas).toBe(0);
  });

  it("o número atravessa sem ser recalculado", async () => {
    compartilhadasNaoAbertas = 3;

    const pagina = await listarOcorrencias(repositorio(), { pessoaId: ID_PESSOA, podeLerTodas: false });

    expect(pagina.contagens.compartilhadasNaoAbertas).toBe(3);
  });

  it("na aba, o número continua sendo pedido — ele não depende do recorte ativo", async () => {
    compartilhadasNaoAbertas = 2;

    const pagina = await listarOcorrencias(
      repositorio(),
      { pessoaId: ID_PESSOA, podeLerTodas: false },
      { filtro: { compartilhadasComigo: true } },
    );

    expect(pedidosDeContagem[0]?.naoAbertasDePessoaId).toBe(ID_PESSOA);
    expect(pagina.contagens.compartilhadasNaoAbertas).toBe(2);
  });
});
