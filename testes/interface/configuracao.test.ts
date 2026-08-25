import { describe, expect, it } from "vitest";

import { CATEGORIAS_SEMENTE, ICONE_PADRAO } from "@/dominio/organizacao";
import {
  ICONES_DE_CATEGORIA,
  correcaoDeAreaSchema,
  correcaoDeCategoriaSchema,
  criacaoDeAreaSchema,
  criacaoDeCategoriaSchema,
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

describe("a lista fechada de ícones", () => {
  it("tem exatamente 25 nomes, sem repetição", () => {
    expect(ICONES_DE_CATEGORIA).toHaveLength(25);
    expect(new Set(ICONES_DE_CATEGORIA).size).toBe(25);
  });

  it("contém o padrão e os sete das categorias-semente", () => {
    expect(ICONES_DE_CATEGORIA).toContain(ICONE_PADRAO);
    for (const semente of CATEGORIAS_SEMENTE) {
      expect(ICONES_DE_CATEGORIA).toContain(semente.icone);
    }
  });

  it("os sete das sementes são distintos entre si e nenhum é o padrão", () => {
    const dasSementes = CATEGORIAS_SEMENTE.map((c) => c.icone);
    expect(new Set(dasSementes).size).toBe(7);
    expect(dasSementes).not.toContain(ICONE_PADRAO);
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
