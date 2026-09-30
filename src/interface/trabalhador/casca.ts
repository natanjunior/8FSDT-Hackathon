import { SCRIPT_DO_TEMA } from "@/interface/componentes/tema";
import { COR_DA_MARCA } from "@/interface/manifesto";

import {
  CABECALHO_DA_SONDA,
  FRASE_ABRINDO,
  FRASE_SEM_CONEXAO,
  INTERVALO_DA_SONDA_MS,
  SONDA,
} from "./constantes";

/**
 * ============================================================================
 *  A casca guardada — item 98
 * ============================================================================
 *
 * **Uma casca desenhada para ser guardada**, e não a das telas de dentro: aquela recebe a organização
 * ativa, o nome e o e-mail da pessoa (`app/(casca)/layout.tsx`), e guardá-la levaria dado de uma
 * organização para o navegador, fora do ponto único da ADR-0003. Esta é igual para todo mundo e para toda
 * rota, e a função não recebe nada além do ícone: não há de onde vir dado.
 *
 * **Autocontida.** CSS, script e marca vão dentro do documento, então pintá-la não depende de nenhum
 * pedaço do build. A fonte é a do sistema: a Geist mora em `/_next/static/media` e entraria no cache só
 * para uma tela de segundos. O alto contraste fica de fora pela mesma razão.
 *
 * **A forma é a dos `loading.tsx` de `app/(casca)/`**: marca de verdade na barra, esqueleto no corpo.
 */

type Token = "ground" | "surface" | "sunken" | "ink" | "ink-soft" | "line";

/** Os literais do `globals.css`; o teste prende a igualdade, então trocar lá sem trocar aqui quebra. */
export const CORES_DA_CASCA: { escuro: Record<Token, string>; claro: Record<Token, string> } = {
  escuro: {
    ground: "oklch(0.2037 0.0110 260.6650)",
    surface: "oklch(0.2425 0.0147 261.6545)",
    sunken: "oklch(0.2758 0.0182 262.1965)",
    ink: "oklch(0.9335 0.0087 264.5206)",
    "ink-soft": "oklch(0.6756 0.0235 265.6880)",
    line: "oklch(0.3546 0.0230 261.2175)",
  },
  claro: {
    ground: "oklch(0.9545 0.0046 258.3249)",
    surface: "oklch(1.0000 0 0)",
    sunken: "oklch(0.9367 0.0058 264.5315)",
    ink: "oklch(0.2217 0.0126 264.2756)",
    "ink-soft": "oklch(0.4905 0.0298 270.7441)",
    line: "oklch(0.8525 0.0141 258.3489)",
  },
};

function variaveis(cores: Record<Token, string>): string {
  return Object.entries(cores)
    .map(([token, valor]) => `--${token}:${valor}`)
    .join(";");
}

const CSS =
  `:root{color-scheme:dark;${variaveis(CORES_DA_CASCA.escuro)}}` +
  `:root[data-theme="light"]{color-scheme:light;${variaveis(CORES_DA_CASCA.claro)}}` +
  `*{box-sizing:border-box;margin:0}` +
  `body{min-height:100dvh;background:var(--ground);color:var(--ink);` +
  `font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}` +
  `header{height:56px;display:flex;align-items:center;padding:0 16px;` +
  `background:var(--surface);border-bottom:1px solid var(--line)}` +
  `header img{height:20px;width:auto}` +
  `main{padding:24px 16px;max-width:64rem}` +
  `@media(min-width:768px){header{height:60px;padding:0 24px}main{padding:24px}}` +
  `.linha{font-size:.84375rem;color:var(--ink-soft);margin-bottom:16px}` +
  `.bloco{background:var(--sunken);border-radius:8px}` +
  `.titulo{height:28px;width:12rem;margin-bottom:24px}` +
  `.item{height:64px;margin-bottom:8px}` +
  `@media(prefers-reduced-motion:no-preference){.bloco{animation:pulsar 1.6s ease-in-out infinite}}` +
  `@keyframes pulsar{50%{opacity:.55}}`;

/**
 * **A troca sozinha pela tela.** Pergunta pela sonda até ela responder e recarrega a própria URL; a
 * recarga chega a um contêiner acordado. A sonda nunca é página autenticada, que renderizaria conteúdo de
 * organização só para descartá-lo. Roda sem nada do React, e o teste a executa com `new Function`.
 */
export const SCRIPT_DA_CASCA =
  `(function(){var l=document.getElementById("linha-da-casca");` +
  `function semRede(){if(l)l.textContent=${JSON.stringify(FRASE_SEM_CONEXAO)}}` +
  `function tentar(){fetch(${JSON.stringify(SONDA)},{cache:"no-store",headers:{${JSON.stringify(CABECALHO_DA_SONDA)}:"1"}})` +
  `.then(function(r){if(r.ok){location.reload();return}setTimeout(tentar,${INTERVALO_DA_SONDA_MS})},` +
  `function(){semRede();setTimeout(tentar,${INTERVALO_DA_SONDA_MS})})}` +
  `if(navigator.onLine===false)semRede();tentar()})()`;

export function montarCasca({ iconeSvg }: { iconeSvg: string }): string {
  const icone = Buffer.from(iconeSvg, "utf8").toString("base64");
  return (
    `<!doctype html><html lang="pt-BR" data-theme="dark"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="theme-color" content="${COR_DA_MARCA}"><title>Resolve Aí</title>` +
    `<script>${SCRIPT_DO_TEMA}</script><style>${CSS}</style></head>` +
    `<body><header><img src="data:image/svg+xml;base64,${icone}" alt="Resolve Aí" width="1412" height="1240">` +
    `</header><main aria-busy="true"><p class="linha" id="linha-da-casca" role="status">${FRASE_ABRINDO}</p>` +
    `<div class="bloco titulo"></div><div class="bloco item"></div><div class="bloco item"></div>` +
    `<div class="bloco item"></div></main><script>${SCRIPT_DA_CASCA}</script></body></html>`
  );
}
