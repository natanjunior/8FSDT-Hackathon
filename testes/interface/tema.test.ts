import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * **O guarda estrutural do tema.**
 *
 * Duas das exigências do item 44 não são de olho, e são exatamente as que se perdem em silêncio:
 *
 * 1. **Nenhum token pode ter definição única dentro de `@media` ou de `[data-theme]`.** Token que só
 *    exista lá dentro não se aplica no estado **não marcado** — que é o padrão de quem nunca escolheu
 *    tema. O defeito não aparece na máquina de quem implementa se ela estiver no escuro do sistema.
 * 2. **Os dois blocos escuros têm de ser idênticos.** Um está dentro de `@media` e o outro não, então
 *    **não há lista de seletores em CSS que os una** — a duplicação é estrutural e não tem saída. Se
 *    divergirem, *"escuro do sistema"* e *"escuro escolhido"* renderizam diferente, e nada percebe.
 *
 * É garantia mecânica em lugar de disciplina, como nas ADR-0001, 0003 e 0007 — aplicada à borda que ainda
 * não tinha. Na forma da ADR-0008 é **grupo 2**: não cresce com funcionalidade, cresce com token novo.
 */
/**
 * A folha **sem comentário nenhum**, e a poda não é higiene: é o que faz o guarda funcionar.
 *
 * Os blocos são achados por `indexOf` do seletor — e o cabeçalho que a Tarefa 2 escreve neste mesmo
 * arquivo **cita `:root[data-theme="dark"]` em prosa**, dezessete linhas antes do bloco de verdade. Com o
 * comentário no lugar, o `indexOf` para na citação, a contagem de chaves devolve o corpo do `:root`
 * **claro**, e o guarda passa a comparar o claro com o escuro achando que compara os dois escuros. Dois dos
 * cinco testes falham, e falham apontando para o lugar errado.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Devolve o corpo do bloco cujo seletor começa em `cabecalho`, contando chaves. */
function corpoDoBloco(cabecalho: string): string {
  const inicio = CSS.indexOf(cabecalho);
  if (inicio === -1) throw new Error(`Seletor não encontrado em app/globals.css: ${cabecalho}`);

  const abre = CSS.indexOf("{", inicio + cabecalho.length - 1);
  if (abre === -1) throw new Error(`Bloco sem abertura: ${cabecalho}`);

  let profundidade = 0;
  for (let i = abre; i < CSS.length; i += 1) {
    if (CSS[i] === "{") profundidade += 1;
    else if (CSS[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return CSS.slice(abre + 1, i);
    }
  }
  throw new Error(`Bloco sem fechamento: ${cabecalho}`);
}

/** Lê as declarações `--token: valor` de um corpo de bloco, com o espaço em branco normalizado. */
function tokensDe(corpo: string): Map<string, string> {
  const mapa = new Map<string, string>();

  // Sem poda de comentário aqui: ela já aconteceu em `CSS`, uma vez e para o arquivo inteiro.
  for (const pedaco of corpo.split(";")) {
    const encontrado = /(--[\w-]+)\s*:\s*([\s\S]+)/.exec(pedaco);
    if (encontrado !== null) {
      mapa.set(encontrado[1], encontrado[2].trim().replace(/\s+/g, " "));
    }
  }
  return mapa;
}

describe("app/globals.css — a estrutura de três estados", () => {
  const claro = tokensDe(corpoDoBloco(":root {"));
  const sistema = tokensDe(corpoDoBloco(':root:not([data-theme="light"])'));
  const escolhido = tokensDe(corpoDoBloco(':root[data-theme="dark"]'));

  it("acha e lê os três blocos", () => {
    // Sem isto, renomear um seletor faria TODAS as asserções abaixo passarem por vacuidade —
    // um mapa vazio satisfaz "nenhum token sem piso" e "os dois blocos são iguais".
    expect(claro.size).toBeGreaterThan(10);
    expect(sistema.size).toBeGreaterThan(10);
    expect(escolhido.size).toBeGreaterThan(10);
  });

  it("não tem token com definição única dentro de media ou de [data-theme]", () => {
    const semPisoNoClaro = [...sistema.keys(), ...escolhido.keys()]
      .filter((token) => !claro.has(token))
      .sort();

    expect(semPisoNoClaro).toEqual([]);
  });

  it("os dois blocos escuros declaram os mesmos tokens, com os mesmos valores", () => {
    expect(Object.fromEntries([...escolhido].sort())).toEqual(
      Object.fromEntries([...sistema].sort()),
    );
  });

  it("o raio é declarado uma vez, fora dos blocos escuros", () => {
    // O `.dark` do Meridian troca o raio das bordas junto com a cor. É resíduo do editor: ninguém
    // decide que o cantinho dos botões muda ao trocar o esquema de cor. Só cor muda.
    expect(claro.has("--radius")).toBe(true);
    expect(sistema.has("--radius")).toBe(false);
    expect(escolhido.has("--radius")).toBe(false);
  });

  it("não declara as famílias de fonte que o produto não carrega", () => {
    // O Meridian traz três. Serifada não tem consumidor, e monoespaçada cai na pilha do sistema —
    // declarar qualquer uma das duas aqui convida a carregá-la, e cada família pesa no build.
    for (const mapa of [claro, sistema, escolhido]) {
      expect(mapa.has("--font-serif")).toBe(false);
      expect(mapa.has("--font-mono")).toBe(false);
    }
  });
});
