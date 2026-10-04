import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";

import { SolucaoObrigatoria } from "@/aplicacao/ocorrencia";
import { ListaDesatualizada } from "@/aplicacao/organizacao";
import { ALFABETO_DO_CODIGO, CATEGORIAS_SEMENTE, ICONE_PADRAO } from "@/dominio/organizacao";
import {
  ERRO_DO_TIPO,
  FRASES_DA_TELA,
  FRASE_DO_INERTE,
  avisoDaMudancaDeTipo,
  erroDoNome as erroDoNomeDaLista,
  fatoDaLista,
  textoDaSituacao,
} from "@/interface/componentes/frases-da-configuracao";
import { DESENHO_DO_ICONE } from "@/interface/componentes/icone-de-categoria";
import { gruposDoCodigo } from "@/interface/componentes/grupos-do-codigo";
import {
  FILTROS,
  cicloDaOrdem,
  contagensDoFiltro,
  estadoDaLista,
  ordemInerte,
  pertenceAoFiltro,
  posicaoNaLista,
  semearOrdem,
  vistaDaLista,
} from "@/interface/componentes/ordem-da-lista";
import {
  ALFABETO_DA_TELA,
  casasDosGrupos,
  erroDoCodigo,
  FRASE_DO_CODIGO_INCOMPLETO,
  limparCodigo,
  PADRAO_DA_DIGITACAO,
} from "@/interface/componentes/regras-do-codigo";
import {
  APOIO_DO_LIMITE,
  MENSAGEM_DA_SOLUCAO_OBRIGATORIA,
  REGRAS_SEM_MUDANCA,
  SEM_MUDANCAS,
  erroDaSolucaoObrigatoria,
  fraseDaMudanca,
  regrasQueMudaram,
  valorEmPalavra,
  APOIO_DOS_DIAS,
  DIAS_FORA_DA_FAIXA,
  ROTULO_DO_CAMPO_DE_DIAS,
  diasValidos,
} from "@/interface/componentes/regras-da-configuracao";
import { erroDoNome, NOME_SEM_MUDANCA } from "@/interface/componentes/regras-do-nome";
import {
  ESTADOS_DO_CICLO,
  NOME_DO_CICLO,
  normalizarRotulos,
  rotulosQueMudaram,
} from "@/interface/componentes/rotulos-do-solicitante";
import { problemaDe } from "@/interface/http";
import { projetarConfiguracao } from "@/interface/projecoes";
import {
  ICONES_DE_CATEGORIA,
  alteracaoDeConfiguracaoSchema,
  correcaoDeAreaSchema,
  correcaoDeCategoriaSchema,
  correcaoDeOrganizacaoSchema,
  criacaoDeAreaSchema,
  criacaoDeCategoriaSchema,
  iconeDeCategoria,
  reordenacaoSchema,
  type EntradaDeCriacaoDeCategoria,
  type NomeDeIcone,
} from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os schemas de configuração (T-09 e T-14, itens 4a e 5)
 * ============================================================================
 *
 * **A lista de 25 nomes mora aqui por decisão declarada** (modelo §14.5): o banco guarda a *forma*
 * (`CHECK (icone ~ '^[a-z0-9-]{1,40}$')`) e a *lista* mora no schema de validação da Interface, porque o
 * cliente não consegue renderizar uma string — já existe obrigatoriamente um mapa nome → componente lá, e
 * a lista no banco seria a terceira cópia.
 *
 * **As duas metades do critério 4b.5 estão aqui, e foram escritas em itens diferentes.** A de dentro é do
 * item 4a: que a lista tem 25 nomes, que as sete sementes estão nela e que o padrão está nela. A de fora
 * — *"todo nome resolve a um componente exportado pelo `lucide-react`"* — é do item **4b**, e entrou junto
 * com a dependência; está no último `describe` deste arquivo.
 */

/**
 * **As duas guardas de tipo da §2.1.1 da spec, e elas são de compilação, não de execução.**
 *
 * **São duas porque `NomeDeIcone` e o que o `enum` aceita não são a mesma coisa.** `NomeDeIcone` sai do
 * `as const` **direto** — `(typeof ICONES_DE_CATEGORIA)[number]["nome"]` —, enquanto o `enum` sai do
 * `.map()`. **O alargamento que a §2.1.1 teme é o do `.map()`, e ele não toca `NomeDeIcone`:** uma guarda
 * só sobre `NomeDeIcone` continuaria compilando com o `enum` já alargado, que é exatamente o silêncio que
 * ela existe para impedir. *(Conferido com `tsc` na revisão de 24/08/2026: com `NOMES_DE_ICONE: string[]`,
 * a primeira guarda passa e só a segunda acusa.)*
 *
 * Nas duas, se a união virar `string` então `"nao-existe" extends …` passa a ser verdadeiro, o tipo vira
 * `never`, e `const … : never = true` **não compila**. `npm run tipos` é o portão.
 *
 * Sem isto, o alargamento não quebraria nada: o `enum` continuaria compilando, aceitaria qualquer string,
 * e o critério 4b.1 passaria a mentir em silêncio.
 */
type UniaoFechada = "nao-existe" extends NomeDeIcone ? never : true;
const uniaoFechada: UniaoFechada = true;

/** A que pega o alargamento de verdade: o que `POST /categorias` aceita **depois** do `.map()`. */
type EnumFechado = "nao-existe" extends NonNullable<EntradaDeCriacaoDeCategoria["icone"]> ? never : true;
const enumFechado: EnumFechado = true;

describe("a lista fechada de ícones", () => {
  it("tem exatamente 25 pares, sem nome repetido", () => {
    expect(ICONES_DE_CATEGORIA).toHaveLength(25);
    expect(new Set(ICONES_DE_CATEGORIA.map((i) => i.nome)).size).toBe(25);
  });

  it("contém o padrão e os sete das categorias-semente", () => {
    const nomes: readonly string[] = ICONES_DE_CATEGORIA.map((i) => i.nome);
    expect(nomes).toContain(ICONE_PADRAO);
    for (const semente of CATEGORIAS_SEMENTE) {
      expect(nomes).toContain(semente.icone);
    }
  });

  it("os sete das sementes são distintos entre si e nenhum é o padrão", () => {
    const dasSementes = CATEGORIAS_SEMENTE.map((c) => c.icone);
    expect(new Set(dasSementes).size).toBe(7);
    expect(dasSementes).not.toContain(ICONE_PADRAO);
  });

  it("todo par tem rótulo em português, não vazio e sem repetição", () => {
    for (const { nome, rotulo } of ICONES_DE_CATEGORIA) {
      expect(rotulo.trim(), `o ícone ${nome} está sem rótulo`).not.toBe("");
    }
    expect(new Set(ICONES_DE_CATEGORIA.map((i) => i.rotulo)).size).toBe(25);
  });

  it("a união dos nomes e a que o enum aceita continuam fechadas — as guardas acima", () => {
    expect(uniaoFechada).toBe(true);
    expect(enumFechado).toBe(true);
  });

  it("o enum recusa nome fora da lista, com a frase da tela", () => {
    const recusa = iconeDeCategoria.safeParse("nao-existe");
    expect(recusa.success).toBe(false);
    if (!recusa.success) expect(recusa.error.issues[0]?.message).toBe("Escolha um ícone da lista.");
  });
});

