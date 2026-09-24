/**
 * **O tema do produto: escuro por padrão, claro por escolha** (item 72).
 *
 * **A escolha mora num cookie, e não no `localStorage`.** A chave `theme` do `localStorage` já é do
 * `next-themes` que a documentação usa, e cookie deixa aberta a leitura no servidor se um dia o layout
 * raiz for dinâmico por outro motivo. Hoje ele não é, e é de propósito: ler `cookies()` ali tiraria a
 * aplicação inteira da pré-renderização, inclusive a documentação.
 *
 * **Por isso a regra existe duas vezes.** `temaDoCookie` roda no componente; `SCRIPT_DO_TEMA` roda como
 * texto no `<head>`, antes do React e antes da primeira pintura, e não pode importar nada. O
 * `tema.test.ts` aplica a mesma tabela às duas.
 */

export type Tema = "claro" | "escuro";

export const COOKIE_DO_TEMA = "tema";

/** O `id` do `<script>` no `<head>`; o ponta a ponta o procura no HTML cru. */
export const ID_DO_SCRIPT_DO_TEMA = "tema-antes-da-pintura";

const UM_ANO_EM_SEGUNDOS = 31_536_000;

/** Lê o `document.cookie` inteiro. Só `claro`, exato, é claro; o resto, inclusive a ausência, é escuro. */
export function temaDoCookie(cookies: string): Tema {
  const par = cookies
    .split(";")
    .map((pedaco) => pedaco.trim())
    .find((pedaco) => pedaco.startsWith(`${COOKIE_DO_TEMA}=`));
  return par?.slice(COOKIE_DO_TEMA.length + 1) === "claro" ? "claro" : "escuro";
}

export function atributoDoTema(tema: Tema): "dark" | "light" {
  return tema === "claro" ? "light" : "dark";
}

export function temaDoAtributo(atributo: string | null): Tema {
  return atributo === "light" ? "claro" : "escuro";
}

/**
 * **Sem `Secure`, de propósito.** O valor não é sensível, e o Chromium descarta `Secure` sobre `http://`
 * em host que não é loopback (achado A-10): a escolha sumiria em quem navega a pilha local por
 * `host.docker.internal`.
 */
export function cookieDoTema(tema: Tema): string {
  return `${COOKIE_DO_TEMA}=${tema}; path=/; max-age=${UM_ANO_EM_SEGUNDOS}; samesite=lax`;
}

/**
 * O corpo do `<script>` do `<head>`. O `<html>` já vem com `data-theme="dark"` do servidor; o script só
 * age quando a escolha é claro. O `try` cobre o navegador que recusa acesso ao cookie: aí fica o escuro.
 */
export const SCRIPT_DO_TEMA =
  `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${COOKIE_DO_TEMA}=([^;]*)/);` +
  `if(m&&m[1]==="claro")document.documentElement.setAttribute("data-theme","light")}catch(e){}})()`;
