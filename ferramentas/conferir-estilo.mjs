// O portão de estilo — item 44q, critério 13.
//
// **Mede a peça de verdade, e não uma cópia dela.** As peças que renderizam soltas são renderizadas com
// `react-dom/server`; as que só existem com portal Radix aberto, ou que são cadeia própria sem
// componente, entram pela constante exportada do próprio arquivo — a mesma string que o componente usa,
// lida da fonte. A sonda de 22/09/2026 guardava cadeias copiadas à mão, e uma cópia confere a si mesma.
//
// **O controle diferencial** é o mesmo idioma do `verificar:mermaid`: uma peça sabidamente errada tem de
// ser recusada. Sem ele, um verificador que não lê nada passaria verde.
//
// Roda por `tsx`, para importar `.tsx` com o apelido `@/` do `tsconfig.json`. Exige o Chromium do
// Playwright (`npx playwright install chromium`).
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";

import { cn } from "@/interface/componentes/utilitarios";
import { Button } from "@/interface/componentes/ui/button";
import { Badge, badgeVariants } from "@/interface/componentes/ui/badge";
import { sidebarMenuButtonVariants } from "@/interface/componentes/ui/sidebar";
import { CLASSE_DA_DICA } from "@/interface/componentes/ui/tooltip";
import { Input } from "@/interface/componentes/ui/input";
import { Textarea } from "@/interface/componentes/ui/textarea";
import { Checkbox } from "@/interface/componentes/ui/checkbox";
import { EmptyTitle } from "@/interface/componentes/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/interface/componentes/ui/toggle-group";
import { Avatar, AvatarFallback } from "@/interface/componentes/ui/avatar";
import { RODAPE_DO_MODAL } from "@/interface/componentes/modal";
import { SeloDeStatus } from "@/interface/componentes/selo-de-status";
import { ROTULO_DE_COLUNA, CELULA } from "@/interface/componentes/pecas-da-tabela";
import { CAIXA_DO_FILTRO, OPCAO_DO_FILTRO, CONTAGEM_DO_FILTRO } from "@/interface/componentes/filtro-rapido";
import { SeloDeNaoVista } from "@/interface/componentes/selo-de-nao-vista";
import { CLASSE_DA_LATERAL, CLASSE_DA_PILULA } from "@/interface/componentes/casca/sino";
import { Tabs, TabsList, TabsTrigger } from "@/interface/componentes/ui/tabs";
import { CLASSE_DA_ABA } from "@/interface/componentes/aba-da-configuracao";

// O `postcss` não é dependência declarada do projeto; é do `@tailwindcss/postcss`, e é por ele que se
// alcança, para não depender de como o `npm` achatou a árvore.
const doProjeto = createRequire(join(process.cwd(), "package.json"));
const tailwind = doProjeto("@tailwindcss/postcss");
const postcss = createRequire(doProjeto.resolve("@tailwindcss/postcss"))("postcss");

const div = (classe, texto = "") => `<div class="${classe}">${texto}</div>`;