describe("criacaoDeCategoriaSchema", () => {
  it("aceita só o nome, e não inventa ícone nem ordem", () => {
    const conferido = criacaoDeCategoriaSchema.parse({ nome: "  Jardinagem  " });
    expect(conferido).toStrictEqual({ nome: "Jardinagem" });
  });

  it("recusa nome vazio e nome acima de 60", () => {
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "   " }).success).toBe(false);
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "x".repeat(61) }).success).toBe(false);
  });

  it("recusa ícone fora da lista fechada", () => {
    const recusado = criacaoDeCategoriaSchema.safeParse({ nome: "Jardinagem", icone: "arvore" });
    expect(recusado.success).toBe(false);
    expect(recusado.error?.issues[0]?.path).toStrictEqual(["icone"]);
  });

  /**
   * **`ordem` saiu dos quatro corpos com o item 44k**, e os schemas são `z.object` sem `strict`: um corpo
   * que ainda a traga **não** é recusado — o campo é descartado. É o que se quer, porque um `PATCH` com
   * ordem própria criaria empate e lacuna na lista que o `PUT` acabou de deixar de 1 a n.
   */
  it("descarta `ordem` no corpo, nas quatro escritas", () => {
    expect(criacaoDeCategoriaSchema.parse({ nome: "A", ordem: 8 })).toStrictEqual({ nome: "A" });
    expect(correcaoDeCategoriaSchema.parse({ nome: "A", ordem: 8 })).toStrictEqual({ nome: "A" });
    expect(criacaoDeAreaSchema.parse({ nome: "A", tipo: "comum", ordem: 8 })).toStrictEqual({
      nome: "A",
      tipo: "comum",
    });
    expect(correcaoDeAreaSchema.parse({ tipo: "comum", ordem: 8 })).toStrictEqual({ tipo: "comum" });
  });
});

describe("correcaoDeCategoriaSchema", () => {
  it("aceita um campo só, e mantém a ausência dos outros", () => {
    expect(correcaoDeCategoriaSchema.parse({ ativa: false })).toStrictEqual({ ativa: false });
  });

  it("aceita corpo vazio — o mínimo de um campo é da rota, não do schema", () => {
    expect(correcaoDeCategoriaSchema.parse({})).toStrictEqual({});
  });
});

describe("criacaoDeAreaSchema", () => {
  it("exige tipo, porque um padrão implícito escolheria a visibilidade em silêncio (D10)", () => {
    expect(criacaoDeAreaSchema.safeParse({ nome: "Playground" }).success).toBe(false);
    expect(criacaoDeAreaSchema.parse({ nome: "Playground", tipo: "comum" })).toStrictEqual({
      nome: "Playground",
      tipo: "comum",
    });
  });

  it("recusa tipo fora dos dois, e nome acima de 80", () => {
    expect(criacaoDeAreaSchema.safeParse({ nome: "A", tipo: "coletiva" }).success).toBe(false);
    expect(criacaoDeAreaSchema.safeParse({ nome: "x".repeat(81), tipo: "comum" }).success).toBe(false);
  });
});

describe("correcaoDeAreaSchema", () => {
  it("aceita mudar só o tipo", () => {
    expect(correcaoDeAreaSchema.parse({ tipo: "privativa" })).toStrictEqual({ tipo: "privativa" });
  });
});

/**
 * ============================================================================
 *  Critério 4b.5 · a metade externa — os 25 nomes contra o `lucide-react`
 * ============================================================================
 *
 * **A garantia mecânica que substitui o `CHECK` de lista que o banco não tem** (modelo §14.5). Nome errado
 * na constante quebra a esteira, em vez de produzir categoria sem ícone em silêncio.
 *
 * **O `import * as` é legítimo aqui e proibido no componente:** este arquivo roda em Node e não é
 * empacotado. No código de aplicação o *namespace* levaria os mais de mil ícones para o pacote entregue ao
 * celular, que é a rede do RNF6 — por isso o mapa de `icone-de-categoria.tsx` usa 25 importações nomeadas.
 */
function emPascal(nome: string): string {
  return nome
    .split("-")
    .map((pedaco) => pedaco.charAt(0).toUpperCase() + pedaco.slice(1))
    .join("");
}

describe("os 25 nomes resolvem a componentes do lucide-react", () => {
  it.each([...ICONES_DE_CATEGORIA])("$nome → $rotulo", ({ nome }) => {
    const exportado = (lucide as unknown as Record<string, unknown>)[emPascal(nome)];

    expect(exportado, `lucide-react não exporta ${emPascal(nome)}`).toBeDefined();
    // Ícone do lucide é componente criado por `createLucideIcon` — função ou objeto de `forwardRef`.
    expect(["function", "object"]).toContain(typeof exportado);
  });

  it("o mapa do componente cobre a lista inteira", () => {
    for (const { nome } of ICONES_DE_CATEGORIA) {
      expect(DESENHO_DO_ICONE[nome], `o mapa não tem entrada para ${nome}`).toBeDefined();
    }
    expect(Object.keys(DESENHO_DO_ICONE)).toHaveLength(25);
  });
});

/**
 * **O corpo de `PATCH /organizacoes` — item 46 · 47.**
 *
 * **O corpo vazio passa aqui e é recusado na rota**, e a divisão é a mesma de `PATCH /areas/{id}`: o
 * schema diz o que **cada campo** aceita; *"informe ao menos um campo"* é regra do endpoint, não da
 * forma do campo. Provar aqui que `{}` passa é provar onde a recusa mora.
 */
