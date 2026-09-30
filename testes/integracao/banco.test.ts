import { describe, expect, it } from "vitest";

import { DATABASE_DE_TESTE, resolverBancoDeTeste } from "./banco";

/**
 * A resolução do destino da suíte de integração — e a trava que a impede de escrever no banco de
 * desenvolvimento, que é o defeito do item 39.2.
 *
 * **Puro de propósito:** a função recebe o ambiente como argumento em vez de ler `process.env`, e é isso
 * que torna estes casos executáveis no laço curto, sem Postgres e sem mexer em variável global.
 */
const DESENVOLVIMENTO = "postgresql://postgres:postgres@host.docker.internal:54692/postgres";

describe("resolverBancoDeTeste", () => {
  it("deriva de BANCO_URL trocando só o database", () => {
    const alvo = resolverBancoDeTeste({ BANCO_URL: DESENVOLVIMENTO });

    expect(alvo).toBe(`postgresql://postgres:postgres@host.docker.internal:54692/${DATABASE_DE_TESTE}`);
  });

  it("preserva senha com símbolo, porta não padrão e query string", () => {
    const alvo = resolverBancoDeTeste({
      BANCO_URL: "postgresql://postgres:p%40ss@127.0.0.1:65432/postgres?sslmode=require",
    });

    expect(alvo).toBe(`postgresql://postgres:p%40ss@127.0.0.1:65432/${DATABASE_DE_TESTE}?sslmode=require`);
  });

  it("usa BANCO_URL_TESTE quando ela existe — é o caso do CI", () => {
    const doCi = "postgresql://postgres:postgres@127.0.0.1:5432/resolveai_teste";

    expect(resolverBancoDeTeste({ BANCO_URL_TESTE: doCi })).toBe(doCi);
  });

  // O caso que o `.env.example:50` induzia: mesmo database, nomes de host diferentes para o MESMO servidor.
  // Comparar host daria "diferentes" e deixaria passar — por isso a trava compara o database.
  it("recusa BANCO_URL_TESTE que aponta para o database de desenvolvimento, mesmo com outro nome de host", () => {
    expect(() =>
      resolverBancoDeTeste({
        BANCO_URL_TESTE: "postgresql://postgres:postgres@127.0.0.1:54692/postgres",
        BANCO_URL: DESENVOLVIMENTO,
      }),
    ).toThrow(/desenvolvimento/iu);
  });

  it("recusa quando BANCO_URL já é o próprio database de teste", () => {
    const url = `postgresql://postgres:postgres@127.0.0.1:54692/${DATABASE_DE_TESTE}`;

    expect(() => resolverBancoDeTeste({ BANCO_URL: url })).toThrow(/desenvolvimento/iu);
  });

  it("exige uma das duas variáveis, nomeando as duas", () => {
    expect(() => resolverBancoDeTeste({})).toThrow(/BANCO_URL_TESTE.*BANCO_URL|BANCO_URL.*BANCO_URL_TESTE/su);
  });

  it("ignora variável presente e vazia, tratando-a como ausente", () => {
    expect(resolverBancoDeTeste({ BANCO_URL_TESTE: "   ", BANCO_URL: DESENVOLVIMENTO })).toBe(
      `postgresql://postgres:postgres@host.docker.internal:54692/${DATABASE_DE_TESTE}`,
    );
  });
});
