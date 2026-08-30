import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { cadastroDeVinculoSchema, correcaoDeVinculoSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os corpos de `POST` e `PATCH /vinculos` (item 9b)
 * ============================================================================
 *
 * **O que este arquivo prova são os critérios 2 e 3**, e a decisão 2.1 da spec: que a forma é recusada
 * antes de o domínio existir, que `[]` e ausente são coisas diferentes, e que `ordem` divergente da
 * posição é `400` — não um campo aceito e jogado fora.
 *
 * **O que ele deliberadamente NÃO prova:** par repetido. Duplicata é `409 CONTATO_DUPLICADO`, do banco
 * (critério 4) — pegá-la aqui a transformaria em `400`, que é outro código e outro significado.
 */

const TELEFONE = {
  tipo: "telefone",
  valor: "+5511955217788",
  finalidade: "trabalho",
  temWhatsapp: true,
};

const CADASTRO_VALIDO = { nome: "Sebastião Alves de Moura", papel: "encarregado" };

describe("contatos — a forma, recusada antes do domínio", () => {
  it("aceita a lista e resolve os opcionais do contrato", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador@exemplo.test" }],
    });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([
      {
        tipo: "email",
        valor: "zelador@exemplo.test",
        finalidade: "pessoal",
        temWhatsapp: false,
        observacao: null,
      },
    ]);
  });

  it("omitir contatos no cadastro vira lista vazia — Pessoa nova sem contato é permitido", () => {
    const conferido = cadastroDeVinculoSchema.safeParse(CADASTRO_VALIDO);

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([]);
  });

  it("telefone fora de E.164 é recusado, e o campo culpado é apontado", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "telefone", valor: "(11) 95521-7788" }],
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["contatos", 0, "valor"]);
  });

  it("temWhatsapp true num e-mail é recusado — WhatsApp é indicação sobre um NÚMERO", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador@exemplo.test", temWhatsapp: true }],
    });

    expect(conferido.success).toBe(false);
  });

  it("e-mail malformado é recusado", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ tipo: "email", valor: "zelador-arroba-exemplo" }],
    });

    expect(conferido.success).toBe(false);
  });

  it("observação vazia vira null — não uma observação em branco", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, observacao: "   " }],
    });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos[0]?.observacao).toBeNull();
  });
});

describe("ordem — a posição decide, e a divergente é recusada (decisão 2.1)", () => {
  it("sem ordem nenhuma é o caso BOM — é o corpo natural", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [TELEFONE, { tipo: "email", valor: "zelador@exemplo.test" }],
    });

    expect(conferido.success).toBe(true);
  });

  it("ordem que bate com a posição é aceita — o exemplo do contrato continua válido", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [
        { ...TELEFONE, ordem: 1 },
        { tipo: "email", valor: "zelador@exemplo.test", ordem: 2 },
      ],
    });

    expect(conferido.success).toBe(true);
  });

  it("ordem que NÃO bate é 400, no campo — nunca aceita e descartada em silêncio", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, ordem: 5 }],
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["contatos", 0, "ordem"]);
  });

  it("ordem nunca chega à porta — quem a grava é o servidor, pela posição", () => {
    const conferido = cadastroDeVinculoSchema.safeParse({
      ...CADASTRO_VALIDO,
      contatos: [{ ...TELEFONE, ordem: 1 }],
    });

    expect(conferido.success).toBe(true);
    expect(Object.hasOwn(conferido.data?.contatos[0] ?? {}, "ordem")).toBe(false);
  });
});

describe("correcaoDeVinculoSchema — ausente e vazio são instruções diferentes", () => {
  it("lista vazia é um valor: remova todos", () => {
    const conferido = correcaoDeVinculoSchema.safeParse({ contatos: [] });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toStrictEqual([]);
  });

  it("omitir NÃO vira lista vazia — a chave não existe no resultado", () => {
    const conferido = correcaoDeVinculoSchema.safeParse({ nome: "Nome novo" });

    expect(conferido.success).toBe(true);
    expect(conferido.data?.contatos).toBeUndefined();
  });
});

/**
 * ============================================================================
 *  O critério 10.5 — é o ÚNICO `DELETE` do contrato
 * ============================================================================
 *
 * **Um critério de aceitação sem nada que o confira é um critério que ninguém confere.** O 10.5 afirma
 * que não há caminho que apague ocorrência, mensagem, categoria nem área — e o custo de conferir isso é
 * uma varredura de doze linhas.
 *
 * **Não é o mesmo que o portão do contrato:** aquele roda sobre o `openapi.yaml`, e este roda sobre o
 * **código**. O dia em que os dois discordarem é o dia em que alguém escreveu endpoint sem publicar.
 */
describe("o único DELETE do produto", () => {
  it("existe exatamente um export const DELETE em app/api/, e é o de vínculos", () => {
    const raiz = fileURLToPath(new URL("../../app/api/", import.meta.url));

    const rotas = readdirSync(raiz, { recursive: true, encoding: "utf8" })
      .filter((caminho) => caminho.endsWith("route.ts"))
      .filter((caminho) => /^export const DELETE\b/mu.test(readFileSync(`${raiz}${caminho}`, "utf8")))
      // O `readdirSync` recursivo devolve separador do sistema; a asserção é sobre o caminho lógico.
      .map((caminho) => caminho.replace(/\\/gu, "/"));

    expect(rotas).toStrictEqual(["vinculos/[pessoaId]/route.ts"]);
  });
});