describe("correcaoDeOrganizacaoSchema — o corpo de PATCH /organizacoes", () => {
  it("apara o espaço em volta do nome", () => {
    const saida = correcaoDeOrganizacaoSchema.parse({ nome: "  Residencial Aurora  " });
    expect(saida.nome).toBe("Residencial Aurora");
  });

  it("recusa nome que é só espaço", () => {
    expect(correcaoDeOrganizacaoSchema.safeParse({ nome: "   " }).success).toBe(false);
  });

  it("recusa nome com 121 caracteres, e aceita com 120", () => {
    expect(correcaoDeOrganizacaoSchema.safeParse({ nome: "a".repeat(121) }).success).toBe(false);
    expect(correcaoDeOrganizacaoSchema.safeParse({ nome: "a".repeat(120) }).success).toBe(true);
  });

  it("aceita o corpo vazio — a recusa de `nada para alterar` é da rota, não da forma", () => {
    const saida = correcaoDeOrganizacaoSchema.parse({});
    expect(saida.nome).toBeUndefined();
  });

  it("descarta `codigoPublico` no corpo em vez de recusar, como o criacaoDeOrganizacaoSchema", () => {
    const saida = correcaoDeOrganizacaoSchema.parse({ nome: "Aurora", codigoPublico: "ESCOLHIDO" });
    expect(saida).toStrictEqual({ nome: "Aurora" });
  });
});

/**
 * ============================================================================
 *  O corpo de `PUT /categorias/ordem` e `PUT /areas/ordem` — item 50
 * ============================================================================
 *
 * **Forma, e só forma** (spec §4.1): o conjunto que diverge do atual é `409`, da Aplicação. Aqui mora o
 * que recarregar não conserta: lista vazia, acima do teto, elemento que não é UUID, e id repetido.
 */
