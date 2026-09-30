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
  JANELA_CONTRA_LACO_MS,
  LIMIAR_DE_FRIO_MS,
  MENSAGEM_DE_LIMPEZA,
  PRAZO_DA_REDE_MS,
  PREFIXO_DO_CACHE,
  SONDA,
  URL_DA_CASCA,
  URL_DA_HORA,
} from "@/interface/trabalhador/constantes";
import { montarScriptDoTrabalhador, versaoDoTrabalhador } from "@/interface/trabalhador/script";

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

const ORIGEM = "https://resolve.exemplo";
const absoluta = (chave: string | { url: string }) =>
  new URL(typeof chave === "string" ? chave : chave.url, ORIGEM).href;

class CacheFalso {
  readonly entradas = new Map<string, Response>();
  async put(chave: string | { url: string }, resposta: Response) {
    this.entradas.set(absoluta(chave), resposta.clone());
  }
  async match(chave: string | { url: string }) {
    return this.entradas.get(absoluta(chave))?.clone();
  }
  async keys() {
    return [...this.entradas.keys()].map((url) => ({ url }));
  }
}

class CachesFalsos {
  readonly porNome = new Map<string, CacheFalso>();
  async open(nome: string) {
    const existente = this.porNome.get(nome);
    if (existente !== undefined) return existente;
    const novo = new CacheFalso();
    this.porNome.set(nome, novo);
    return novo;
  }
  async keys() {
    return [...this.porNome.keys()];
  }
  async delete(nome: string) {
    return this.porNome.delete(nome);
  }
  /** Todas as URLs guardadas, em todos os caches, ordenadas. */
  urls(): string[] {
    return [...this.porNome.values()].flatMap((cache) => [...cache.entradas.keys()]).sort();
  }
}

type PedidoFalso = { url: string; method: string; mode: string; headers: Headers };

function pedido(
  caminho: string,
  {
    method = "GET",
    mode = "navigate",
    headers = {},
  }: { method?: string; mode?: string; headers?: Record<string, string> } = {},
): PedidoFalso {
  return { url: new URL(caminho, ORIGEM).href, method, mode, headers: new Headers(headers) };
}

const NUNCA = () => new Promise<Response>(() => {});

