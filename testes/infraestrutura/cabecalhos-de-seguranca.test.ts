import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Item 127 — os cabeçalhos de segurança da resposta. O teste lê o objeto que o `next.config.ts` exporta e
 * chama a chave `headers()` dele: não sobe servidor, não usa banco e não abre navegador.
 *
 * A importação é dinâmica, pelo endereço do arquivo, porque o lint proíbe `../` estático dentro de
 * `testes/` (ADR-0006, regra 3) e a raiz não tem apelido. Antes dela, `_FUMADOCS_MDX` diz ao `createMDX`
 * que a geração de `.source/` já foi feita, e o teste não escreve arquivo nenhum ao importar a configuração.
 */
const ARQUIVO_DA_CONFIGURACAO = new URL("../../next.config.ts", import.meta.url);

const ESPERADOS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "X-Frame-Options": "DENY",
};

type Regra = { source: string; headers: { key: string; value: string }[] };

let regras: Regra[];

beforeAll(async () => {
  process.env._FUMADOCS_MDX = "1";
  const modulo = (await import(/* @vite-ignore */ ARQUIVO_DA_CONFIGURACAO.href)) as { default: NextConfig };
  expect(typeof modulo.default.headers).toBe("function");
  regras = (await modulo.default.headers!()) as Regra[];
});

describe("os cabeçalhos de segurança do next.config.ts", () => {
  it("valem para todas as rotas, por uma regra só em /:path*", () => {
    const daRaiz = regras.filter((regra) => regra.source === "/:path*");
    expect(daRaiz).toHaveLength(1);
  });

  it("prende os cinco nomes e valores", () => {
    const servidos = Object.fromEntries(
      regras.find((regra) => regra.source === "/:path*")!.headers.map(({ key, value }) => [key, value]),
    );
    expect(servidos).toEqual(ESPERADOS);
  });

  it("não serve Content-Security-Policy, nem em modo de relatório", () => {
    const nomes = regras.flatMap((regra) => regra.headers.map(({ key }) => key.toLowerCase()));
    expect(nomes.filter((nome) => nome.startsWith("content-security-policy"))).toEqual([]);

    // A configuração inteira, como texto: nem comentada a política pode estar escrita como cabeçalho.
    const fonte = readFileSync(fileURLToPath(ARQUIVO_DA_CONFIGURACAO), "utf8");
    expect(fonte).not.toMatch(/key:\s*["']Content-Security-Policy/i);
  });
});