describe("reordenacaoSchema — a lista inteira, de uma vez", () => {
  const A = "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d";
  const B = "6b1c8f2e-2222-4a2b-8c3d-4e5f6a7b8c9d";
  const listaDe = (tamanho: number): string[] =>
    Array.from({ length: tamanho }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

  it("aceita a lista e a devolve na mesma ordem", () => {
    expect(reordenacaoSchema.parse({ ids: [B, A] })).toStrictEqual({ ids: [B, A] });
  });

  it("devolve os identificadores em minúsculas (spec §4.9)", () => {
    expect(reordenacaoSchema.parse({ ids: [A.toUpperCase(), B] })).toStrictEqual({ ids: [A, B] });
  });

  it("recusa corpo sem ids, ids que não é lista, e lista vazia", () => {
    expect(reordenacaoSchema.safeParse({}).success).toBe(false);
    expect(reordenacaoSchema.safeParse({ ids: A }).success).toBe(false);
    expect(reordenacaoSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it("aceita 999 itens e recusa 1.000 (spec §4.5)", () => {
    expect(reordenacaoSchema.safeParse({ ids: listaDe(999) }).success).toBe(true);
    expect(reordenacaoSchema.safeParse({ ids: listaDe(1000) }).success).toBe(false);
  });

  it("recusa elemento que não é UUID", () => {
    expect(reordenacaoSchema.safeParse({ ids: [A, "ordem"] }).success).toBe(false);
  });

  it("recusa id repetido, inclusive na outra caixa, e a recusa aponta o campo ids", () => {
    expect(reordenacaoSchema.safeParse({ ids: [A, A] }).success).toBe(false);

    const outraCaixa = reordenacaoSchema.safeParse({ ids: [A, A.toUpperCase()] });
    expect(outraCaixa.success).toBe(false);
    if (outraCaixa.success) return;
    expect(outraCaixa.error.issues.map((violacao) => violacao.path.join("."))).toStrictEqual(["ids"]);
  });

  it("LISTA_DESATUALIZADA vira 409, com o detail que a tela mostra", () => {
    const { status, corpo } = problemaDe(
      new ListaDesatualizada(),
      "/api/categorias/ordem",
      "01JB8Z6K9T2M4N7Q",
    );

    expect(status).toBe(409);
    expect(corpo).toMatchObject({
      type: "https://resolveai.app/erros/lista-desatualizada",
      title: "Lista desatualizada",
      detail: "A lista mudou desde que você a abriu.",
      codigo: "LISTA_DESATUALIZADA",
    });
    // Sem extensão: o cliente recarrega pelo `GET` (spec §4.1).
    expect("erros" in corpo).toBe(false);
  });
});

/**
 * ============================================================================
 *  T-15 · o código em grupos e o erro do nome — item 44i
 * ============================================================================
 *
 * **Funções puras**, porque o projeto não tem biblioteca de teste de componente: o componente só as
 * desenha. Os grupos contam a partir do começo, e unidos devolvem o código.
 */
describe("gruposDoCodigo — o código do cartaz em grupos de quatro (critério 44i.3)", () => {
  it.each([
    ["K7RQ4MZP", ["K7RQ", "4MZP"]],
    ["K7RQ4M", ["K7RQ", "4M"]],
    ["K7RQ4MZPAB", ["K7RQ", "4MZP", "AB"]],
    ["K7RQ4MZPAB23", ["K7RQ", "4MZP", "AB23"]],
  ])("%s vira %j", (codigo, grupos) => {
    expect(gruposDoCodigo(codigo)).toStrictEqual(grupos);
  });

  it("os grupos unidos devolvem o código, e nenhum grupo é vazio nem passa de quatro", () => {
    for (const codigo of ["K7RQ4M", "K7RQ4MZ", "K7RQ4MZP", "K7RQ4MZPA", "K7RQ4MZPAB23"]) {
      const grupos = gruposDoCodigo(codigo);
      expect(grupos.join("")).toBe(codigo);
      expect(grupos.every((grupo) => grupo.length > 0 && grupo.length <= 4)).toBe(true);
    }
    expect(gruposDoCodigo("")).toStrictEqual([]);
  });
});

describe("regras-do-codigo — o campo de oito casas (critério 65.2)", () => {
  it("o alfabeto da tela é o do sorteio, letra por letra", () => {
    // A tela não importa o do Domínio porque aquele arquivo importa `node:crypto`, e o campo é de cliente.
    // Este caso é o que impede os dois de divergirem.
    expect(ALFABETO_DA_TELA).toBe(ALFABETO_DO_CODIGO);
  });

  it("minúscula vira maiúscula", () => {
    expect(limparCodigo("k7rq4mzp")).toBe("K7RQ4MZP");
  });

  it("I, O, 0, 1 e símbolos saem", () => {
    expect(limparCodigo("IO01K7-RQ#")).toBe("K7RQ");
  });

  it("a colagem com espaço, hífen e quebra de linha vira o código", () => {
    expect(limparCodigo(" k7rq 4mzp\n")).toBe("K7RQ4MZP");
    expect(limparCodigo("K7RQ-4MZP")).toBe("K7RQ4MZP");
  });

  it("corta em oito", () => {
    expect(limparCodigo("K7RQ4MZPAB")).toBe("K7RQ4MZP");
  });

  it("a digitação aceita o alfabeto e as minúsculas dele, e nada mais", () => {
    const padrao = new RegExp(PADRAO_DA_DIGITACAO, "u");
    for (const letra of ALFABETO_DA_TELA) {
      expect(padrao.test(letra), letra).toBe(true);
      expect(padrao.test(letra.toLowerCase()), letra.toLowerCase()).toBe(true);
    }
    for (const fora of ["I", "O", "0", "1", "i", "o", "-", " ", "Ç"]) {
      expect(padrao.test(fora), fora).toBe(false);
    }
    // O `input-otp` confere o valor inteiro a cada tecla, e o valor mistura o que já virou maiúscula.
    expect(padrao.test("K7Rq")).toBe(true);
  });

  it.each([
    ["K7RQ4MZ", FRASE_DO_CODIGO_INCOMPLETO],
    ["K7RQ4MZP", undefined],
    ["K7RQ4MZPA", FRASE_DO_CODIGO_INCOMPLETO],
    ["K7RQ4MZ0", FRASE_DO_CODIGO_INCOMPLETO],
    ["", FRASE_DO_CODIGO_INCOMPLETO],
  ])("erroDoCodigo(%j) é %j", (codigo, esperado) => {
    expect(erroDoCodigo(codigo)).toBe(esperado);
  });

  it.each([
    [8, [[0, 1, 2, 3], [4, 5, 6, 7]]],
    [6, [[0, 1, 2, 3], [4, 5]]],
    [12, [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]]],
  ])("casasDosGrupos(%i) segue a regra de gruposDoCodigo", (comprimento, esperado) => {
    expect(casasDosGrupos(comprimento)).toStrictEqual(esperado);
    // A mesma divisão que o texto do código usa, para as duas formas nunca discordarem.
    const codigo = "K7RQ4MZPAB23".slice(0, comprimento);
    expect(casasDosGrupos(comprimento).map((grupo) => grupo.length)).toStrictEqual(
      gruposDoCodigo(codigo).map((grupo) => grupo.length),
    );
  });
});

describe("erroDoNome — o campo do modal Editar organização (critérios 44i.2 e 44i.8)", () => {
  const ATUAL = "Condomínio Recanto Azul";

  it("vazio e só espaços pedem o nome, com a frase do schema da rota", () => {
    expect(erroDoNome("organizacao", "", ATUAL)).toBe("Informe o nome da organização.");
    expect(erroDoNome("organizacao", "   ", ATUAL)).toBe("Informe o nome da organização.");
  });

  it("igual ao atual, mesmo com espaços em volta, pede para alterar", () => {
    expect(erroDoNome("organizacao", ATUAL, ATUAL)).toBe(NOME_SEM_MUDANCA);
    expect(erroDoNome("organizacao", `  ${ATUAL}  `, ATUAL)).toBe("Altere o nome antes de salvar.");
  });

  it("acima de 120 depois de aparado é a frase do schema; 120 com espaços em volta passa", () => {
    expect(erroDoNome("organizacao", "a".repeat(121), ATUAL)).toBe("O nome cabe em 120 caracteres.");
    expect(erroDoNome("organizacao", ` ${"a".repeat(120)} `, ATUAL)).toBeUndefined();
  });

  it("outro nome não tem erro", () => {
    expect(erroDoNome("organizacao", "Condomínio Residencial Recanto Azul", ATUAL)).toBeUndefined();
  });
});

/**
 * ============================================================================
 *  As regras das listas de ordem manual — T-09 e T-14, item 44k
 * ============================================================================
 *
 * **Nenhum arquivo de teste novo**: este já é o arquivo destas duas telas. O que se prova aqui é a
 * decisão inteira delas — o filtro, as contagens, a busca, qual vazio, a posição e o ciclo da ordem
 * gravada —, porque o projeto não tem biblioteca de teste de componente (ADR-0008) e o arrastar depende
 * da leitura humana.
 */
describe("ordem-da-lista — as regras das listas de ordem manual (item 44k)", () => {
  const ILUMINACAO = { id: "a", nome: "Iluminação", ativa: true };
  const VAZAMENTO = { id: "b", nome: "Vazamento de água", ativa: true };
  const PORTAO = { id: "c", nome: "Portão", ativa: false };
  const ARVORE = { id: "d", nome: "Árvore caída", ativa: true };
  const LISTA = [ILUMINACAO, VAZAMENTO, PORTAO, ARVORE];

  it("as contagens são do conjunto inteiro, e a busca não as muda", () => {
    expect(contagensDoFiltro(LISTA)).toEqual({ todas: 4, ativas: 3, inativas: 1 });
    // "o contador não mente": a vista é que encolhe.
    expect(vistaDaLista(LISTA, "todas", "port")).toHaveLength(1);
    expect(contagensDoFiltro(LISTA)).toEqual({ todas: 4, ativas: 3, inativas: 1 });
  });

  it("pertenceAoFiltro separa as três abas", () => {
    expect(LISTA.filter((item) => pertenceAoFiltro(item, "todas"))).toHaveLength(4);
    expect(LISTA.filter((item) => pertenceAoFiltro(item, "ativas"))).toHaveLength(3);
    expect(LISTA.filter((item) => pertenceAoFiltro(item, "inativas"))).toHaveLength(1);
    expect(FILTROS).toEqual(["todas", "ativas", "inativas"]);
  });

  it("a busca é a de T-08, reusada: prefixo de palavra, sem acento e sem caixa", () => {
    expect(vistaDaLista(LISTA, "todas", "arvore").map((item) => item.id)).toEqual(["d"]);
    expect(vistaDaLista(LISTA, "todas", "AGUA").map((item) => item.id)).toEqual(["b"]);
    expect(vistaDaLista(LISTA, "todas", "   ")).toHaveLength(4);
  });

  it("a ordem só é viva com Todas e busca vazia", () => {
    expect(ordemInerte("todas", "")).toBe(false);
    expect(ordemInerte("todas", "  ")).toBe(false);
    expect(ordemInerte("ativas", "")).toBe(true);
    expect(ordemInerte("todas", "porta")).toBe(true);
    expect(ordemInerte("inativas", "porta")).toBe(true);
  });

  it("estadoDaLista nas quatro saídas, e a busca ganha do filtro", () => {
    expect(estadoDaLista({ total: 0, noFiltro: 0, encontradas: 0, busca: "" })).toBe("lista-vazia");
    expect(estadoDaLista({ total: 4, noFiltro: 3, encontradas: 3, busca: "" })).toBe("lista");
    expect(estadoDaLista({ total: 4, noFiltro: 0, encontradas: 0, busca: "" })).toBe("vazio-do-filtro");
    expect(estadoDaLista({ total: 4, noFiltro: 3, encontradas: 0, busca: "xyz" })).toBe("busca-vazia");
    // Filtro vazio E busca com texto: vence a busca, que foi o último gesto.
    expect(estadoDaLista({ total: 4, noFiltro: 0, encontradas: 0, busca: "xyz" })).toBe("busca-vazia");
  });

  it("a posição é sempre a da lista inteira, mesmo com filtro aplicado", () => {
    const soAtivas = vistaDaLista(LISTA, "ativas", "");
    expect(soAtivas.map((item) => posicaoNaLista(LISTA, item.id))).toEqual([1, 2, 4]);
    expect(posicaoNaLista(LISTA, "c")).toBe(3);
  });

  describe("o ciclo da ordem gravada", () => {
    const semear = () => semearOrdem(LISTA);

    it("semeou zera a escrita em voo e sobe a geração", () => {
      const depois = cicloDaOrdem({ ...semear(), enviados: ["a"] }, { tipo: "semeou", itens: LISTA });
      expect(depois.estado.enviados).toBeNull();
      expect(depois.estado.geracao).toBe(1);
      expect(depois.efeitos).toEqual([]);
    });

    it("moveu sem escrita em voo anda a lista, anuncia e grava", () => {
      const passo = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      expect(passo.estado.naTela.map((item) => item.id)).toEqual(["b", "c", "a", "d"]);
      expect(passo.estado.confirmada.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
      expect(passo.efeitos).toEqual([
        { tipo: "anunciar", texto: "Movido para a posição 3 de 4." },
        { tipo: "gravar", ids: ["b", "c", "a", "d"], geracao: 0 },
      ]);
    });

    it("moveu duas vezes com escrita em voo anda de novo e grava uma vez só", () => {
      const primeiro = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      const segundo = cicloDaOrdem(primeiro.estado, { tipo: "moveu", de: 3, para: 0 });
      expect(segundo.estado.naTela.map((item) => item.id)).toEqual(["d", "b", "c", "a"]);
      expect(segundo.efeitos.filter((efeito) => efeito.tipo === "gravar")).toEqual([]);
      // O que está em voo continua sendo a lista da primeira escrita.
      expect(segundo.estado.enviados).toEqual(["b", "c", "a", "d"]);
    });

    it("respondeu-ok com a ordem enviada encerra a escrita, sem efeito", () => {
      const movido = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      const resposta = [VAZAMENTO, PORTAO, ILUMINACAO, ARVORE];
      const passo = cicloDaOrdem(movido.estado, { tipo: "respondeu-ok", geracao: 0, itens: resposta });
      expect(passo.estado.enviados).toBeNull();
      expect(passo.estado.naTela).toEqual(resposta);
      expect(passo.estado.confirmada).toEqual(resposta);
      expect(passo.efeitos).toEqual([]);
    });

    it("respondeu-ok com ordem diferente dispara a escrita seguinte, com os ids de agora", () => {
      const primeiro = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      const segundo = cicloDaOrdem(primeiro.estado, { tipo: "moveu", de: 3, para: 0 });
      const resposta = [VAZAMENTO, PORTAO, ILUMINACAO, ARVORE];
      const passo = cicloDaOrdem(segundo.estado, { tipo: "respondeu-ok", geracao: 0, itens: resposta });
      expect(passo.estado.naTela.map((item) => item.id)).toEqual(["d", "b", "c", "a"]);
      expect(passo.efeitos).toEqual([{ tipo: "gravar", ids: ["d", "b", "c", "a"], geracao: 0 }]);
    });

    it("respondeu-erro devolve a lista confirmada e avisa, sem recarregar", () => {
      const movido = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      const passo = cicloDaOrdem(movido.estado, {
        tipo: "respondeu-erro",
        geracao: 0,
        aviso: "Não deu",
        desatualizada: false,
      });
      expect(passo.estado.naTela).toEqual(LISTA);
      expect(passo.estado.enviados).toBeNull();
      expect(passo.efeitos).toEqual([{ tipo: "avisar-erro", aviso: "Não deu" }]);
    });

    it("LISTA_DESATUALIZADA avisa e recarrega a página", () => {
      const movido = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      const passo = cicloDaOrdem(movido.estado, {
        tipo: "respondeu-erro",
        geracao: 0,
        aviso: "A lista mudou desde que você a abriu.",
        desatualizada: true,
      });
      expect(passo.efeitos).toEqual([
        { tipo: "avisar-erro", aviso: "A lista mudou desde que você a abriu." },
        { tipo: "recarregar" },
      ]);
    });

    it("resposta de geração velha não muda nada", () => {
      const movido = cicloDaOrdem(semear(), { tipo: "moveu", de: 0, para: 2 });
      const semeado = cicloDaOrdem(movido.estado, { tipo: "semeou", itens: LISTA });
      const velha = cicloDaOrdem(semeado.estado, { tipo: "respondeu-ok", geracao: 0, itens: [] });
      expect(velha.estado).toBe(semeado.estado);
      expect(velha.efeitos).toEqual([]);

      const velhaComErro = cicloDaOrdem(semeado.estado, {
        tipo: "respondeu-erro",
        geracao: 0,
        aviso: "x",
        desatualizada: true,
      });
      expect(velhaComErro.efeitos).toEqual([]);
    });
  });
});

describe("frases-da-configuracao — o texto das duas telas (item 44k)", () => {
  it("avisoDaMudancaDeTipo: zero é sucesso, e a atenção só aparece com contagem", () => {
    expect(avisoDaMudancaDeTipo("Garagem", "privativa", 0)).toEqual({
      titulo: "Garagem passou a ser Unidade privativa.",
    });
    expect(avisoDaMudancaDeTipo("Garagem", "comum", 1)).toEqual({
      forma: "atencao",
      titulo: "Garagem passou a ser Área comum",
      descricao: "1 ocorrência já registrada mantém o tipo anterior. O passado não muda.",
    });
    expect(avisoDaMudancaDeTipo("Garagem", "comum", 3).descricao).toBe(
      "3 ocorrências já registradas mantêm o tipo anterior. O passado não muda.",
    );
    // O plural é escrito, nunca montado com "(s)".
    expect(avisoDaMudancaDeTipo("Garagem", "comum", 3).descricao).not.toContain("(s)");
  });

  it("textoDaSituacao: desativar é destrutivo e explica que não apaga; reativar é curto", () => {
    const desativar = textoDaSituacao("categorias", "Iluminação", true, false);
    expect(desativar.titulo).toBe("Desativar Iluminação?");
    expect(desativar.corpo).toContain("continuam com esta categoria");
    expect(desativar.corpo).toContain("reativá-la");
    expect(desativar.confirmar).toBe("Desativar");
    expect(desativar.destrutiva).toBe(true);
    expect(desativar.aviso).toBeNull();

    const reativar = textoDaSituacao("areas", "Garagem", false, false);
    expect(reativar.titulo).toBe("Reativar Garagem?");
    expect(reativar.corpo).toBe("Ela volta a aparecer no formulário de registro.");
    expect(reativar.destrutiva).toBe(false);
  });

  it("a última ativa traz a frase que o inventário obriga e troca o botão", () => {
    const ultima = textoDaSituacao("areas", "Garagem", true, true);
    expect(ultima.aviso).toBe("Sem nenhuma área ativa, ninguém consegue registrar ocorrência.");
    expect(ultima.confirmar).toBe("Desativar mesmo assim");
  });

  it("fatoDaLista escreve a contagem e o que cada lista é", () => {
    expect(fatoDaLista("categorias", 7, 8)).toBe(
      "7 ativas de 8. Sete foram criadas junto com a organização.",
    );
    // Áreas: o que a lista é, primeiro, e a contagem no fim (item 64, validação de 23/09/2026).
    expect(fatoDaLista("areas", 2, 2)).toBe(
      "As áreas da organização. Aparecem no registro de ocorrência e podem estar associadas a participantes. 2 ativas de 2.",
    );
    // A organização pode ser empresa ou bairro (decisão de produto D3).
    expect(fatoDaLista("areas", 2, 2)).not.toContain("condomínio");
  });

  it("o erro do nome diz o que fazer, com o substantivo certo", () => {
    expect(erroDoNomeDaLista("categorias", "")).toBe("Dê um nome à categoria.");
    expect(erroDoNomeDaLista("areas", "   ")).toBe("Dê um nome à área.");
    expect(erroDoNomeDaLista("areas", "Garagem")).toBeUndefined();
    expect(ERRO_DO_TIPO).toBe("Escolha o tipo da área.");
  });

  it("a frase do inerte manda voltar para Todas e limpar a busca", () => {
    expect(FRASE_DO_INERTE).toContain("Todas");
    expect(FRASE_DO_INERTE).toContain("busca");
  });

  it("as telas conhecem quatro códigos, e LISTA_DESATUALIZADA não é um deles", () => {
    expect(Object.keys(FRASES_DA_TELA.categorias)).toEqual([
      "CATEGORIA_NOME_DUPLICADO",
      "CATEGORIA_NAO_ENCONTRADA",
    ]);
    expect(Object.keys(FRASES_DA_TELA.areas)).toEqual(["AREA_NOME_DUPLICADO", "AREA_NAO_ENCONTRADA"]);
    // O item 50 redigiu o `detail` desse código para esta tela: escrever frase própria o esconderia.
    expect(FRASES_DA_TELA.categorias.LISTA_DESATUALIZADA).toBeUndefined();
    expect(FRASES_DA_TELA.areas.LISTA_DESATUALIZADA).toBeUndefined();
  });
});

/**
 * ============================================================================
 *  As regras da organização e a trilha delas — item 99
 * ============================================================================
 */

describe("o corpo de PATCH /configuracao — item 99", () => {
  it("aceita cada regra sozinha e as duas juntas", () => {
    expect(alteracaoDeConfiguracaoSchema.safeParse({ exigirSolucaoAoResolver: true }).success).toBe(true);
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({ limiteDeCancelamentoDoSolicitante: "em_atendimento" })
        .success,
    ).toBe(true);
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({
        exigirSolucaoAoResolver: false,
        limiteDeCancelamentoDoSolicitante: "em_analise",
      }).success,
    ).toBe(true);
  });

  it("recusa o limite fora dos dois valores — nunca restringe, nunca aponta para terminal", () => {
    for (const limite of ["aberta", "resolvida", "pausada", ""]) {
      expect(
        alteracaoDeConfiguracaoSchema.safeParse({ limiteDeCancelamentoDoSolicitante: limite }).success,
      ).toBe(false);
    }
  });

  it("recusa booleano em texto", () => {
    expect(alteracaoDeConfiguracaoSchema.safeParse({ exigirSolucaoAoResolver: "true" }).success).toBe(
      false,
    );
  });
});

describe("os rótulos no corpo de PATCH /configuracao — item 100", () => {
  it("aceita um estado só, os seis, e o null que devolve ao padrão", () => {
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({
        rotulosDoSolicitante: { em_analise: "o síndico está avaliando" },
      }).success,
    ).toBe(true);
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({ rotulosDoSolicitante: { pausada: null } }).success,
    ).toBe(true);
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({
        rotulosDoSolicitante: {
          aberta: "a",
          em_analise: "b",
          em_atendimento: "c",
          pausada: "d",
          resolvida: "e",
          cancelada: "f",
        },
      }).success,
    ).toBe(true);
  });

  it("recusa estado que não é do ciclo", () => {
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({ rotulosDoSolicitante: { arquivada: "x" } }).success,
    ).toBe(false);
  });

  it("apara, e o teto é 40 depois de aparar — o critério 5", () => {
    const aceito = alteracaoDeConfiguracaoSchema.parse({
      rotulosDoSolicitante: { aberta: `  ${"x".repeat(40)}  ` },
    });
    expect(aceito.rotulosDoSolicitante?.aberta).toHaveLength(40);
    expect(
      alteracaoDeConfiguracaoSchema.safeParse({ rotulosDoSolicitante: { aberta: "x".repeat(41) } })
        .success,
    ).toBe(false);
  });
});

