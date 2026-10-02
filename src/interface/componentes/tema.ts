/**
 * **O tema e o contraste do produto: escuro por padrão, claro por escolha** (item 72), e a chave de alto
 * contraste por cima (item 85).
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
 * **A chave de alto contraste** (item 85). Independente do tema e **vence** o tema: ligada, o bloco
 * `:root[data-contraste="alto"]` do `globals.css` pinta a paleta única, qualquer que seja o tema guardado.
 * Mesmo caminho do tema: cookie, e o script do `<head>` antes da primeira pintura.
 */
export type Contraste = "alto" | "normal";

export const COOKIE_DO_CONTRASTE = "contraste";

export const ATRIBUTO_DO_CONTRASTE = "data-contraste";

/** Só `alto`, exato, liga. O resto, inclusive a ausência, é normal. */
export function contrasteDoCookie(cookies: string): Contraste {
  const par = cookies
    .split(";")
    .map((pedaco) => pedaco.trim())
    .find((pedaco) => pedaco.startsWith(`${COOKIE_DO_CONTRASTE}=`));
  return par?.slice(COOKIE_DO_CONTRASTE.length + 1) === "alto" ? "alto" : "normal";
}

export function contrasteDoAtributo(atributo: string | null): Contraste {
  return atributo === "alto" ? "alto" : "normal";
}

/** Sem `Secure`, pela mesma razão do cookie do tema. Grava `normal` também: escolha é escolha. */
export function cookieDoContraste(contraste: Contraste): string {
  return `${COOKIE_DO_CONTRASTE}=${contraste}; path=/; max-age=${UM_ANO_EM_SEGUNDOS}; samesite=lax`;
}

/** Normal é a **ausência** do atributo, e não um valor: o CSS só precisa conhecer o alto. */
export function aplicarContraste(
  raiz: { setAttribute(nome: string, valor: string): void; removeAttribute(nome: string): void },
  contraste: Contraste,
): void {
  if (contraste === "alto") raiz.setAttribute(ATRIBUTO_DO_CONTRASTE, "alto");
  else raiz.removeAttribute(ATRIBUTO_DO_CONTRASTE);
}

/**
 * **O tema que a tela pinta, e não o que o cookie guarda** (item 114, critério 3). Com o alto contraste
 * ligado, `:root[data-contraste="alto"]` tem `color-scheme: dark` e a variante `dark` vale para ele
 * (`app/globals.css:16-18`): o que se vê é escuro, e é isso que o item de tema anuncia. O tema guardado
 * não é tocado, e volta quando o contraste sai.
 */
export function temaExibido(tema: Tema, contraste: Contraste): Tema {
  return contraste === "alto" ? "escuro" : tema;
}

/**
 * O corpo do `<script>` do `<head>`. O `<html>` já vem com `data-theme="dark"` do servidor e sem
 * `data-contraste`; o script só age quando a escolha é claro, ou alto. **Um script para os dois**: uma
 * execução antes da primeira pintura. O `try` cobre o navegador que recusa acesso ao cookie: fica o padrão.
 */
export const SCRIPT_DO_TEMA =
  `(function(){try{var c=document.cookie,d=document.documentElement;` +
  `var t=c.match(/(?:^|;\\s*)${COOKIE_DO_TEMA}=([^;]*)/);` +
  `if(t&&t[1]==="claro")d.setAttribute("data-theme","light");` +
  `var k=c.match(/(?:^|;\\s*)${COOKIE_DO_CONTRASTE}=([^;]*)/);` +
  `if(k&&k[1]==="alto")d.setAttribute("${ATRIBUTO_DO_CONTRASTE}","alto")}catch(e){}})()`;
