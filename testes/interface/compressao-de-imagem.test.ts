import { describe, expect, it } from "vitest";

import { TETO_DE_BYTES_DO_ANEXO } from "@/interface/schemas";

import {
  LIMITE_DO_SELETOR_EM_BYTES,
  TENTATIVAS,
  dimensoes,
} from "@/interface/componentes/compressao-de-imagem";

/**
 * **A decisão de compressão, sem canvas.**
 *
 * O `jsdom` não codifica imagem, e simular o canvas testaria o simulador. O que fica coberto aqui é onde
 * mora a regra — quais tentativas, em que ordem, e quando desistir. A codificação em si é conferida à mão,
 * no aparelho, junto com a medição do RNF6.
 */
describe("dimensoes", () => {
  it("reduz o maior lado ao alvo, preservando a proporção", () => {
    expect(dimensoes(4032, 3024, 1600)).toEqual({ largura: 1600, altura: 1200 });
  });

  it("funciona em retrato", () => {
    expect(dimensoes(3024, 4032, 1600)).toEqual({ largura: 1200, altura: 1600 });
  });

  it("nunca amplia — foto pequena sai do tamanho que entrou", () => {
    expect(dimensoes(800, 600, 1600)).toEqual({ largura: 800, altura: 600 });
  });

  it("arredonda para pixel inteiro", () => {
    const { largura, altura } = dimensoes(1000, 333, 1600);
    expect(Number.isInteger(largura)).toBe(true);
    expect(Number.isInteger(altura)).toBe(true);
  });
});

describe("a escada", () => {
  it("tem no máximo quatro degraus — cada codificação custa segundos do RNF6", () => {
    expect(TENTATIVAS.length).toBeLessThanOrEqual(4);
  });

  it("desce em qualidade antes de descer em tamanho", () => {
    // **`?.` e não desestruturação**: o `tsconfig.json` liga `noUncheckedIndexedAccess`, então índice de
    // array é `T | undefined` e `const [primeira] = …; primeira.lado` é erro TS18048 — `npm run tipos`
    // barra. É o mesmo idioma de `testes/integracao/pedido-de-entrada.test.ts` (`emA[0]?.total`).
    const primeira = TENTATIVAS[0];
    const ultima = TENTATIVAS[TENTATIVAS.length - 1];

    expect(primeira?.lado).toBe(1600);
    expect(ultima?.lado).toBeLessThan(primeira?.lado ?? 0);
    expect(primeira?.qualidade).toBeGreaterThan(ultima?.qualidade ?? 1);
  });

  it("o teto é o do contrato, e o seletor aceita muito mais que ele", () => {
    // **Um número só, num lugar só.** O teto vem do schema de entrada, que é onde o contrato o declara —
    // a compressão o importa em vez de repeti-lo. Duas constantes de 524288 divergiriam no dia em que
    // uma delas mudasse.
    expect(TETO_DE_BYTES_DO_ANEXO).toBe(524_288);
    expect(LIMITE_DO_SELETOR_EM_BYTES).toBe(10 * 1024 * 1024);
  });
});
