import { describe, expect, it } from "vitest";

import {
  criarConta,
  definirSenha,
  entrar,
  pedirRedefinicaoDeSenha,
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
    criarConta(nome, email, senha, destino) {
      recebido.push({ operacao: "criarConta", nome, email, senha, destino });
      return aceita();
    },
    pedirRedefinicaoDeSenha(email) {
      recebido.push({ operacao: "pedirRedefinicaoDeSenha", email });
      return aceita();
    },
    iniciarRedefinicao(tokenHash) {
      recebido.push({ operacao: "iniciarRedefinicao", tokenHash });
      return aceita();
    },
    definirSenha(senhaNova) {
      recebido.push({ operacao: "definirSenha", senhaNova });
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

    await criarConta(
      porta,
      "  Helena Rocha  ",
      "  helena@exemplo.test  ",
      "  com espaco  ",
      "https://exemplo.test/confirmar-conta",
    );

    expect(porta.recebido).toStrictEqual([
      {
        operacao: "criarConta",
        nome: "Helena Rocha",
        email: "helena@exemplo.test",
        senha: "  com espaco  ",
        destino: "https://exemplo.test/confirmar-conta",
      },
    ]);
  });

  it("devolve o resultado da porta sem reinterpretá-lo", async () => {
    const porta = portaQueRegistra();

    await expect(
      criarConta(porta, "Helena", "helena@exemplo.test", "segredo", "https://exemplo.test/confirmar-conta"),
    ).resolves.toStrictEqual({ ok: true });
  });

  it("repassa o destino sem aparar — quem o montou foi a Interface, e ela é quem tem a requisição", async () => {
    // O nome e o e-mail são aparados aqui de propósito; o destino **não é**. Aparar um endereço montado
    // por outra camada seria esta camada opinando sobre transporte, que é o que a tabela de camadas
    // separa. O espaço abaixo é intencional, e a asserção é que ele CHEGA.
    const porta = portaQueRegistra();

    await criarConta(porta, "Helena", "helena@exemplo.test", "segredo", " https://exemplo.test/confirmar-conta ");

    expect(porta.recebido).toStrictEqual([
      {
        operacao: "criarConta",
        nome: "Helena",
        email: "helena@exemplo.test",
        senha: "segredo",
        destino: " https://exemplo.test/confirmar-conta ",
      },
    ]);
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

describe("as operações de recuperação — o que chega ao provedor", () => {
  it("apara o e-mail de T-12", async () => {
    const porta = portaQueRegistra();

    await pedirRedefinicaoDeSenha(porta, "  helena@exemplo.test  ");

    expect(porta.recebido).toStrictEqual([
      { operacao: "pedirRedefinicaoDeSenha", email: "helena@exemplo.test" },
    ]);
  });

  it("NÃO apara a senha nova de T-13 — aparar mudaria o segredo escolhido", async () => {
    const porta = portaQueRegistra();

    await definirSenha(porta, "  com espaco  ");

    expect(porta.recebido).toStrictEqual([{ operacao: "definirSenha", senhaNova: "  com espaco  " }]);
  });
});