describe("a normalização da rota — item 100", () => {
  it("vazio e texto igual ao padrão viram o padrão, e é o critério 2", () => {
    expect(
      normalizarRotulos({ aberta: "   ", em_analise: "Em análise", pausada: "Parada" }),
    ).toStrictEqual({ aberta: null, em_analise: null, pausada: null });
  });

  it("texto diferente do padrão passa inteiro", () => {
    expect(normalizarRotulos({ em_analise: "o síndico está avaliando" })).toStrictEqual({
      em_analise: "o síndico está avaliando",
    });
  });

  it("o null explícito continua null — é o pedido de volta ao padrão", () => {
    expect(normalizarRotulos({ resolvida: null })).toStrictEqual({ resolvida: null });
  });
});

describe("a projeção dos rótulos — item 100", () => {
  it("os seis estados sempre saem, com null onde vale o padrão", () => {
    const projetada = projetarConfiguracao({
      regras: {
        exigirSolucaoAoResolver: false,
        limiteDeCancelamentoDoSolicitante: "em_analise",
        diasParaParada: 7,
      },
      rotulos: { em_analise: "o síndico está avaliando" },
      mudancas: [],
    });

    expect(projetada.rotulosDoSolicitante).toStrictEqual({
      aberta: null,
      em_analise: "o síndico está avaliando",
      em_atendimento: null,
      pausada: null,
      resolvida: null,
      cancelada: null,
    });
  });
});

