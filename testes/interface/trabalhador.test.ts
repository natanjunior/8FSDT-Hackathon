import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SCRIPT_DO_TEMA } from "@/interface/componentes/tema";
import { COR_DA_MARCA } from "@/interface/manifesto";
import { CORES_DA_CASCA, montarCasca, SCRIPT_DA_CASCA } from "@/interface/trabalhador/casca";
import {
  CABECALHO_DA_SONDA,
  FRASE_ABRINDO,
  FRASE_SEM_CONEXAO,
  INTERVALO_DA_SONDA_MS,
  SONDA,
} from "@/interface/trabalhador/constantes";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const ler = (caminho: string): string => readFileSync(`${RAIZ}${caminho}`, "utf8");
const ICONE = ler("public/marca/icone.svg");

/**
 * **O trabalhador de serviço do item 98.** O que vai ao navegador é texto; os testes rodam esse mesmo
 * texto com `new Function`, sobre `self`, `caches` e `fetch` falsos, como `tema.test.ts` faz com o
 * `SCRIPT_DO_TEMA`.
 */
describe("a casca guardada — critério 98.1", () => {
  const casca = montarCasca({ iconeSvg: ICONE });

  it("é um documento autocontido: nada de /_next/, nada de endereço externo", () => {
    expect(casca.startsWith("<!doctype html>")).toBe(true);
    expect(casca).toContain('<html lang="pt-BR" data-theme="dark">');
    expect(casca).not.toContain("/_next/");
    expect(casca).not.toMatch(/\b(?:src|href)="https?:/u);
  });

  it("roda o script do tema antes do corpo, e carrega a cor da marca", () => {
    const posicao = casca.indexOf(SCRIPT_DO_TEMA);
    expect(posicao).toBeGreaterThan(-1);
    expect(posicao).toBeLessThan(casca.indexOf("<body"));
    expect(casca).toContain(`<meta name="theme-color" content="${COR_DA_MARCA}">`);
  });

  it("mostra a marca embutida e a frase de espera, e mais nada que dependa de alguém", () => {
    expect(casca).toContain('alt="Resolve Aí"');
    expect(casca).toContain("data:image/svg+xml;base64,");
    expect(casca).toContain(FRASE_ABRINDO);
    // A casca não recebe nada além do ícone: não há de onde vir nome de organização ou de pessoa.
    expect(montarCasca.length).toBe(1);
  });

  it("as cores são as do globals.css, nos dois temas", () => {
    const css = ler("app/globals.css");
    const claro = /:root\s*\{([\s\S]*?)\n\}/u.exec(css)?.[1] ?? "";
    const escuro = /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/u.exec(css)?.[1] ?? "";
    for (const token of ["ground", "surface", "sunken", "ink", "ink-soft", "line"] as const) {
      const valor = (bloco: string) => new RegExp(`--${token}:\s*([^;]+);`, "u").exec(bloco)?.[1]?.trim();
      expect(CORES_DA_CASCA.claro[token], `claro ${token}`).toBe(valor(claro));
      expect(CORES_DA_CASCA.escuro[token], `escuro ${token}`).toBe(valor(escuro));
    }
  });
});

describe("o script da casca — a troca sozinha pela tela", () => {
  function rodar({ online, sonda }: { online: boolean; sonda: () => Promise<{ ok: boolean }> }) {
    const linha = { textContent: FRASE_ABRINDO };
    const recarregar = vi.fn();
    const buscar = vi.fn(sonda);
    new Function("document", "navigator", "fetch", "location", SCRIPT_DA_CASCA)(
      { getElementById: () => linha },
      { onLine: online },
      buscar,
      { reload: recarregar },
    );
    return { linha, recarregar, buscar };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pede a sonda com o cabeçalho e sem cache, e recarrega quando ela responde", async () => {
    const { recarregar, buscar } = rodar({ online: true, sonda: async () => ({ ok: true }) });
    await vi.runOnlyPendingTimersAsync();
    expect(buscar).toHaveBeenCalledWith(SONDA, { cache: "no-store", headers: { [CABECALHO_DA_SONDA]: "1" } });
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("sem conexão, troca a frase, não recarrega, e tenta de novo depois do intervalo", async () => {
    const { linha, recarregar, buscar } = rodar({
      online: false,
      sonda: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(linha.textContent).toBe(FRASE_SEM_CONEXAO);
    expect(recarregar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_SONDA_MS);
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("resposta ruim da sonda não recarrega, e tenta de novo", async () => {
    const { recarregar, buscar } = rodar({ online: true, sonda: async () => ({ ok: false }) });
    await vi.advanceTimersByTimeAsync(INTERVALO_DA_SONDA_MS);
    expect(recarregar).not.toHaveBeenCalled();
    expect(buscar).toHaveBeenCalledTimes(2);
  });
});
