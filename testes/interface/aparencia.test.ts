/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { GrupoDeAparencia } from "@/interface/componentes/casca/itens-de-aparencia";
import { RAZAO_DO_TEMA_INERTE } from "@/interface/componentes/casca/item-de-tema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/interface/componentes/ui/dropdown-menu";

/**
 * **O menu de aparência renderizado — item 114.** O que só o DOM diz: o papel, o estado marcado, o
 * `aria-disabled` que não tira o item do teclado, a razão ligada por `aria-describedby`, e o grupo com
 * nome. O teclado de verdade (setas, busca por digitação, Enter inerte) é do teste de ponta a ponta,
 * porque o foco móvel do Radix não roda direito no `jsdom`.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// O `Popper` do Radix mede o conteúdo com `ResizeObserver`, que o `jsdom` não tem.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

const raizes: Root[] = [];

afterEach(async () => {
  for (const raiz of raizes.splice(0)) await act(async () => raiz.unmount());
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-contraste");
});

/** O `<html>` como o script do `<head>` o deixa, e o menu aberto com o grupo dentro. */
async function abrir(tema: "dark" | "light", contraste: "alto" | null): Promise<void> {
  document.documentElement.setAttribute("data-theme", tema);
  if (contraste !== null) document.documentElement.setAttribute("data-contraste", contraste);

  const elemento = document.createElement("div");
  document.body.append(elemento);
  const raiz = createRoot(elemento);
  raizes.push(raiz);
  await act(async () =>
    raiz.render(
      createElement(
        DropdownMenu,
        { open: true },
        createElement(DropdownMenuTrigger, null, "abrir"),
        createElement(DropdownMenuContent, null, createElement(GrupoDeAparencia)),
      ),
    ),
  );
}

function chave(nome: string): HTMLElement {
  const achada = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]')).find(
    (elemento) => elemento.textContent?.trim().startsWith(nome),
  );
  if (achada === undefined) throw new Error(`a chave «${nome}» não foi renderizada`);
  return achada;
}

describe("o grupo Aparência — critérios 114.1, 114.5 e 114.6", () => {
  it("é um grupo com nome, e o nome é o rótulo", async () => {
    await abrir("dark", null);
    const grupo = document.querySelector<HTMLElement>('[role="group"]');
    expect(grupo).not.toBeNull();
    const idDoRotulo = grupo?.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(idDoRotulo)?.textContent).toBe("Aparência");
  });

  it("as duas chaves são item marcável, na ordem tema e contraste", async () => {
    await abrir("dark", null);
    const nomes = Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).map(
      (elemento) => elemento.textContent?.trim(),
    );
    expect(nomes).toEqual(["Tema escuro", "Alto contraste"]);
  });

  it("o ligado tem o visto do catálogo, e o desligado não", async () => {
    await abrir("dark", null);
    // O `ItemIndicator` do Radix só renderiza o filho quando marcado.
    expect(chave("Tema escuro").querySelector("svg.lucide-check")).not.toBeNull();
    expect(chave("Alto contraste").querySelector("svg.lucide-check")).toBeNull();
  });
});

describe("o tema com o contraste normal", () => {
  it("diz o tema guardado, com o sol no claro, e responde", async () => {
    await abrir("light", null);
    const tema = chave("Tema escuro");
    expect(tema.getAttribute("aria-checked")).toBe("false");
    expect(tema.hasAttribute("aria-disabled")).toBe(false);
    expect(tema.hasAttribute("data-disabled")).toBe(false);
    expect(tema.querySelector("svg.lucide-sun")).not.toBeNull();
    expect(document.body.textContent).not.toContain(RAZAO_DO_TEMA_INERTE);
  });
});

describe("o tema com o contraste alto — critérios 114.3 e 114.4", () => {
  it("diz o que a tela pinta: lua e marcado, mesmo com o claro guardado", async () => {
    await abrir("light", "alto");
    const tema = chave("Tema escuro");
    expect(tema.getAttribute("aria-checked")).toBe("true");
    expect(tema.querySelector("svg.lucide-moon")).not.toBeNull();
    expect(chave("Alto contraste").getAttribute("aria-checked")).toBe("true");
  });

  it("fica inerte sem sair do teclado: aria-disabled, e não disabled", async () => {
    await abrir("light", "alto");
    const tema = chave("Tema escuro");
    expect(tema.getAttribute("aria-disabled")).toBe("true");
    // `data-disabled` é o que o Radix põe quando recebe `disabled`, e é o que tira o item do foco móvel.
    expect(tema.hasAttribute("data-disabled")).toBe(false);
  });

  it("a razão está escrita, ligada ao item, e não se apaga com ele", async () => {
    await abrir("light", "alto");
    const tema = chave("Tema escuro");
    const razao = document.getElementById(tema.getAttribute("aria-describedby") ?? "");
    expect(razao?.textContent).toBe(RAZAO_DO_TEMA_INERTE);
    expect(razao?.closest(".opacity-50")).toBeNull();
  });

  it("o nome acessível continua só «Tema escuro»", async () => {
    await abrir("light", "alto");
    const tema = chave("Tema escuro");
    const rotulo = document.getElementById(tema.getAttribute("aria-labelledby") ?? "");
    expect(rotulo?.textContent).toBe("Tema escuro");
  });
});

describe("o esmaecer sob movimento reduzido — critério 114.7", () => {
  // Pelo caminho, como o `foco.test.ts`: no `jsdom`, `new URL(…, import.meta.url)` não é `file:`.
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const css = readFileSync(join(raiz, "app", "globals.css"), "utf8");
  const inicio = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const bloco = css.slice(inicio, css.indexOf("@keyframes barra-de-progresso"));

  it("o corte global de duração fica (apuração 5: spin e caret não têm guarda própria)", () => {
    expect(inicio).toBeGreaterThan(-1);
    expect(bloco).toContain("animation-duration: 0.01ms !important;");
  });

  it("a exceção alcança só a entrada e a saída do catálogo, e devolve a duração", () => {
    expect(bloco).toMatch(/\[class\*="animate-in"\],\s*\[class\*="animate-out"\]\s*\{/u);
    expect(bloco).toContain(
      "animation-duration: var(--tw-animation-duration, var(--tw-duration, 150ms)) !important;",
    );
    expect(bloco).not.toMatch(/accordion|collapsible|spin|caret|pulse|barra-de-progresso/u);
  });

  it("zera a geometria das dez variáveis, no valor neutro de cada uma, e deixa a opacidade", () => {
    for (const lado of ["enter", "exit"]) {
      expect(bloco).toContain(`--tw-${lado}-translate-x: 0 !important;`);
      expect(bloco).toContain(`--tw-${lado}-translate-y: 0 !important;`);
      // Escala neutra é 1: 0 faria a sobreposição crescer do nada (plano 114 §0, imprecisão 1).
      expect(bloco).toContain(`--tw-${lado}-scale: 1 !important;`);
      expect(bloco).toContain(`--tw-${lado}-rotate: 0 !important;`);
      expect(bloco).toContain(`--tw-${lado}-blur: 0 !important;`);
      expect(bloco).not.toContain(`--tw-${lado}-opacity`);
    }
  });
});