function subir(script: string, rede: (p: PedidoFalso) => Promise<Response>) {
  type Ouvinte = (evento: Record<string, unknown>) => void;
  const ouvintes = new Map<string, Ouvinte>();
  const caches = new CachesFalsos();
  const pedidosARede: PedidoFalso[] = [];
  const self = {
    location: { origin: ORIGEM },
    addEventListener: (tipo: string, ouvinte: Ouvinte) => ouvintes.set(tipo, ouvinte),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  const buscarNaRede = (p: PedidoFalso) => {
    pedidosARede.push(p);
    return rede(p);
  };
  new Function("self", "caches", "fetch", script)(self, caches, buscarNaRede);

  async function estender(tipo: string, extra: Record<string, unknown> = {}) {
    const pendentes: Promise<unknown>[] = [];
    ouvintes.get(tipo)?.({ ...extra, waitUntil: (p: Promise<unknown>) => pendentes.push(p) });
    await Promise.all(pendentes);
  }

  function buscar(p: PedidoFalso) {
    let resposta: Promise<Response> | undefined;
    const pendentes: Promise<unknown>[] = [];
    ouvintes.get("fetch")?.({
      request: p,
      respondWith: (r: Promise<Response>) => {
        resposta = r;
      },
      waitUntil: (w: Promise<unknown>) => pendentes.push(w),
    });
    return { resposta, pendentes };
  }

  async function hora(): Promise<number | null> {
    for (const cache of caches.porNome.values()) {
      const r = await cache.match(URL_DA_HORA);
      if (r !== undefined) return Number(await r.text());
    }
    return null;
  }

  return {
    self,
    caches,
    pedidosARede,
    buscar,
    hora,
    instalar: () => estender("install"),
    ativar: () => estender("activate"),
    mensagem: (data: unknown, porta?: { postMessage: (m: unknown) => void }) =>
      estender("message", { data, ports: porta === undefined ? [] : [porta] }),
  };
}

const CASCA = montarCasca({ iconeSvg: ICONE });
const SCRIPT = montarScriptDoTrabalhador(CASCA);
const NOME_DO_CACHE = PREFIXO_DO_CACHE + versaoDoTrabalhador(CASCA);
const T0 = new Date("2026-10-09T12:00:00.000Z").getTime();

describe("o trabalhador: quando a casca aparece — critério 98.1, decidido em respostas.md P1", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it("com a última resposta há mais de 4 min, a casca vem na hora, sem esperar a rede", async () => {
    const t = subir(SCRIPT, NUNCA);
    await t.instalar();
    vi.setSystemTime(T0 + LIMIAR_DE_FRIO_MS + 1);
    const { resposta } = t.buscar(pedido("/ocorrencias"));
    expect(await (await resposta!).text()).toContain(FRASE_ABRINDO);
    // E a navegação original foi à rede, que é o que acorda o contêiner.
    expect(t.pedidosARede.map((p) => p.url)).toStrictEqual([`${ORIGEM}/ocorrencias`]);
  });

  it("sem hora registrada, também é casca na hora", async () => {
    const t = subir(SCRIPT, NUNCA);
    await t.instalar();
    (await t.caches.open(NOME_DO_CACHE)).entradas.delete(absoluta(URL_DA_HORA));
    const { resposta } = t.buscar(pedido("/ocorrencias"));
    expect(await (await resposta!).text()).toContain(FRASE_ABRINDO);
  });

  it("com resposta recente e rede em tempo, a tela vem da rede, e a hora anda", async () => {
    const t = subir(SCRIPT, async () => new Response("tela de verdade", { status: 200 }));
    await t.instalar();
    vi.setSystemTime(T0 + 60_000);
    const { resposta, pendentes } = t.buscar(pedido("/ocorrencias"));
    expect(await (await resposta!).text()).toBe("tela de verdade");
    await Promise.all(pendentes);
    expect(await t.hora()).toBe(T0 + 60_000);
  });

  it("com resposta recente e rede lenta, a casca vem no prazo, e não antes", async () => {
    const t = subir(SCRIPT, NUNCA);
    await t.instalar();
    let chegou = false;
    const { resposta } = t.buscar(pedido("/ocorrencias"));
    void resposta!.then(() => {
      chegou = true;
    });
    await vi.advanceTimersByTimeAsync(PRAZO_DA_REDE_MS - 1);
    expect(chegou).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await resposta!).text()).toContain(FRASE_ABRINDO);
  });

  it("sem rede, a casca vem, mesmo com resposta recente", async () => {
    const t = subir(SCRIPT, () => Promise.reject(new TypeError("Failed to fetch")));
    await t.instalar();
    const { resposta } = t.buscar(pedido("/ocorrencias"));
    expect(await (await resposta!).text()).toContain(FRASE_ABRINDO);
  });

  it("a navegação repetida logo depois da casca vai à rede sem prazo (a recarga não cai em laço)", async () => {
    let chamadas = 0;
    const t = subir(SCRIPT, () => {
      chamadas += 1;
      if (chamadas === 1) return NUNCA();
      return new Promise<Response>((resolver) => setTimeout(() => resolver(new Response("tela")), 10_000));
    });
    await t.instalar();
    vi.setSystemTime(T0 + LIMIAR_DE_FRIO_MS + 1);
    const primeira = t.buscar(pedido("/ocorrencias"));
    expect(await (await primeira.resposta!).text()).toContain(FRASE_ABRINDO);
    vi.setSystemTime(T0 + LIMIAR_DE_FRIO_MS + 5_000);
    const segunda = t.buscar(pedido("/ocorrencias"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await (await segunda.resposta!).text()).toBe("tela");
  });

  it("passada a janela contra laço, a mesma URL volta à regra normal", async () => {
    const t = subir(SCRIPT, NUNCA);
    await t.instalar();
    vi.setSystemTime(T0 + LIMIAR_DE_FRIO_MS + 1);
    await t.buscar(pedido("/ocorrencias")).resposta;
    vi.setSystemTime(T0 + LIMIAR_DE_FRIO_MS + 1 + JANELA_CONTRA_LACO_MS + 1);
    const { resposta } = t.buscar(pedido("/ocorrencias"));
    expect(await (await resposta!).text()).toContain(FRASE_ABRINDO);
  });

  it("código de erro também prova contêiner acordado: a resposta passa como veio, e a hora anda", async () => {
    const t = subir(SCRIPT, async () => new Response("falhou", { status: 500 }));
    await t.instalar();
    vi.setSystemTime(T0 + 1_000);
    const { resposta, pendentes } = t.buscar(pedido("/ocorrencias"));
    expect((await resposta!).status).toBe(500);
    await Promise.all(pendentes);
    expect(await t.hora()).toBe(T0 + 1_000);
  });

  it("a sonda da casca grava a hora quando responde", async () => {
    const t = subir(SCRIPT, async () => new Response("User-agent: *", { status: 200 }));
    await t.instalar();
    vi.setSystemTime(T0 + LIMIAR_DE_FRIO_MS + 1);
    const { resposta } = t.buscar(pedido(SONDA, { mode: "cors", headers: { [CABECALHO_DA_SONDA]: "1" } }));
    expect((await resposta!).ok).toBe(true);
    expect(await t.hora()).toBe(T0 + LIMIAR_DE_FRIO_MS + 1);
  });
});

