import { describe, expect, it } from "vitest";

import {
  ALFABETO_DO_CODIGO,
  AREAS_SEMENTE,
  CATEGORIAS_SEMENTE,
  COMPRIMENTO_DO_CODIGO,
  FORMATO_DO_CODIGO,
  ICONE_PADRAO,
  gerarCodigoPublico,
} from "@/dominio/organizacao";

/**
 * O que este arquivo prova, e por que os dois assuntos moram juntos: **é o que a POL-01 escreve**. Um
 * arquivo por constante seria simetria vazia, que o Definition of Done reprova nos dois testes de módulo.
 */

describe("o código público — critério 1.1", () => {
  it("casa com o formato do contrato e tem o comprimento decidido", () => {
    for (let i = 0; i < 200; i += 1) {
      const codigo = gerarCodigoPublico();
      expect(codigo).toMatch(/^[A-Z0-9]{6,12}$/u);
      expect(codigo).toMatch(FORMATO_DO_CODIGO);
      expect(codigo).toHaveLength(COMPRIMENTO_DO_CODIGO);
    }
  });

  /**
   * A §6.3 do modelo dá como razão do formato *"sem minúscula e **sem caractere ambíguo**"* — e o `CHECK`
   * do banco **não** garante a segunda metade, porque `[A-Z0-9]` aceita os quatro. A garantia é daqui.
   */
  it("nunca emite I, O, 0 nem 1 — o cartaz do elevador é digitado à mão", () => {
    expect(ALFABETO_DO_CODIGO).not.toMatch(/[IO01]/u);
    expect(ALFABETO_DO_CODIGO).toHaveLength(32);

    const emitidos = new Set<string>();
    for (let i = 0; i < 500; i += 1) for (const letra of gerarCodigoPublico()) emitidos.add(letra);
    for (const ambiguo of ["I", "O", "0", "1"]) expect(emitidos.has(ambiguo)).toBe(false);
  });

  it("não repete o mesmo código em duzentas chamadas", () => {
    const codigos = new Set(Array.from({ length: 200 }, () => gerarCodigoPublico()));
    expect(codigos.size).toBe(200);
  });
});

describe("as sete categorias-semente — critérios 2.1 e 2.5", () => {
  it("são exatamente as sete do enunciado, na ordem dele, em forma literal", () => {
    expect(CATEGORIAS_SEMENTE.map((c) => c.nome)).toStrictEqual([
      "Problemas de iluminação",
      "Equipamentos quebrados",
      "Falta de acessibilidade",
      "Problemas de limpeza",
      "Vazamentos",
      "Problemas de segurança",
      "Solicitações de manutenção",
    ]);
    expect(CATEGORIAS_SEMENTE.map((c) => c.ordem)).toStrictEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("traz os sete ícones da §14.1, distintos entre si e nenhum igual ao padrão", () => {
    expect(CATEGORIAS_SEMENTE.map((c) => c.icone)).toStrictEqual([
      "lightbulb",
      "unplug",
      "accessibility",
      "trash-2",
      "droplets",
      "shield",
      "wrench",
    ]);

    // Semente com ícone repetido ou neutro apaga de saída a diferença que o item 4b existe para criar.
    expect(new Set(CATEGORIAS_SEMENTE.map((c) => c.icone)).size).toBe(7);
    expect(CATEGORIAS_SEMENTE.some((c) => c.icone === ICONE_PADRAO)).toBe(false);
  });

  it("todo ícone casa com o CHECK de forma da coluna", () => {
    for (const categoria of CATEGORIAS_SEMENTE) expect(categoria.icone).toMatch(/^[a-z0-9-]{1,40}$/u);
  });
});

describe("as áreas-semente — critério 3.1", () => {
  it("são duas, uma de cada tipo, com ordem", () => {
    expect(AREAS_SEMENTE).toStrictEqual([
      { nome: "Área comum", tipo: "comum", ordem: 1 },
      { nome: "Unidade", tipo: "privativa", ordem: 2 },
    ]);
  });

  it("cobre os dois tipos — é a única exigência de conteúdo que o escopo faz", () => {
    expect(new Set(AREAS_SEMENTE.map((a) => a.tipo))).toStrictEqual(new Set(["comum", "privativa"]));
  });
});
