import { describe, expect, it } from "vitest";

import { CATEGORIAS_SEMENTE, ICONE_PADRAO } from "@/dominio/organizacao";
import {
  ICONES_DE_CATEGORIA,
  correcaoDeAreaSchema,
  correcaoDeCategoriaSchema,
  criacaoDeAreaSchema,
  criacaoDeCategoriaSchema,
  iconeDeCategoria,
  type EntradaDeCriacaoDeCategoria,
  type NomeDeIcone,
} from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os schemas de configuração (T-09, itens 4a e 5)
 * ============================================================================
 *
 * **A lista de 25 nomes mora aqui por decisão declarada** (modelo §14.5): o banco guarda a *forma*
 * (`CHECK (icone ~ '^[a-z0-9-]{1,40}$')`) e a *lista* mora no schema de validação da Interface, porque o
 * cliente não consegue renderizar uma string — já existe obrigatoriamente um mapa nome → componente lá, e
 * a lista no banco seria a terceira cópia.
 *
 * **A metade que este arquivo consegue provar é a de dentro:** que a lista tem 25 nomes, que as sete
 * sementes estão nela e que o padrão está nela. A outra metade — *"todo nome resolve a um componente
 * exportado pelo `lucide-react`"* — é o critério **4b.5**, e depende de uma dependência que não está
 * instalada.
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