/** Cada peça: como se monta, e o que se espera dela no tema escuro, em 1440 px. */
const PECAS = [
  {
    id: "selo",
    // Item 64: o status é a peça cheia da linha. *Em atendimento* era contorno até aqui, e é o caso que
    // prova o preenchimento.
    html: () => renderToStaticMarkup(h(SeloDeStatus, { status: "em_atendimento", rotulo: "Em atendimento" })),
    esperado: {
      "font-size": "11.5px",
      "font-weight": "600",
      "letter-spacing": "0.23px",
      "padding-left": "9px",
      "border-top-left-radius": "6px",
      "line-height": "17px",
      "background-color": "token(--info)",
      color: "token(--surface)",
    },
  },
  {
    id: "prioridade",
    // Item 64: contorno, sem fundo. Medida com a cadeia da `Alta`, a única com cor.
    html: () =>
      renderToStaticMarkup(
        h(Badge, { variant: "outline", className: "border-destructive text-destructive bg-transparent" }, "Alta"),
      ),
    esperado: {
      "background-color": "rgba(0, 0, 0, 0)",
      "border-top-color": "token(--destructive)",
      color: "token(--destructive)",
    },
  },
  {
    id: "botao-principal",
    html: () => renderToStaticMarkup(h(Button, { variant: "marca" }, "Resolver")),
    // X-01: 44, e não os 40 da prancheta.
    esperado: { "border-top-left-radius": "6px", "font-weight": "600", "min-height": "44px", "font-size": "13.5px" },
  },
  {
    id: "botao-so-icone",
    html: () => renderToStaticMarkup(h(Button, { variant: "outline", size: "icon" })),
    // X-01: 44, e não os 34 da prancheta.
    esperado: { "border-top-left-radius": "6px", width: "44px", height: "44px" },
  },
  {
    id: "campo",
    html: () => renderToStaticMarkup(h(Input, { id: "campo", defaultValue: "texto" })),
    esperado: {
      height: "44px",
      "border-top-left-radius": "6px",
      "background-color": "token(--ground)",
      "box-shadow": "none",
      "font-size": "14.5px",
    },
  },
  {
    id: "area-de-texto",
    // Item 104, critério 2: acima de `md` o que se digita tem o tamanho do que se lê depois.
    html: () => renderToStaticMarkup(h(Textarea, { id: "area", defaultValue: "texto" })),
    esperado: { "font-size": "14.5px", "border-top-left-radius": "6px" },
  },
  {
    id: "caixa-de-selecao",
    // Item 122: a peça nova da seleção de linhas. Medida marcada, que é o estado que veste a marca.
    html: () => renderToStaticMarkup(h(Checkbox, { checked: true, "aria-label": "Marcar" })),
    seletor: "[data-slot=checkbox]",
    esperado: {
      width: "16px",
      "border-top-left-radius": "4px",
      "background-color": "token(--accent)",
      "border-top-color": "token(--accent)",
    },
  },
  {
    id: "botao-sem-papel",
    // Item 104, critério 1: a chamada que não passa papel herda o da base, e a base é `interface`.
    html: () => renderToStaticMarkup(h(Button, { variant: "outline" }, "Carregar mais")),
    esperado: { "font-size": "13.5px" },
  },
  {
    id: "titulo-do-vazio",
    // Item 104, critério 3: sem `className`, o título do vazio já é título de bloco.
    html: () => renderToStaticMarkup(h(EmptyTitle, null, "Nenhuma ocorrência ainda.")),
    esperado: { "font-size": "19px", "font-weight": "600" },
  },
  {
    id: "cabecalho-de-coluna",
    html: () => `<table><thead><tr><th class="${ROTULO_DE_COLUNA}">Responsável</th></tr></thead></table>`,
    seletor: "th",
    esperado: {
      "background-color": "token(--ground)",
      "padding-top": "11px",
      "padding-bottom": "11px",
      "font-size": "10px",
      "letter-spacing": "1.1px",
    },
  },
  {
    id: "celula",
    html: () => `<table><tbody><tr><td class="${CELULA}">Beatriz Nunes</td></tr></tbody></table>`,
    seletor: "td",
    esperado: { "padding-top": "11px", "padding-bottom": "11px", "line-height": "19px" },
  },
  {
    id: "aba",
    html: () => `<button class="${OPCAO_DO_FILTRO}">Minhas ocorrências</button>`,
    // X-01: 44, e não os 38 da prancheta.
    esperado: { "border-top-left-radius": "6px", "padding-left": "13px", "min-height": "44px" },
  },
  {
    id: "aba-marcada",
    // Item 104, critério 9: a marcada veste o cromo, sem sombra.
    html: () => `<button data-state="on" class="${OPCAO_DO_FILTRO}">Minhas ocorrências</button>`,
    esperado: { "background-color": "token(--chrome)", "font-weight": "600", "box-shadow": "none" },
  },
  {
    id: "caixa-das-abas",
    // Item 104, critério 9: sem caixa. Item 120, bloco 13: sem régua. Mede a raiz do primitivo, com a base dele.
    html: () =>
      renderToStaticMarkup(
        h(ToggleGroup, { type: "single", className: CAIXA_DO_FILTRO }, h(ToggleGroupItem, { value: "todas", className: OPCAO_DO_FILTRO }, "Todas")),
      ),
    seletor: "[data-slot=toggle-group]",
    esperado: {
      "padding-top": "0px",
      "padding-bottom": "0px",
      "border-bottom-width": "0px",
      "background-color": "rgba(0, 0, 0, 0)",
    },
  },
  {
    id: "contagem",
    html: () => `<span class="${CONTAGEM_DO_FILTRO}">12</span>`,
    // (d): 11,5 e não 11 — o oitavo papel. Item 104: sobre o chão, a pílula veste o cromo.
    esperado: {
      "font-size": "11.5px",
      "padding-top": "1px",
      "padding-left": "7px",
      "background-color": "token(--chrome)",
    },
  },
  {
    id: "pilula-do-sino",
    // Item 118: a marca, e o quinto uso nomeado — o contador de não lidas. A *Um Primário Rule* vale
    // para ação; contagem não disputa com o principal da tela. O par `--marca-foreground` × `--accent`
    // está medido em `tema.test.ts`. A classe vem do componente, e não copiada.
    html: () => `<span class="${cn(badgeVariants({}), CLASSE_DA_PILULA)}">99+</span>`,
    esperado: {
      "background-color": "token(--accent)",
      color: "token(--marca-foreground)",
    },
  },
  {
    id: "selo-de-nao-vista",
    // Item 88: contorno, porque o cheio da linha é o selo de status. A borda leva a marca; o texto, a
    // tinta — `--accent` como texto reprova no tema claro, e é o item 89 que o conserta.
    html: () => renderToStaticMarkup(h(SeloDeNaoVista)),
    esperado: {
      "background-color": "rgba(0, 0, 0, 0)",
      "border-top-color": "token(--accent)",
      color: "token(--ink)",
    },
  },
  {
    id: "item-de-menu",
    // A peça, pelo `cn`, como o `SidebarMenuButton` a monta: os 13,5 / 17 vêm do tamanho `default`.
    html: () => `<button class="${cn(sidebarMenuButtonVariants({}))}">Ocorrências</button>`,
    esperado: {
      "font-size": "13.5px",
      "line-height": "17px",
      "border-top-left-radius": "6px",
      "padding-top": "6px",
      gap: "10px",
      "min-height": "44px",
    },
  },
  {
    id: "avatar",
    html: () => renderToStaticMarkup(h(Avatar, null, h(AvatarFallback, null, "HR"))),
    seletor: "[data-slot=avatar-fallback]",
    esperado: {
      "font-size": "11.5px",
      "font-weight": "600",
      color: "token(--ink)",
      "background-color": "token(--chrome)",
    },
  },
  {
    id: "dica",
    html: () => `<span class="${CLASSE_DA_DICA}">Remover da organização</span>`,
    esperado: {
      "font-weight": "500",
      "border-top-left-radius": "6px",
      "padding-top": "5px",
      "padding-left": "9px",
    },
  },
  {
    id: "rodape-de-modal",
    html: () => div(RODAPE_DO_MODAL),
    esperado: {
      "background-color": "token(--ground)",
      "border-top-width": "1px",
      "padding-top": "14px",
      "padding-left": "24px",
    },
  },
  {
    id: "titulo-de-pagina",
    html: () => `<h1 class="text-titulo-pagina">Ocorrências</h1>`,
    esperado: { "line-height": "31px", "font-weight": "600", "letter-spacing": "-0.546px" },
  },
  {
    id: "titulo-de-bloco",
    html: () => `<h2 class="text-titulo-bloco">O que foi relatado</h2>`,
    esperado: { "line-height": "25px", "font-weight": "600", "letter-spacing": "-0.228px" },
  },
  { id: "corpo", html: () => `<p class="text-corpo">A bomba faz um ruído.</p>`, esperado: { "line-height": "22px" } },
  { id: "interface", html: () => `<span class="text-interface">Onde</span>`, esperado: { "line-height": "19px" } },
  { id: "meta", html: () => `<span class="text-meta">Limpeza</span>`, esperado: { "line-height": "17px" } },
  {
    id: "aba-da-configuracao",
    // Item 120: a aba marcada em tinta, com 44 px de alvo. A régua de baixo é o `after` da variante line.
    html: () =>
      renderToStaticMarkup(
        h(Tabs, { defaultValue: "a" }, h(TabsList, { variant: "line" }, h(TabsTrigger, { value: "a", className: CLASSE_DA_ABA }, "Histórico"))),
      ),
    seletor: "[data-slot=tabs-trigger]",
    esperado: {
      "min-height": "44px",
      color: "token(--ink)",
    },
  },
  {
    id: "gaveta-lateral-do-sino",
    // Item 120: a lateral do sino sobre a superfície, sem cantos de cima.
    html: () => `<div class="${CLASSE_DA_LATERAL}">Avisos</div>`,
    esperado: {
      "background-color": "token(--surface)",
      "border-top-left-radius": "0px",
    },
  },
];

