import { describe, expect, it } from "vitest";

import { camposEscritosPeloServidor, registroDeOcorrenciaSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — o corpo de `POST /ocorrencias` (item 11)
 * ============================================================================
 *
 * **Este é o QUARTO arquivo de teste da fatia, e o plano declarou três.** A justificativa que ele pedia
 * por escrito:
 *
 * O plano deixou dois critérios sem cobertura automatizada — o **11.3** (os cinco campos escritos pelo
 * servidor → `422 CAMPO_NAO_SUPORTADO`) e a **metade de forma do 11.4** (`400 FORMATO_INVALIDO` com
 * `erros[]` por campo) — e ofereceu duas saídas: um quarto arquivo, ou conferência à mão registrada no
 * relatório. **Escolhido o arquivo**, por uma razão que a conferência à mão não alcança: o gancho
 * `recusar` de `comContexto` é **plumbing novo compartilhado pelos 33 endpoints escopados** — ele roda
 * dentro de `lerCorpo`, que todo corpo de requisição atravessa. Conferido só à mão, um refactor futuro
 * de `lerCorpo` faz o campo voltar a ser descartado em silêncio, e **o silêncio é exatamente o que o
 * `422` existe para quebrar** — sem nenhum sinal na esteira.
 *
 * **O que este arquivo NÃO prova**, e é de propósito: que o handler devolve `422`. Isso é o de-para de
 * `problema.ts`, que já existe e já é exercido pelo `papel` do `PATCH /vinculos`. Aqui se prova a
 * **decisão** — quais campos são recusados, e que a recusa acontece sobre o corpo cru.
 */

const VALIDO = {
  titulo: "Lâmpada queimada na garagem",
  descricao: "Queimada faz três dias, corredor escuro.",
  categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
  areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
};

describe("o critério 11.3 — os cinco campos que o servidor escreve", () => {
  it.each(["status", "prioridade", "areaTipo", "organizacaoId", "ocorrenciaOrigemId"])(
    "%s é recusado em voz alta, nunca descartado em silêncio",
    (campo) => {
      expect(camposEscritosPeloServidor({ ...VALIDO, [campo]: "qualquer" })).toStrictEqual([campo]);
    },
  );

  it("os cinco juntos saem todos, para o erro apontar cada um", () => {
    expect(
      camposEscritosPeloServidor({
        ...VALIDO,
        status: "resolvida",
        prioridade: "alta",
        areaTipo: "privativa",
        organizacaoId: "9a1f2b3c-0000-0000-0000-000000000000",
        ocorrenciaOrigemId: "9a1f2b3c-1111-1111-1111-111111111111",
      }),
    ).toStrictEqual([
      "status",
      "prioridade",
      "areaTipo",
      "organizacaoId",
      "ocorrenciaOrigemId",
    ]);
  });

  /**
   * **A recusa vale sobre o corpo CRU, e é por isso que ela não pode morar no schema.** `status:
   * undefined` é uma chave presente — `"status" in corpo` é `true` —, e o Zod a descartaria sem deixar
   * rastro. Quem enviou o campo precisa saber que o produto não o aceita, tenha ele valor ou não.
   */
  it("a chave presente basta, mesmo com valor undefined — quem a enviou tem de saber", () => {
    expect(camposEscritosPeloServidor({ ...VALIDO, status: undefined })).toStrictEqual(["status"]);
  });

  it("corpo natural não recusa nada — a lista é fechada, não uma varredura", () => {
    expect(camposEscritosPeloServidor(VALIDO)).toStrictEqual([]);
  });

  /**
   * Campo desconhecido **fora** da lista continua sendo descartado em silêncio pelo schema. É o
   * comportamento que o repositório já tem, e alargá-lo não era decisão desta fatia.
   */
  it("campo desconhecido fora da lista NÃO vira 422 — ele segue descartado pelo schema", () => {
    expect(camposEscritosPeloServidor({ ...VALIDO, corDoPortao: "azul" })).toStrictEqual([]);
  });

  it("corpo que não é objeto não estoura — devolve lista vazia e o schema recusa a forma", () => {
    expect(camposEscritosPeloServidor(null)).toStrictEqual([]);
    expect(camposEscritosPeloServidor("texto solto")).toStrictEqual([]);
    expect(registroDeOcorrenciaSchema.safeParse("texto solto").success).toBe(false);
  });

  it("`status` não aparece no schema de entrada — a primeira verificação mecânica do openapi", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, status: "resolvida" });

    expect(conferido.success).toBe(true);
    expect(conferido.data).not.toHaveProperty("status");
  });
});

describe("o critério 11.4 — a forma, com erros[] por campo", () => {
  it("aceita o corpo natural e resolve o complemento ausente", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse(VALIDO);

    expect(conferido.success).toBe(true);
    expect(conferido.data?.titulo).toBe(VALIDO.titulo);
  });

  it("título vazio é recusado, e o campo culpado é apontado", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, titulo: "   " });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["titulo"]);
  });

  it("título acima de 150 é recusado", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, titulo: "a".repeat(151) });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.code).toBe("too_big");
  });

  it("descrição vazia e acima de 5000 são recusadas", () => {
    expect(registroDeOcorrenciaSchema.safeParse({ ...VALIDO, descricao: "" }).success).toBe(false);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, descricao: "a".repeat(5001) }).success,
    ).toBe(false);
  });

  /** **`erros[]` por campo**, e não a primeira violação: os dois campos errados aparecem juntos. */
  it("dois campos errados produzem duas violações, uma por campo", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      ...VALIDO,
      titulo: "",
      descricao: "",
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues.map((violacao) => violacao.path[0])).toStrictEqual([
      "titulo",
      "descricao",
    ]);
  });

  /** **O critério 12.1: `areaId` é obrigatório.** É dele que a visibilidade deriva (D10). */
  it("areaId ausente é recusado — é obrigatório, não opcional", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      titulo: VALIDO.titulo,
      descricao: VALIDO.descricao,
      categoriaId: VALIDO.categoriaId,
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["areaId"]);
  });

  it("categoriaId que não é uuid é recusado como forma, nunca como domínio", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, categoriaId: "iluminacao" });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["categoriaId"]);
  });

  /** **O critério 12.1**, a outra metade: o complemento é opcional, texto livre, até 200. */
  it("localizacaoComplemento é opcional, aceita null, e para em 200", () => {
    expect(registroDeOcorrenciaSchema.safeParse(VALIDO).success).toBe(true);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, localizacaoComplemento: null }).success,
    ).toBe(true);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, localizacaoComplemento: "a".repeat(200) })
        .success,
    ).toBe(true);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, localizacaoComplemento: "a".repeat(201) })
        .success,
    ).toBe(false);
  });
});
