import { describe, expect, it } from "vitest";

import { ehE164, paraE164Brasileiro } from "@/dominio/pessoa";

/**
 * O telefone entra e sai em **E.164** (contrato §7.11), e quem o produz é a tela — o servidor confere e
 * recusa (spec §2.4). As duas metades são estas duas funções, e este é o teste das duas.
 */
describe("ehE164", () => {
  it("aceita o formato que o CHECK de `contatos` exige", () => {
    expect(ehE164("+5511999990000")).toBe(true);
    expect(ehE164("+551133334444")).toBe(true);
  });

  it("recusa o que não é E.164", () => {
    expect(ehE164("11999990000")).toBe(false); // sem o `+`
    expect(ehE164("+0511999990000")).toBe(false); // país começando com zero
    expect(ehE164("+55 11 99999-0000")).toBe(false); // com separadores
    expect(ehE164("")).toBe(false);
  });
});

describe("paraE164Brasileiro", () => {
  it("aceita celular com onze dígitos, com e sem máscara", () => {
    expect(paraE164Brasileiro("11999990000")).toBe("+5511999990000");
    expect(paraE164Brasileiro("(11) 99999-0000")).toBe("+5511999990000");
    expect(paraE164Brasileiro("+55 (11) 99999-0000")).toBe("+5511999990000");
  });

  it("aceita fixo com dez dígitos", () => {
    expect(paraE164Brasileiro("(11) 3333-4444")).toBe("+551133334444");
  });

  /**
   * **DDD 55 é Santa Maria, e é a armadilha desta função.** Um número de onze dígitos que começa com `55`
   * é um celular do DDD 55 — não um número já prefixado com o código do país. É o `> 11` que os separa.
   */
  it("não confunde o DDD 55 com o código do país", () => {
    expect(paraE164Brasileiro("55999990000")).toBe("+5555999990000");
    expect(paraE164Brasileiro("+5555999990000")).toBe("+5555999990000");
  });

  it("devolve nulo para o que não é telefone brasileiro", () => {
    expect(paraE164Brasileiro("999990000")).toBeNull(); // nove dígitos
    expect(paraE164Brasileiro("119999900001234")).toBeNull(); // longo demais
    expect(paraE164Brasileiro("")).toBeNull();
    expect(paraE164Brasileiro("telefone")).toBeNull();
  });
});
