import { describe, expect, it } from "vitest";

import { criarCarteiro } from "@/infraestrutura/clientes";

/**
 * ============================================================================
 *  O carteiro SMTP — item 122
 * ============================================================================
 *
 * **Um transporte mínimo, e não o do pacote**: o lint proíbe `nodemailer` fora de `clientes/`, e `testes/`
 * está fora. É o precedente de `credenciais.test.ts`, que testa o adaptador sem importar o SDK.
 */
const MENSAGEM = { para: "maria@example.com", assunto: "Convite para o Prédio", texto: "t", html: "<p>t</p>" };

describe("o carteiro SMTP (item 122)", () => {
  it("monta a mensagem com o remetente dado, o texto e o HTML", async () => {
    const recebidas: Record<string, unknown>[] = [];
    const transporte = {
      sendMail: (opcoes: Record<string, unknown>) => {
        recebidas.push(opcoes);
        return Promise.resolve({});
      },
    };
    await criarCarteiro(transporte, "Resolve Aí <convite@example.com>").enviar(MENSAGEM);
    expect(recebidas).toStrictEqual([
      {
        from: "Resolve Aí <convite@example.com>",
        to: "maria@example.com",
        subject: "Convite para o Prédio",
        text: "t",
        html: "<p>t</p>",
      },
    ]);
  });

  it("rejeita quando o provedor recusa", async () => {
    const transporte = { sendMail: () => Promise.reject(new Error("550 recusado")) };
    await expect(criarCarteiro(transporte, "x <x@example.com>").enviar(MENSAGEM)).rejects.toThrow(/550/u);
  });

  it("sem CORREIO_SMTP_URL, o erro nomeia a variável e o caminho dela", async () => {
    const antes = process.env.CORREIO_SMTP_URL;
    delete process.env.CORREIO_SMTP_URL;
    try {
      // A configuração é lida no primeiro envio, e não na montagem: o erro sai de `enviar`.
      await expect(criarCarteiro().enviar(MENSAGEM)).rejects.toThrow(/CORREIO_SMTP_URL/u);
    } finally {
      if (antes !== undefined) process.env.CORREIO_SMTP_URL = antes;
    }
  });
});
