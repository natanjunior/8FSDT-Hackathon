import { createHash } from "node:crypto";

import {
  CABECALHO_DA_SONDA,
  JANELA_CONTRA_LACO_MS,
  LIMIAR_DE_FRIO_MS,
  MENSAGEM_DE_LIMPEZA,
  PRAZO_DA_REDE_MS,
  PREFIXO_DO_CACHE,
  SONDA,
  URL_DA_CASCA,
  URL_DA_HORA,
} from "./constantes";

/**
 * ============================================================================
 *  O trabalhador de serviço, em texto — item 98 e ADR-0020
 * ============================================================================
 *
 * **O que vai ao navegador é este texto**, e o teste roda o mesmo texto com `new Function`. Ele não passa
 * pelo empacotador, então é JavaScript simples, sem `import` e sem crase.
 *
 * **Faz uma coisa só**: numa abertura de página, decide entre a rede e a casca guardada, pela hora da
 * última resposta que viu (spec 98 §4.3). Nada do que vem da rede é gravado: o cache tem a casca e a hora,
 * e a igualdade de conjunto do teste é o critério 98.2.
 *
 * **A versão é o resumo do próprio script**, casca incluída. Muda a casca, um número ou a lógica, muda o
 * texto, e o navegador instala o trabalhador novo (critério 98.4).
 */
const CORPO = `
let cascaServida = null;

function respostaDaCasca() {
  return new Response(HTML_DA_CASCA, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

async function abrir() {
  return caches.open(NOME_DO_CACHE);
}

async function gravarHora(ms) {
  await (await abrir()).put(URL_DA_HORA, new Response(String(ms)));
}

async function lerHora() {
  const guardada = await (await abrir()).match(URL_DA_HORA);
  if (!guardada) return null;
  const ms = Number(await guardada.text());
  return Number.isFinite(ms) ? ms : null;
}

async function semear() {
  await (await abrir()).put(URL_DA_CASCA, respostaDaCasca());
  await gravarHora(Date.now());
}

async function casca() {
  const cache = await abrir();
  const guardada = await cache.match(URL_DA_CASCA);
  if (guardada) return guardada;
  await cache.put(URL_DA_CASCA, respostaDaCasca());
  return respostaDaCasca();
}

function servirCasca(url, agora) {
  cascaServida = { url: url, em: agora };
  return casca();
}

async function navegar(evento) {
  const pedido = evento.request;
  const agora = Date.now();
  const rede = fetch(pedido).then(async function (resposta) {
    await gravarHora(Date.now());
    return resposta;
  });
  evento.waitUntil(rede.then(function () {}, function () {}));

  const repetida =
    cascaServida !== null && cascaServida.url === pedido.url && agora - cascaServida.em < JANELA_CONTRA_LACO;
  if (repetida) {
    cascaServida = null;
    return rede.catch(function () { return servirCasca(pedido.url, agora); });
  }

  const hora = await lerHora();
  if (hora === null || agora - hora > LIMIAR_DE_FRIO) return servirCasca(pedido.url, agora);

  const prazo = new Promise(function (resolver) { setTimeout(function () { resolver(null); }, PRAZO_DA_REDE); });
  const primeira = await Promise.race([rede.catch(function () { return null; }), prazo]);
  return primeira !== null ? primeira : servirCasca(pedido.url, agora);
}

async function sondar(pedido) {
  const resposta = await fetch(pedido);
  if (resposta.ok) await gravarHora(Date.now());
  return resposta;
}

async function apagar(manter) {
  const nomes = await caches.keys();
  await Promise.all(nomes.filter(function (nome) { return nome !== manter; }).map(function (nome) { return caches.delete(nome); }));
}

self.addEventListener("install", function (evento) {
  evento.waitUntil(semear().then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(apagar(NOME_DO_CACHE).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (evento) {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  if (pedido.mode === "navigate") {
    evento.respondWith(navegar(evento));
    return;
  }
  if (url.pathname === SONDA && pedido.headers.get(CABECALHO_DA_SONDA) === "1") {
    evento.respondWith(sondar(pedido));
  }
});

self.addEventListener("message", function (evento) {
  if (!evento.data || evento.data.tipo !== MENSAGEM_DE_LIMPEZA) return;
  const porta = evento.ports && evento.ports[0];
  cascaServida = null;
  evento.waitUntil(
    apagar(null).then(semear).then(function () { if (porta) porta.postMessage("limpo"); }),
  );
});
`;

function cabecalho(casca: string): string {
  const j = JSON.stringify;
  return [
    `const NOME_DO_CACHE = ${j(PREFIXO_DO_CACHE)} + VERSAO;`,
    `const URL_DA_CASCA = ${j(URL_DA_CASCA)};`,
    `const URL_DA_HORA = ${j(URL_DA_HORA)};`,
    `const LIMIAR_DE_FRIO = ${LIMIAR_DE_FRIO_MS};`,
    `const PRAZO_DA_REDE = ${PRAZO_DA_REDE_MS};`,
    `const JANELA_CONTRA_LACO = ${JANELA_CONTRA_LACO_MS};`,
    `const SONDA = ${j(SONDA)};`,
    `const CABECALHO_DA_SONDA = ${j(CABECALHO_DA_SONDA)};`,
    `const MENSAGEM_DE_LIMPEZA = ${j(MENSAGEM_DE_LIMPEZA)};`,
    `const HTML_DA_CASCA = ${j(casca)};`,
  ].join("\n");
}

/** O resumo de tudo o que o script carrega, menos a linha da própria versão. */
export function versaoDoTrabalhador(casca: string): string {
  return createHash("sha256").update(cabecalho(casca)).update(CORPO).digest("hex").slice(0, 12);
}

export function montarScriptDoTrabalhador(casca: string): string {
  return `"use strict";\nconst VERSAO = ${JSON.stringify(versaoDoTrabalhador(casca))};\n${cabecalho(casca)}\n${CORPO}`;
}
