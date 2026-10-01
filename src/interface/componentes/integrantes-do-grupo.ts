/**
 * ============================================================================
 *  Os integrantes do Grupo 1 — item 70
 * ============================================================================
 *
 * **Dado, e não página.** A página só desenha o que está aqui, e é aqui que os testes afirmam nome, RM,
 * cor e endereço. Um endereço novo é uma linha deste arquivo.
 *
 * **Os endereços são os que existem.** Quem não tem endereço não tem o campo, e o cartão não desenha o
 * botão: link sem endereço não vira link morto (critério 70.3).
 *
 * **As cinco cores são da paleta do produto**, sem token novo, e cada uma é distinta (critério 70.2). A
 * **forma** diz como a cor pinta o avatar em cada tema:
 *
 * | Forma | Fundo | Inicial |
 * |---|---|---|
 * | `clara` | a cor a 12% | a cor cheia |
 * | `cheia` | a cor cheia | `--marca-foreground` |
 *
 * **A forma é por tema porque o `--ok` não passa em nenhuma forma única.** Na clara ele dá 4,84:1 no claro e
 * 4,31:1 no escuro; na cheia, 3,28:1 no claro e 5,89:1 no escuro. `tema.test.ts` mede cada par na forma
 * declarada e exige 4,5:1, e é ele quem decide: trocar uma forma sem o teste passar não fecha.
 *
 * **Nenhum integrante veste a marca** (item 105): numa grade de cinco iguais, o laranja lia como hierarquia,
 * e é a cor da ação.
 *
 * **As classes são escritas por inteiro**, nunca montadas por interpolação: o Tailwind só gera a classe que
 * encontra escrita no código-fonte.
 */

export type CorDoAvatar = "tinta" | "ok" | "atencao" | "info" | "tinta-suave";
export type FormaDoAvatar = "clara" | "cheia";

export interface Integrante {
  readonly nome: string;
  readonly rm: string;
  readonly iniciais: string;
  readonly cor: CorDoAvatar;
  readonly forma: { readonly claro: FormaDoAvatar; readonly escuro: FormaDoAvatar };
  readonly linkedin?: string;
  readonly github?: string;
}

/** O token de cada cor em `app/globals.css`. */
export const TOKEN_DA_COR: Readonly<Record<CorDoAvatar, string>> = {
  tinta: "--ink",
  ok: "--ok",
  atencao: "--atencao",
  info: "--info",
  "tinta-suave": "--ink-soft",
};

export const INTEGRANTES: readonly Integrante[] = [
  {
    nome: "Dario Lacerda",
    rm: "369195",
    iniciais: "DL",
    cor: "tinta",
    forma: { claro: "clara", escuro: "clara" },
  },
  {
    nome: "Larissa Kramer",
    rm: "370062",
    iniciais: "LK",
    cor: "ok",
    forma: { claro: "clara", escuro: "cheia" },
    linkedin: "https://www.linkedin.com/in/larissa-cabral-k/",
    github: "https://github.com/larissacabral",
  },
  {
    nome: "Mirian Storino",
    rm: "369489",
    iniciais: "MS",
    cor: "atencao",
    forma: { claro: "cheia", escuro: "cheia" },
  },
  {
    nome: "Natanael Dias",
    rm: "369334",
    iniciais: "ND",
    cor: "info",
    forma: { claro: "clara", escuro: "clara" },
    linkedin: "https://www.linkedin.com/in/natanaeljr/",
    github: "https://github.com/natanjunior",
  },
  {
    nome: "Tiago Victor",
    rm: "370117",
    iniciais: "TV",
    cor: "tinta-suave",
    forma: { claro: "clara", escuro: "clara" },
  },
];

const NO_CLARO: Readonly<Record<FormaDoAvatar, Readonly<Record<CorDoAvatar, string>>>> = {
  clara: {
    tinta: "bg-tinta/12 text-tinta",
    ok: "bg-ok/12 text-ok",
    atencao: "bg-atencao/12 text-atencao",
    info: "bg-info/12 text-info",
    "tinta-suave": "bg-tinta-suave/12 text-tinta-suave",
  },
  cheia: {
    // Sem consumidor e sem medida: o tipo exige a chave, e o `tema.test.ts` mede só a forma declarada.
    // A inicial é `superficie` porque o `--ink` inverte entre os temas.
    tinta: "bg-tinta text-superficie",
    ok: "bg-ok text-marca-foreground",
    atencao: "bg-atencao text-marca-foreground",
    info: "bg-info text-marca-foreground",
    "tinta-suave": "bg-tinta-suave text-marca-foreground",
  },
};

const NO_ESCURO: Readonly<Record<FormaDoAvatar, Readonly<Record<CorDoAvatar, string>>>> = {
  clara: {
    tinta: "dark:bg-tinta/12 dark:text-tinta",
    ok: "dark:bg-ok/12 dark:text-ok",
    atencao: "dark:bg-atencao/12 dark:text-atencao",
    info: "dark:bg-info/12 dark:text-info",
    "tinta-suave": "dark:bg-tinta-suave/12 dark:text-tinta-suave",
  },
  cheia: {
    // Sem consumidor e sem medida, como a do claro.
    tinta: "dark:bg-tinta dark:text-superficie",
    ok: "dark:bg-ok dark:text-marca-foreground",
    atencao: "dark:bg-atencao dark:text-marca-foreground",
    info: "dark:bg-info dark:text-marca-foreground",
    "tinta-suave": "dark:bg-tinta-suave dark:text-marca-foreground",
  },
};

/** As classes do avatar: a forma do claro, e por cima a do escuro. */
export function classeDoAvatar({ cor, forma }: Integrante): string {
  return `${NO_CLARO[forma.claro][cor]} ${NO_ESCURO[forma.escuro][cor]}`;
}
