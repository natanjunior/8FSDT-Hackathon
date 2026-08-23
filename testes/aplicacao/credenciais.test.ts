import { describe, expect, it } from "vitest";

import {
  criarConta,
  entrar,
  type PortaDeCredenciais,
  type ResultadoDeCredencial,
} from "@/aplicacao/credenciais";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — as funções de credencial
 * ============================================================================
 *
 * São finas de propósito: o subdomínio é **Genérico** e foi comprado, então o trabalho desta camada é
 * orquestrar e nada mais (contrato §4.1). O que ela **acrescenta** — e é o que este arquivo prova — é o
 * **aparo**: o que chega ao provedor não carrega espaço de digitação.
 *
 * Substituir o provedor aqui é **passar outro argumento**, sem simular módulo nenhum. É a ADR-0005 no seu
 * uso literal, e é a diferença entre esta camada e a de infraestrutura, que precisa do duplo do SDK.
 */

/** O duplo da porta, guardando o que recebeu. */
function portaQueRegistra(): PortaDeCredenciais & { recebido: unknown[] } {
  const recebido: unknown[] = [];
  const aceita = (): Promise<ResultadoDeCredencial> => Promise.resolve({ ok: true });

  return {
    recebido,
    entrar(email, senha) {
      recebido.push({ operacao: "entrar", email, senha });
      return aceita();
    },
    criarConta(nome, email, senha) {
      recebido.push({ operacao: "criarConta", nome, email, senha });
      return aceita();
    },
    confirmarPorCodigo() {
      return aceita();
    },
    sair() {
      return Promise.resolve();
    },
  };
}

describe("criarConta — o que chega ao provedor", () => {
  it("apara nome e e-mail, e não toca na senha", async () => {
    // A senha é literal: aparar espaço de senha mudaria silenciosamente o segredo que a pessoa escolheu.
    const porta = portaQueRegistra();

    await criarConta(porta, "  Helena Rocha  ", "  helena@exemplo.test  ", "  com espaco  ");

    expect(porta.recebido).toStrictEqual([
      {
        operacao: "criarConta",
        nome: "Helena Rocha",
        email: "helena@exemplo.test",
        senha: "  com espaco  ",
      },
    ]);
  });

  it("devolve o resultado da porta sem reinterpretá-lo", async () => {
    const porta = portaQueRegistra();

    await expect(criarConta(porta, "Helena", "helena@exemplo.test", "segredo")).resolves.toStrictEqual({
      ok: true,
    });
  });
});

describe("entrar — o que chega ao provedor", () => {
  it("apara o e-mail e não toca na senha", async () => {
    const porta = portaQueRegistra();

    await entrar(porta, "  helena@exemplo.test  ", "  segredo  ");

    expect(porta.recebido).toStrictEqual([
      { operacao: "entrar", email: "helena@exemplo.test", senha: "  segredo  " },
    ]);
  });
});