describe("a projeção da configuração — item 99", () => {
  it("é plana, e as mudanças saem como a porta as leu", () => {
    const projetada = projetarConfiguracao({
      regras: {
        exigirSolucaoAoResolver: true,
        limiteDeCancelamentoDoSolicitante: "em_analise",
        diasParaParada: 7,
      },
      rotulos: {},
      mudancas: [
        {
          chave: "exigir_solucao_ao_resolver",
          valorAnterior: "false",
          valorNovo: "true",
          autor: { pessoaId: "p-1", nome: "Cláudia" },
          ocorridaEm: "2026-09-29T17:32:00.000Z",
        },
      ],
    });

    expect(projetada).toStrictEqual({
      exigirSolucaoAoResolver: true,
      limiteDeCancelamentoDoSolicitante: "em_analise",
      diasParaParada: 7,
      // **Os seis sempre saem** (item 100), com `null` onde vale o padrão.
      rotulosDoSolicitante: {
        aberta: null,
        em_analise: null,
        em_atendimento: null,
        pausada: null,
        resolvida: null,
        cancelada: null,
      },
      mudancas: [
        {
          chave: "exigir_solucao_ao_resolver",
          valorAnterior: "false",
          valorNovo: "true",
          autor: { pessoaId: "p-1", nome: "Cláudia" },
          ocorridaEm: "2026-09-29T17:32:00.000Z",
        },
      ],
    });
  });

  it("sem mudança nenhuma, a lista é `[]` — nunca `null`", () => {
    expect(
      projetarConfiguracao({
        regras: {
          exigirSolucaoAoResolver: false,
          limiteDeCancelamentoDoSolicitante: "em_atendimento",
          diasParaParada: 7,
        },
        rotulos: {},
        mudancas: [],
      }).mudancas,
    ).toStrictEqual([]);
  });
});