describe("o trabalhador: o que ele não toca — critério 98.2", () => {
  it.each([
    ["POST de navegação", pedido("/ocorrencias", { method: "POST" })],
    ["API", pedido("/api/ocorrencias", { mode: "cors" })],
    ["dado de RSC", pedido("/ocorrencias?_rsc=abc", { mode: "cors", headers: { RSC: "1" } })],
    ["anexo", pedido("/api/ocorrencias/1/anexos/2", { mode: "no-cors" })],
    ["a sonda sem o cabeçalho", pedido(SONDA, { mode: "cors" })],
    ["navegação de outra origem", { ...pedido("/"), url: "https://outro.exemplo/" }],
  ])("%s passa direto: o trabalhador não responde nem vai à rede", async (_nome, p) => {
    const t = subir(SCRIPT, async () => new Response("x"));
    await t.instalar();
    const { resposta } = t.buscar(p);
    expect(resposta).toBeUndefined();
    expect(t.pedidosARede).toHaveLength(0);
  });

  it("depois de páginas, API e documentação, o cache tem exatamente a casca e a hora", async () => {
    const t = subir(SCRIPT, async (p) => new Response(`conteúdo da organização em ${p.url}`));
    await t.instalar();
    const caminhos = ["/ocorrencias", "/ocorrencias/0b9f", "/vinculos", "/dashboard", "/documentacao/README"];
    for (const caminho of caminhos) {
      const { resposta, pendentes } = t.buscar(pedido(caminho));
      await resposta;
      await Promise.all(pendentes);
    }
    t.buscar(pedido("/api/ocorrencias", { mode: "cors" }));

    expect([...t.caches.porNome.keys()]).toStrictEqual([NOME_DO_CACHE]);
    expect(t.caches.urls()).toStrictEqual([absoluta(URL_DA_CASCA), absoluta(URL_DA_HORA)].sort());
    for (const cache of t.caches.porNome.values()) {
      for (const guardada of cache.entradas.values()) {
        expect(await guardada.clone().text()).not.toContain("conteúdo da organização");
      }
    }
  });
});

