import { describe, expect, it } from "vitest";

import { correcaoDePessoaSchema } from "@/interface/schemas";

/**
 * O corpo de `PATCH /contexto/pessoa` (item 49).
 *
 * **Cinco casos, e o último é o que guarda a decisão da §3.3:** o campo é opcional, o corpo vazio passa
 * pelo schema, e quem o recusa é a rota. Um schema que o recusasse aqui responderia com a mensagem
 * errada e fecharia a porta para `contatos[]`.
 */
describe("correcaoDePessoaSchema — o corpo de PATCH /contexto/pessoa", () => {
  it("apara o nome", () => {
    expect(correcaoDePessoaSchema.parse({ nome: "  Helena Rocha  " }).nome).toBe("Helena Rocha");
  });

  it("recusa nome só de espaços", () => {
    expect(correcaoDePessoaSchema.safeParse({ nome: "   " }).success).toBe(false);
  });

  it("recusa acima de 120 e aceita exatamente 120 — o varchar(120) de pessoas.nome", () => {
    expect(correcaoDePessoaSchema.safeParse({ nome: "a".repeat(121) }).success).toBe(false);
    expect(correcaoDePessoaSchema.safeParse({ nome: "a".repeat(120) }).success).toBe(true);
  });

  it("aceita o corpo vazio — quem o recusa é a rota, com a frase do endpoint", () => {
    expect(correcaoDePessoaSchema.parse({})).toEqual({});
  });

  it("descarta chave desconhecida em vez de recusar", () => {
    expect(correcaoDePessoaSchema.parse({ nome: "Helena", email: "outro@exemplo.com" })).toEqual({
      nome: "Helena",
    });
  });
});