describe("a solução obrigatória no modal — item 99", () => {
  it("com a regra ligada, vazio e só espaços acendem a frase", () => {
    expect(erroDaSolucaoObrigatoria("", true)).toBe(MENSAGEM_DA_SOLUCAO_OBRIGATORIA);
    expect(erroDaSolucaoObrigatoria("   ", true)).toBe(MENSAGEM_DA_SOLUCAO_OBRIGATORIA);
    expect(erroDaSolucaoObrigatoria("Trocada a lâmpada.", true)).toBeUndefined();
  });

  it("com a regra desligada, nada acende", () => {
    expect(erroDaSolucaoObrigatoria("", false)).toBeUndefined();
    expect(erroDaSolucaoObrigatoria("   ", false)).toBeUndefined();
  });

  it("a frase da tela é a do servidor, palavra por palavra", () => {
    expect(MENSAGEM_DA_SOLUCAO_OBRIGATORIA).toBe(new SolucaoObrigatoria().detalhe);
  });
});

describe("as palavras da configuração — item 99", () => {
  it("os valores em palavra, nas duas chaves", () => {
    expect(valorEmPalavra("exigir_solucao_ao_resolver", "true")).toBe("Sim");
    expect(valorEmPalavra("exigir_solucao_ao_resolver", "false")).toBe("Não");
    expect(valorEmPalavra("limite_cancelamento_solicitante", "em_atendimento")).toBe("Sim");
    expect(valorEmPalavra("limite_cancelamento_solicitante", "em_analise")).toBe("Não");
  });

  it("a frase da mudança diz a regra e os dois valores", () => {
    expect(
      fraseDaMudanca({ chave: "exigir_solucao_ao_resolver", valorAnterior: "false", valorNovo: "true" }),
    ).toBe("Exigir a solução ao resolver: de Não para Sim");
    expect(
      fraseDaMudanca({
        chave: "limite_cancelamento_solicitante",
        valorAnterior: "em_atendimento",
        valorNovo: "em_analise",
      }),
    ).toBe("O Solicitante pode cancelar também em atendimento: de Sim para Não");
  });

  it("só o que mudou vai no corpo; nada mudou é objeto vazio", () => {
    const atuais = {
      exigirSolucaoAoResolver: false,
      limiteDeCancelamentoDoSolicitante: "em_analise",
      diasParaParada: 7,
    } as const;
    expect(regrasQueMudaram(atuais, atuais)).toStrictEqual({});
    expect(regrasQueMudaram(atuais, { ...atuais, exigirSolucaoAoResolver: true })).toStrictEqual({
      exigirSolucaoAoResolver: true,
    });
    expect(
      regrasQueMudaram(atuais, { ...atuais, limiteDeCancelamentoDoSolicitante: "em_atendimento" }),
    ).toStrictEqual({ limiteDeCancelamentoDoSolicitante: "em_atendimento" });
    expect(regrasQueMudaram(atuais, { ...atuais, diasParaParada: 15 })).toStrictEqual({
      diasParaParada: 15,
    });
  });

  it("a frase da trilha nomeia o ponto do ciclo e diz o padrão por extenso — item 100", () => {
    expect(
      fraseDaMudanca({
        chave: "rotulo_em_analise",
        valorAnterior: "",
        valorNovo: "o síndico está avaliando",
      }),
    ).toBe("Texto de Em análise: do padrão para “o síndico está avaliando”");
    expect(
      fraseDaMudanca({
        chave: "rotulo_em_analise",
        valorAnterior: "o síndico está avaliando",
        valorNovo: "",
      }),
    ).toBe("Texto de Em análise: de “o síndico está avaliando” para o padrão");
    expect(
      fraseDaMudanca({ chave: "rotulo_pausada", valorAnterior: "Parada", valorNovo: "Esperando" }),
    ).toBe("Texto de Pausada: de “Parada” para “Esperando”");
  });

  it("só o texto que mudou vai no corpo; nada mudou é objeto vazio — item 100", () => {
    const atuais = { em_analise: "a síndica está vendo" } as const;
    expect(rotulosQueMudaram(atuais, atuais)).toStrictEqual({});
    expect(rotulosQueMudaram(atuais, {})).toStrictEqual({ em_analise: null });
    expect(rotulosQueMudaram({}, { pausada: "  Esperando  " })).toStrictEqual({ pausada: "Esperando" });
  });

  /**
   * **O critério 1 é da tela, e é aqui que ele se prende.** *"Os seis estados aparecem para customizar"* —
   * a migração prova que o banco os aceita, e isto prova que a lista que o modal desenha é a do ciclo
   * inteiro, `pausada` inclusa, na ordem do caminho e não na do alfabeto.
   */
  it("os seis pontos do ciclo entram na tela, pausada inclusa, na ordem do caminho — o critério 1", () => {
    expect(ESTADOS_DO_CICLO).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "pausada",
      "resolvida",
      "cancelada",
    ]);
    expect(ESTADOS_DO_CICLO.every((estado) => NOME_DO_CICLO[estado].length > 0)).toBe(true);
  });

  it("as frases da tela terminam em ponto e não têm código dentro", () => {
    for (const frase of [APOIO_DO_LIMITE, REGRAS_SEM_MUDANCA, SEM_MUDANCAS]) {
      expect(frase.endsWith(".")).toBe(true);
      expect(frase).not.toMatch(/_/u);
    }
  });
});

