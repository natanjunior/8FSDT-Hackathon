import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";

import { ListaDesatualizada } from "@/aplicacao/organizacao";
import { CATEGORIAS_SEMENTE, ICONE_PADRAO } from "@/dominio/organizacao";
import { DESENHO_DO_ICONE } from "@/interface/componentes/icone-de-categoria";
import { problemaDe } from "@/interface/http";
import {
  ICONES_DE_CATEGORIA,
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

  it("aceita ordem de 0 a 999 e recusa fora disso", () => {
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "A", ordem: 0 }).success).toBe(true);
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "A", ordem: 999 }).success).toBe(true);
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "A", ordem: 1000 }).success).toBe(false);
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "A", ordem: -1 }).success).toBe(false);
    expect(criacaoDeCategoriaSchema.safeParse({ nome: "A", ordem: 1.5 }).success).toBe(false);
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
