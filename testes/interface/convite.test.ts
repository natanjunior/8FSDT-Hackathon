import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// `@/interface/http` alcança `next/headers`; o que se testa aqui é puro. O mesmo arranjo de
// `credencial.test.ts`.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("cookies() não é usado neste teste");
  },
  headers: () => {
    throw new Error("headers() não é usado neste teste");
  },
}));

import { destinoDoConvite, linkDoConvite } from "@/interface/http";

/**
 * ============================================================================
 *  Unitário de INTERFACE — o convite por link (item 86)
 * ============================================================================
 *
 * O que decide mora em função pura (o destino do `?e=`, o link, a matriz do QR), e o que é ordem de
 * código vira guarda sobre a fonte, no precedente de `casca.test.ts`.
 */
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const ler = (relativo: string) => readFileSync(RAIZ + relativo, "utf8");

describe("destinoDoConvite — o ?e= do link (critério 86.6)", () => {
  it("leva o código, em maiúscula e sem espaço, para a página do convite", () => {
    expect(destinoDoConvite({ e: "K7M4QX2P" })).toBe("/convite/K7M4QX2P");
    expect(destinoDoConvite({ e: " k7m4qx2p " })).toBe("/convite/K7M4QX2P");
  });

  it("repetido pega o primeiro, e vazio ou ausente segue o caminho de hoje", () => {
    expect(destinoDoConvite({ e: ["K7M4QX2P", "OUTRO123"] })).toBe("/convite/K7M4QX2P");
    expect(destinoDoConvite({ e: "" })).toBeNull();
    expect(destinoDoConvite({ e: "   " })).toBeNull();
    expect(destinoDoConvite({})).toBeNull();
  });

  it("não deixa o valor escapar do caminho", () => {
    expect(destinoDoConvite({ e: "../../api/contexto" })).toBe("/convite/..%2F..%2FAPI%2FCONTEXTO");
  });

  it("no despachante, o ?e= vem antes da checagem de sessão", () => {
    const fonte = ler("app/page.tsx");
    const convite = fonte.indexOf("destinoDoConvite(");
    const sessao = fonte.indexOf("resolverEscopoParaTela(");
    expect(convite).toBeGreaterThan(-1);
    expect(sessao).toBeGreaterThan(convite);
  });
});

describe("linkDoConvite — o que o Gestor manda", () => {
  it("é a origem, a barra e o ?e= com o código", () => {
    expect(linkDoConvite("https://resolveai.exemplo", "K7M4QX2P")).toBe(
      "https://resolveai.exemplo/?e=K7M4QX2P",
    );
  });
});