/**
 * **A chave de parada na borda HTTP — item 101, critério 5.**
 *
 * A faixa está escrita em três lugares de propósito: aqui, no `check` da migração 019 e no campo de
 * T-15. Cada uma protege de um lado diferente, e esta é a que devolve `400` com o campo em vez de `500`
 * com erro do Postgres.
 */
describe("a chave de parada no corpo do PATCH — item 101", () => {
  it("aceita as duas pontas da faixa", () => {
    expect(alteracaoDeConfiguracaoSchema.parse({ diasParaParada: 1 })).toStrictEqual({
      diasParaParada: 1,
    });
    expect(alteracaoDeConfiguracaoSchema.parse({ diasParaParada: 90 })).toStrictEqual({
      diasParaParada: 90,
    });
  });

  it.each([0, 91, 7.5, -1])("recusa %s", (valor) => {
    expect(alteracaoDeConfiguracaoSchema.safeParse({ diasParaParada: valor }).success).toBe(false);
  });

  it("recusa texto, porque o corpo é JSON e o campo é número", () => {
    expect(alteracaoDeConfiguracaoSchema.safeParse({ diasParaParada: "7" }).success).toBe(false);
  });
});

/**
 * **A regra de parada na trilha da tela — item 101.**
 *
 * A linha da trilha e o cartão usam **a mesma função de valor**: o cartão escreve *"7 dias"* e a trilha
 * escreve *"de 7 dias para 15 dias"*. Num histórico em que as outras linhas dizem *Sim* e *Não*, um
 * número nu seria a única linha sem unidade.
 */
describe("os dias para parada na trilha — item 101", () => {
  it("o valor em palavra leva a unidade, no singular e no plural", () => {
    expect(valorEmPalavra("dias_para_parada", "7")).toBe("7 dias");
    expect(valorEmPalavra("dias_para_parada", "1")).toBe("1 dia");
  });

  it("a linha da trilha usa o rótulo curto e a unidade nas duas pontas", () => {
    expect(fraseDaMudanca({ chave: "dias_para_parada", valorAnterior: "7", valorNovo: "15" })).toBe(
      "Dias até contar como parada: de 7 dias para 15 dias",
    );
  });

  it("as frases das duas regras do item 99 não mudaram", () => {
    expect(
      fraseDaMudanca({ chave: "exigir_solucao_ao_resolver", valorAnterior: "false", valorNovo: "true" }),
    ).toBe("Exigir a solução ao resolver: de Não para Sim");
  });
});

/**
 * **O campo de dias em T-15 — item 101, o cenário *"dias fora da faixa"*.**
 *
 * A recusa acontece **antes de qualquer ida ao servidor**: a faixa está escrita aqui, no schema da borda
 * e no `check` do banco, e cada uma protege de um lado diferente.
 */
describe("o campo dos dias para parada — item 101", () => {
  it.each(["7", "1", "90"])("aceita %s", (bruto) => {
    expect(diasValidos(bruto)).toBe(Number(bruto));
  });

  it.each(["0", "91", "", " ", "7,5", "7.5", "sete", "-1", "007a"])("recusa %s", (bruto) => {
    expect(diasValidos(bruto)).toBeNull();
  });

  it("os textos do campo falam de dias e de pausadas, sem código dentro", () => {
    expect(ROTULO_DO_CAMPO_DE_DIAS).toContain("parada");
    expect(APOIO_DOS_DIAS).toBe("De 1 a 90. Pausadas não contam.");
    expect(DIAS_FORA_DA_FAIXA.endsWith(".")).toBe(true);
    for (const frase of [APOIO_DOS_DIAS, DIAS_FORA_DA_FAIXA]) expect(frase).not.toMatch(/_/u);
  });
});

describe("a peça tabs — critério 120.14", () => {
  const fonte = readFileSync(fileURLToPath(new URL("../../src/interface/componentes/ui/tabs.tsx", import.meta.url)), "utf8");

  it("vem do radix-ui unificado, com a variante line, e sem pacote novo", () => {
    expect(fonte).toContain('import { Tabs as TabsPrimitive } from "radix-ui"');
    expect(fonte).toContain('line: "gap-1 bg-transparent"');
    const origens = [...fonte.matchAll(/from "([^"]+)"/gu)].map((achado) => achado[1] ?? "");
    expect(origens.sort()).toStrictEqual(
      ["@/interface/componentes/utilitarios", "class-variance-authority", "radix-ui", "react"].sort(),
    );
  });
});
