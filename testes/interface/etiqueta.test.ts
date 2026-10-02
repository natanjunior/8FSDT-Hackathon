import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  chaveDoNome,
  cortarParaALinha,
  nomeDoRestante,
  nomeParaCriar,
  sugestoes,
  textoDoApagar,
  tituloDoApagar,
  usoPorEtiqueta,
} from "@/interface/componentes/etiquetas-de-participante";
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

const E = (id: string, nome: string) => ({ id, nome });
const TODAS = [E("1", "Contratado"), E("2", "Eletricista"), E("3", "Elétrica"), E("4", "Pintor")];

describe("a linha mostra duas e +N (critério 10)", () => {
  it("até duas, todas aparecem", () => {
    expect(cortarParaALinha(TODAS.slice(0, 2))).toStrictEqual({ visiveis: TODAS.slice(0, 2), restantes: [] });
  });

  it("quatro viram duas e +2, e o +2 diz quais ficaram de fora", () => {
    const { visiveis, restantes } = cortarParaALinha(TODAS);
    expect(visiveis.map((e) => e.nome)).toStrictEqual(["Contratado", "Eletricista"]);
    expect(nomeDoRestante(restantes)).toBe("mais 2: Elétrica, Pintor");
  });
});

describe("o autocompletar (critérios 1 e 2)", () => {
  it("sugere pelo começo da palavra, ignorando acento para SUGERIR, e sem as que a pessoa já tem", () => {
    expect(sugestoes(TODAS, [E("2", "Eletricista")], "ele").map((e) => e.nome)).toStrictEqual(["Elétrica"]);
  });

  it("texto vazio sugere todas as que a pessoa não tem", () => {
    expect(sugestoes(TODAS, [E("1", "Contratado")], "  ")).toHaveLength(3);
  });

  it("oferece criar quando nenhuma tem a mesma grafia, com o texto aparado", () => {
    expect(nomeParaCriar(TODAS, "  Encanador ")).toBe("Encanador");
  });

  it("não oferece criar o que já existe por maiúscula — mas acento conta", () => {
    expect(nomeParaCriar(TODAS, "eletricista ")).toBeNull();
    expect(nomeParaCriar(TODAS, "Elétricista")).toBe("Elétricista");
  });

  it("não oferece criar vazio nem acima de 30", () => {
    expect(nomeParaCriar(TODAS, "   ")).toBeNull();
    expect(nomeParaCriar(TODAS, "a".repeat(31))).toBeNull();
    expect(nomeParaCriar(TODAS, "a".repeat(30))).toBe("a".repeat(30));
  });

  it("a chave é a do banco: apara e desce caixa, e não tira acento", () => {
    expect(chaveDoNome(" ÉLETRICISTA ")).toBe("életricista");
  });
});

describe("apagar mostra quantas (critério 7)", () => {
  it("conta o uso de cada etiqueta nos vínculos que a tela tem", () => {
    expect(
      usoPorEtiqueta([{ etiquetas: [E("1", "Contratado")] }, { etiquetas: [E("1", "Contratado"), E("4", "Pintor")] }]),
    ).toStrictEqual({ "1": 2, "4": 1 });
  });

  it("as frases da confirmação", () => {
    expect(tituloDoApagar("Prestador")).toBe("Apagar “Prestador”?");
    expect(textoDoApagar(6)).toBe("Está em 6 pessoas e sai de todas.");
    expect(textoDoApagar(1)).toBe("Está em 1 pessoa e sai dela.");
    expect(textoDoApagar(0)).toBe("Não está em ninguém.");
  });
});
