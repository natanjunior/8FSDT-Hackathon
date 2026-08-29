import { describe, expect, it } from "vitest";

import { Avaliacao } from "@/dominio/ocorrencia";

/**
 * ============================================================================
 *  `Avaliacao` — o TERCEIRO objeto de valor do agregado, e o último
 * ============================================================================
 *
 * **Arquivo próprio, e é o segundo objeto de valor do agregado a ter um** — `Telefone` tem, e
 * `RegistroDeTransicao` não. A diferença é ter **regra de valor própria**: a escala de 1 a 5 é decisão de
 * domínio (D1), e é a única coisa que esta classe sabe que ninguém mais sabe.
 *
 * **Cinco casos, e o arquivo acaba.** O item do DoD sobre custo de teste alarma em quatro arquivos novos;
 * este é um, e é curto de propósito.
 */
describe("Avaliacao.registrada — a guarda da escala de 1 a 5", () => {
  const BASE = { comentario: null, avaliadaEm: "2026-08-29T10:00:00.000Z" };

  it("aceita as cinco notas da escala, e as devolve intactas", () => {
    for (const nota of [1, 2, 3, 4, 5]) {
      expect(Avaliacao.registrada({ ...BASE, nota }).nota).toBe(nota);
    }
  });

  it("recusa 0 e 6 — as duas bordas de fora", () => {
    // **A guarda é `Error`, e não `ErroDeDominio`**, pelo argumento das oito guardas anteriores do
    // agregado: alcançá-la significa que a Interface deixou passar um valor que `avaliacaoSchema` recusa
    // com `400`. Defeito nosso, não recusa de negócio.
    for (const nota of [0, 6]) {
      expect(() => Avaliacao.registrada({ ...BASE, nota })).toThrow(/entre 1 e 5/u);
    }
  });

  it("recusa 4.5 — a escala é INTEIRA, e arredondar em silêncio seria inventar a nota", () => {
    // O `openapi.yaml:2058` declara `type: integer`, e o `smallint` do banco truncaria sem avisar. É o
    // mesmo motivo pelo qual o schema usa `z.int()` e não `z.number()`.
    expect(() => Avaliacao.registrada({ ...BASE, nota: 4.5 })).toThrow(/inteira/u);
  });

  it("recusa NaN e Infinity — `>= 1 && <= 5` sozinho deixaria NaN passar como falso e Infinity como falso, mas a mensagem tem de ser a certa", () => {
    // `Number.isInteger` responde `false` para os dois, e é por isso que ele vem PRIMEIRO na guarda.
    for (const nota of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => Avaliacao.registrada({ ...BASE, nota })).toThrow(/inteira/u);
    }
  });

  it("comentario nulo sobrevive, e o objeto é congelado", () => {
    const avaliacao = Avaliacao.registrada({ nota: 5, comentario: null, avaliadaEm: BASE.avaliadaEm });

    expect(avaliacao.comentario).toBeNull();
    expect(avaliacao.avaliadaEm).toBe(BASE.avaliadaEm);
    expect(Object.isFrozen(avaliacao)).toBe(true);
  });
});

describe("Avaliacao.reconstituir — o caminho de volta do banco", () => {
  it("devolve o que recebeu, e NÃO confere a escala", () => {
    /**
     * **A ausência da guarda é a decisão**, e o precedente é `RegistroDeTransicao.reconstituir`, que
     * também não confere nada.
     *
     * A garantia aqui é o `CHECK` `ocorrencias_avaliacao_ck` (`005:117-119`). Guardar neste caminho
     * trocaria um dado corrompido no banco por **T-05 inteira estourando no render** — que é a regra
     * oposta que `rotuloDeStatus` já escreveu neste projeto: *"o rótulo não é o lugar de estourar:
     * degrada para a palavra"*.
     */
    const fora = Avaliacao.reconstituir({
      nota: 9,
      comentario: "veio assim do banco",
      avaliadaEm: "2026-08-29T10:00:00.000Z",
    });

    expect(fora.nota).toBe(9);
    expect(fora.comentario).toBe("veio assim do banco");
  });
});
