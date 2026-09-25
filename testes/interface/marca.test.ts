import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CHAO_ESCURO, COR_DA_MARCA, MANIFESTO } from "@/interface/manifesto";

/**
 * ============================================================================
 *  Item 76 — a marca do dono, consertada antes de entrar
 * ============================================================================
 *
 * **Os arquivos entram já consertados**, e o que se prova aqui é que continuam assim: um SVG sem
 * `viewBox` não escala por CSS, o metadado C2PA é peso morto, e os miolos brancos do traçado viram
 * manchas no tema escuro, que é o padrão.
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function ler(relativo: string): string {
  return readFileSync(RAIZ + relativo, "utf8");
}

describe("os dois SVG — critério 76.9", () => {
  const LOGO = "public/marca/logo.svg";
  const ICONE = "public/marca/icone.svg";

  it("têm viewBox, e não largura nem altura fixas na raiz", () => {
    expect(ler(LOGO)).toMatch(/<svg[^>]*\bviewBox="0 0 3732 900"/u);
    expect(ler(ICONE)).toMatch(/<svg[^>]*\bviewBox="0 0 1412 1240"/u);
    for (const caminho of [LOGO, ICONE]) {
      const raiz = /<svg[^>]*>/u.exec(ler(caminho))?.[0] ?? "";
      expect(raiz, caminho).not.toMatch(/\s(?:width|height)="/u);
    }
  });

  it("não carregam metadado de proveniência", () => {
    for (const caminho of [LOGO, ICONE, "app/icon.svg"]) {
      expect(ler(caminho), caminho).not.toMatch(/<metadata|c2pa|RealFaviconGenerator/u);
    }
  });

  it("o logotipo não pinta miolo branco: os miolos recortam o laranja (achado A-2)", () => {
    const logo = ler(LOGO);
    expect(logo).not.toMatch(/#FDFDFD/iu);
    expect(logo).toContain('<mask id="miolos"');
    expect(logo).toContain('mask="url(#miolos)"');
  });

  it("o favicon é o mesmo desenho do ícone da tela", () => {
    expect(ler("app/icon.svg")).toBe(ler(ICONE));
  });

  it("o peso fica perto do traçado, sem o metadado", () => {
    expect(statSync(RAIZ + LOGO).size).toBeLessThan(52_000);
    expect(statSync(RAIZ + ICONE).size).toBeLessThan(30_000);
  });
});

describe("o pacote de favicon e o manifesto — critérios 76.11 e 76.12", () => {
  it("entra pelas convenções do Next, e o manifesto do pacote não", () => {
    for (const caminho of [
      "app/favicon.ico",
      "app/icon.svg",
      "app/apple-icon.png",
      "app/manifest.ts",
      "public/web-app-manifest-192x192.png",
      "public/web-app-manifest-512x512.png",
    ]) {
      expect(existsSync(RAIZ + caminho), caminho).toBe(true);
    }
    expect(existsSync(`${RAIZ}public/site.webmanifest`)).toBe(false);
    expect(existsSync(`${RAIZ}public/favicon-96x96.png`)).toBe(false);
  });

  it("o manifesto diz o nome do produto, a cor da marca e o chão escuro", () => {
    expect(MANIFESTO.name).toBe("Resolve Aí");
    expect(MANIFESTO.short_name).toBe("Resolve Aí");
    expect(MANIFESTO.theme_color).toBe(COR_DA_MARCA);
    expect(MANIFESTO.background_color).toBe(CHAO_ESCURO);
    expect(MANIFESTO.display).toBe("standalone");
    expect(MANIFESTO.start_url).toBe("/");
  });

  it("os dois ícones são «any», porque a marca encosta na borda do quadrado (critério 76.12)", () => {
    expect(MANIFESTO.icons?.map(({ src, sizes, purpose }) => ({ src, sizes, purpose }))).toStrictEqual([
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", purpose: "any" },
    ]);
  });

  it("app/manifest.ts só reexpõe o manifesto de src/", () => {
    expect(ler("app/manifest.ts")).toContain('from "@/interface/manifesto"');
  });
});

describe("a marca na tela — critérios 76.7 e 76.8", () => {
  const MARCA = "src/interface/componentes/marca.tsx";

  it("é o logotipo, e não mais o ícone de caderno com o rótulo em mono", () => {
    const fonte = ler(MARCA);
    expect(fonte).not.toContain("NotebookPen");
    expect(fonte).not.toContain("font-mono");
    expect(fonte).toContain('src="/marca/logo.svg"');
    expect(fonte).toContain('alt="Resolve Aí"');
    expect(fonte).toContain('from "next/image"');
  });

  it("20 px na barra, 32 px fora dela, e só esses dois", () => {
    const fonte = ler(MARCA);
    const alturas = [...fonte.matchAll(/\bh-(\d+)\b/gu)].map((achado) => achado[1]);
    expect(new Set(alturas)).toStrictEqual(new Set(["5", "8"]));
  });

  it("na barra estreita é o ícone do R, e a partir de md é o logotipo", () => {
    const fonte = ler(MARCA);
    expect(fonte).toMatch(/src="\/marca\/icone\.svg"[\s\S]*?className="[^"]*\bmd:hidden\b/u);
    expect(fonte).toMatch(/src="\/marca\/logo\.svg"[\s\S]*?className="[^"]*\bhidden\b[^"]*\bmd:block\b/u);
    expect(ler("src/interface/componentes/casca/barra-superior.tsx")).toContain(
      '<MarcaDoProduto tamanho="barra" />',
    );
  });
});