/** A peça sabidamente errada: o raio de 8 px que o item tirou do botão. Tem de ser recusada. */
const CONTROLE = {
  id: "controle-botao-com-raio-de-8",
  html: () => `<button class="rounded-md min-h-11">Errado</button>`,
  esperado: { "border-top-left-radius": "6px" },
};

/** Compila o `app/globals.css` do repositório com o Tailwind do repositório, varrendo só o HTML dado. */
async function compilar(pasta, html) {
  const arquivo = join(pasta, "pecas.html");
  writeFileSync(arquivo, html);
  const globais = readFileSync(join(process.cwd(), "app/globals.css"), "utf8").replace(
    '@import "tailwindcss";',
    `@import "tailwindcss" source(none);\n@source "${arquivo.replace(/\\/g, "/")}";`,
  );
  const { css } = await postcss([tailwind()]).process(globais, {
    from: join(process.cwd(), "app/globals.css"),
  });
  return css;
}

async function medir(pecas, tema) {
  const corpo = pecas.map((p) => `<div id="${p.id}">${p.html()}</div>`).join("\n");
  const pasta = mkdtempSync(join(tmpdir(), "conferir-estilo-"));
  try {
    const css = await compilar(pasta, corpo);
    const pagina = join(pasta, "pagina.html");
    writeFileSync(
      pagina,
      `<!doctype html><html data-theme="${tema}"><head><meta charset="utf-8"><style>${css}</style></head><body>${corpo}</body></html>`,
    );

    const navegador = await chromium.launch();
    try {
      const aba = await (await navegador.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      await aba.goto(pathToFileURL(pagina).href);
      return await aba.evaluate(
        (lista) => {
          /** `token(--x)` vira o computado de um elemento pintado com aquele token, no mesmo tema. */
          const resolver = (valor) => {
            const achado = /^token\((--[\w-]+)\)$/u.exec(valor);
            if (achado === null) return valor;
            const sonda = document.createElement("div");
            sonda.style.color = `var(${achado[1]})`;
            document.body.append(sonda);
            const cor = getComputedStyle(sonda).color;
            sonda.remove();
            return cor;
          };
          return lista.map(({ id, seletor, esperado }) => {
            const raiz = document.getElementById(id);
            const el = seletor ? raiz.querySelector(seletor) : raiz.firstElementChild;
            if (el === null) return [`${id} · a peça não foi renderizada`];
            const c = getComputedStyle(el);
            return Object.entries(esperado)
              .map(([prop, valor]) => [prop, resolver(valor), c.getPropertyValue(prop)])
              .filter(([, esperadoResolvido, medido]) => esperadoResolvido !== medido)
              .map(
                ([prop, esperadoResolvido, medido]) =>
                  `${id} · ${prop}: esperado ${esperadoResolvido}, medido ${medido}`,
              );
          });
        },
        pecas.map(({ id, seletor, esperado }) => ({ id, seletor, esperado })),
      );
    } finally {
      await navegador.close();
    }
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

const divergencias = (await medir(PECAS, "dark")).flat();
const controle = (await medir([CONTROLE], "dark")).flat();

if (controle.length === 0) {
  console.error("✗ o controle diferencial passou: o verificador não está medindo nada");
  process.exit(1);
}
if (divergencias.length > 0) {
  console.error(
    `✗ ${divergencias.length} divergência(s) entre a peça e a prancheta:\n  ${divergencias.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`✓ ${PECAS.length} peças batem com a prancheta, e o controle diferencial foi recusado`);
