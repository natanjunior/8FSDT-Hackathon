import { describe, expect, it } from "vitest";

import {
  criarContaSchema,
  definirSenhaSchema,
  entrarSchema,
  pedirRedefinicaoSchema,
} from "@/interface/schemas";

/**
 * ============================================================================
 *  Unitário de INTERFACE — os schemas das telas de credencial (T-01, T-11)
 * ============================================================================
 *
 * **O que este arquivo prova, e é o critério 1 do item 6a:** que T-11 pede **três** campos, que o `nome` é
 * obrigatório e cabe em 120 — o `varchar(120)` de `pessoas.nome` (modelo §6.2) —, e que T-01 pede dois.
 *
 * O schema é o **mesmo objeto** no navegador e no servidor (ADR-0007), então o que se confere aqui é o que
 * a tela recusa antes de gastar uma ida ao provedor.
 */

describe("criarContaSchema — os três campos de T-11", () => {
  const valido = { nome: "Helena Rocha", email: "helena@exemplo.test", senha: "segredo" };

  it("aceita os três campos preenchidos", () => {
    const conferido = criarContaSchema.safeParse(valido);

    expect(conferido.success).toBe(true);
  });

  it("exige o nome — é ele que vira pessoas.nome, e a coluna é NOT NULL", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, nome: "" });

    expect(conferido.success).toBe(false);
  });

  it("exige e-mail e senha", () => {
    expect(criarContaSchema.safeParse({ ...valido, email: "" }).success).toBe(false);
    expect(criarContaSchema.safeParse({ ...valido, senha: "" }).success).toBe(false);
  });

  it("recusa e-mail sem forma de e-mail", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, email: "helena-arroba-exemplo" });

    expect(conferido.success).toBe(false);
  });

  it("aceita nome de 120 e recusa de 121 — é o limite que T-11 declara", () => {
    const cento_e_vinte = "a".repeat(120);

    expect(criarContaSchema.safeParse({ ...valido, nome: cento_e_vinte }).success).toBe(true);
    expect(criarContaSchema.safeParse({ ...valido, nome: `${cento_e_vinte}a` }).success).toBe(false);
  });

  it("apara o espaço em volta do nome antes de medir — 120 com espaços continua cabendo", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, nome: "  Helena Rocha  " });

    expect(conferido.success).toBe(true);
    expect(conferido.success && conferido.data.nome).toBe("Helena Rocha");
  });

  it("nome só de espaço não passa — o aparo acontece antes da obrigatoriedade", () => {
    const conferido = criarContaSchema.safeParse({ ...valido, nome: "     " });

    expect(conferido.success).toBe(false);
  });
});

describe("entrarSchema — os dois campos de T-01", () => {
  it("pede e-mail e senha, e não pede nome", () => {
    const conferido = entrarSchema.safeParse({ email: "helena@exemplo.test", senha: "segredo" });

    expect(conferido.success).toBe(true);
    expect(conferido.success && Object.keys(conferido.data).sort()).toStrictEqual(["email", "senha"]);
  });

  it("recusa credencial vazia sem ir ao provedor", () => {
    expect(entrarSchema.safeParse({ email: "", senha: "" }).success).toBe(false);
  });
});

describe("pedirRedefinicaoSchema — o campo único de T-12", () => {
  it("pede e-mail, e só e-mail", () => {
    const conferido = pedirRedefinicaoSchema.safeParse({ email: "helena@exemplo.test" });

    expect(conferido.success).toBe(true);
    expect(conferido.success && Object.keys(conferido.data)).toStrictEqual(["email"]);
  });

  it("recusa e-mail malformado antes de gastar um envio do teto de dois por hora", () => {
    expect(pedirRedefinicaoSchema.safeParse({ email: "helena-arroba-exemplo" }).success).toBe(false);
  });

  it("recusa e-mail vazio sem ir ao provedor", () => {
    expect(pedirRedefinicaoSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("definirSenhaSchema — o campo único de T-13 (critério 2)", () => {
  it("pede a senha nova e NÃO pede a antiga", () => {
    const conferido = definirSenhaSchema.safeParse({ senha: "senha-nova-boa" });

    expect(conferido.success).toBe(true);
    expect(conferido.success && Object.keys(conferido.data)).toStrictEqual(["senha"]);
  });

  it("descarta um campo de senha antiga se alguém o mandar", () => {
    const conferido = definirSenhaSchema.safeParse({ senha: "nova", senhaAntiga: "velha" });

    expect(conferido.success && Object.keys(conferido.data)).toStrictEqual(["senha"]);
  });

  it("recusa senha vazia sem ir ao provedor", () => {
    expect(definirSenhaSchema.safeParse({ senha: "" }).success).toBe(false);
  });

  it("aceita senha de 6 e de 5 — a regra de força é do provedor, não deste schema", () => {
    // **Deliberado, e é a restrição G1.** O número 6 já vive na frase da tela e no `config.toml`; escrevê-lo
    // aqui criaria um terceiro lugar guardando o mesmo valor. Senha curta é recusada pelo provedor e volta
    // como SENHA_RECUSADA_PELO_PROVEDOR — que é a mesma mecânica de T-11.
    expect(definirSenhaSchema.safeParse({ senha: "123456" }).success).toBe(true);
    expect(definirSenhaSchema.safeParse({ senha: "12345" }).success).toBe(true);
  });
});