describe("o trabalhador: versão nova e saída — critérios 98.3 e 98.4", () => {
  it("a ativação apaga todo cache de outro nome, assume na hora e toma as abas abertas", async () => {
    const t = subir(SCRIPT, async () => new Response("x"));
    await (await t.caches.open(`${PREFIXO_DO_CACHE}versao-velha`)).put("/qualquer", new Response("velho"));
    await (await t.caches.open("outro-cache")).put("/outro", new Response("outro"));
    await t.instalar();
    await t.ativar();
    expect([...t.caches.porNome.keys()]).toStrictEqual([NOME_DO_CACHE]);
    expect(t.self.skipWaiting).toHaveBeenCalledTimes(1);
    expect(t.self.clients.claim).toHaveBeenCalledTimes(1);
  });

  it("a limpeza apaga todos os caches, volta a semear só a casca e a hora, e responde", async () => {
    const t = subir(SCRIPT, async () => new Response("conteúdo"));
    await t.instalar();
    await (await t.caches.open("sobra")).put("/sobra", new Response("sobra"));
    const porta = { postMessage: vi.fn() };
    await t.mensagem({ tipo: MENSAGEM_DE_LIMPEZA }, porta);
    expect([...t.caches.porNome.keys()]).toStrictEqual([NOME_DO_CACHE]);
    expect(t.caches.urls()).toStrictEqual([absoluta(URL_DA_CASCA), absoluta(URL_DA_HORA)].sort());
    expect(porta.postMessage).toHaveBeenCalledWith("limpo");
  });

  it("mensagem de outro tipo não apaga nada", async () => {
    const t = subir(SCRIPT, async () => new Response("x"));
    await t.instalar();
    await (await t.caches.open("sobra")).put("/sobra", new Response("sobra"));
    await t.mensagem({ tipo: "outra" });
    expect(t.caches.porNome.has("sobra")).toBe(true);
  });

  it("dois builds iguais dão o mesmo script; uma casca diferente dá outra versão e outro script", () => {
    expect(montarScriptDoTrabalhador(CASCA)).toBe(SCRIPT);
    expect(versaoDoTrabalhador(CASCA)).toMatch(/^[0-9a-f]{12}$/u);
    expect(versaoDoTrabalhador(`${CASCA} `)).not.toBe(versaoDoTrabalhador(CASCA));
    expect(montarScriptDoTrabalhador(`${CASCA} `)).not.toBe(SCRIPT);
    expect(SCRIPT).toContain(JSON.stringify(versaoDoTrabalhador(CASCA)));
  });
});

describe("a fiação do trabalhador", () => {
  it("a rota serve o script montado, como JavaScript e sem cache HTTP", () => {
    const rota = ler("app/sw.js/route.ts");
    // Por regex: a rota quebra a linha entre as duas chamadas, e o formatador pode mudar a quebra.
    expect(rota).toMatch(/montarScriptDoTrabalhador\(\s*montarCasca\(/u);
    expect(rota).toContain('"application/javascript; charset=utf-8"');
    expect(rota).toContain('"cache-control": "no-cache"');
    expect(rota).toContain('"public/marca/icone.svg"');
  });

  it("o registro só acontece em produção, com escopo raiz e sem cache HTTP do script", () => {
    const registro = ler("src/interface/componentes/registro-do-trabalhador.tsx");
    expect(registro.startsWith('"use client";')).toBe(true);
    expect(registro).toContain('process.env.NODE_ENV !== "production"');
    expect(registro).toContain('scope: "/"');
    expect(registro).toContain('updateViaCache: "none"');
  });

  it("o casco monta o registro uma vez", () => {
    expect(ler("app/layout.tsx").match(/<RegistroDoTrabalhador \/>/gu)).toHaveLength(1);
  });

  it("o ponta a ponta bloqueia o trabalhador por padrão, e só o retorno o libera", () => {
    expect(ler("playwright.config.ts")).toContain('serviceWorkers: "block"');
    const jornada = ler("testes/ponta-a-ponta/nascimento-de-organizacao.spec.ts");
    expect(jornada.match(/serviceWorkers: "allow"/gu)).toHaveLength(1);
  });
});
