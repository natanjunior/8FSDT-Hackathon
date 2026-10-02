import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { projetarVinculo } from "@/interface/projecoes";
import { atribuicaoDeEtiquetaSchema } from "@/interface/schemas";

describe("atribuicaoDeEtiquetaSchema — o nome é forma, e a forma é 400 (critério 3; docs/api.md, Erros)", () => {
  it("apara, e aceita de 1 a 30", () => {
    expect(atribuicaoDeEtiquetaSchema.parse({ nome: "  Eletricista " })).toStrictEqual({ nome: "Eletricista" });
    expect(atribuicaoDeEtiquetaSchema.safeParse({ nome: "a".repeat(30) }).success).toBe(true);
  });

  it("recusa vazio depois de aparar e 31 caracteres, dizendo o limite", () => {
    const vazio = atribuicaoDeEtiquetaSchema.safeParse({ nome: "   " });
    const longo = atribuicaoDeEtiquetaSchema.safeParse({ nome: "a".repeat(31) });
    expect(vazio.success).toBe(false);
    expect(longo.success).toBe(false);
    expect(longo.error?.issues[0]?.message).toBe("Até 30 caracteres.");
  });
});

describe("a projeção do Vinculo carrega as etiquetas", () => {
  it("em ordem, só id e nome", () => {
    const projetado = projetarVinculo({
      pessoa: { pessoaId: "p", nome: "Sebastião", contatos: [] },
      papel: "encarregado",
      area: null,
      temConta: false,
      criadoEm: "2026-10-02T12:00:00.000Z",
      atualizadoEm: null,
      etiquetas: [
        { id: "1", nome: "Contratado" },
        { id: "2", nome: "Eletricista" },
      ],
    });
    expect(projetado.etiquetas).toStrictEqual([
      { id: "1", nome: "Contratado" },
      { id: "2", nome: "Eletricista" },
    ]);
  });
});

const RAIZ_DA_API = fileURLToPath(new URL("../../app/api/", import.meta.url));

function rotasDeEtiqueta(): string[] {
  return readdirSync(RAIZ_DA_API, { recursive: true, encoding: "utf8" })
    .map((caminho) => caminho.replace(/\\/gu, "/"))
    .filter((caminho) => caminho.endsWith("route.ts") && caminho.includes("etiqueta"));
}

describe("só quem gere vínculos (critério 6)", () => {
  it("as quatro rotas de etiqueta existem, e toda operação exige vinculo.gerir", () => {
    const rotas = rotasDeEtiqueta();
    expect(rotas.sort()).toStrictEqual(
      [
        "etiquetas-de-participante/[etiquetaId]/route.ts",
        "etiquetas-de-participante/route.ts",
        "vinculos/[pessoaId]/etiquetas/[etiquetaId]/route.ts",
        "vinculos/[pessoaId]/etiquetas/route.ts",
      ].sort(),
    );
    for (const rota of rotas) {
      const fonte = readFileSync(`${RAIZ_DA_API}${rota}`, "utf8");
      const operacoes = fonte.match(/^export const (GET|POST|DELETE)\b/gmu) ?? [];
      const exigencias = fonte.match(/exige: "vinculo\.gerir"/gu) ?? [];
      expect(operacoes.length, rota).toBeGreaterThan(0);
      expect(exigencias.length, rota).toBe(operacoes.length);
    }
  });
});
