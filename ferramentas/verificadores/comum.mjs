import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ============================================================================
 *  O que os três verificadores compartilham
 * ============================================================================
 *
 * Eles existiam antes desta tarefa e rodavam **fora do repositório**, em conversas de revisão. O Definition
 * of Done já os exige no pipeline, então esta é a tarefa em que nascem como código — e como código que
 * **falha o build**.
 *
 * Node puro, sem dependência a mais além do `yaml` e do `mermaid`, que já estavam previstos. Ficam fora do
 * `tsconfig.json` e do `eslint.config.mjs` de propósito: são ferramenta de esteira, não código de produto,
 * e não têm por que carregar as regras de fronteira de uma arquitetura que não habitam.
 */

export const RAIZ = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/**
 * O que os verificadores varrem.
 *
 * `refs/`, `trabalho/` e `CLAUDE.md` estão **fora**, e não por descuido: os três são `.gitignore`, então
 * num clone limpo não existem — e um verificador que só passa na máquina de quem escreveu não verifica
 * nada. O `CLAUDE.md` saiu em 22/08/2026, quando passou a ser ignorado; enquanto esteve aqui, as seis
 * seções dele entravam no universo conferido e o número era diferente na máquina e no clone.
 */
const RAIZES_DE_DOCUMENTO = ["docs", "README.md"];

const IGNORADOS = new Set([
  "node_modules",
  ".git",
  ".next",
  "refs",
  "trabalho",
  ".tmp",
  // O controle negativo mora aqui e é **para** falhar: varrê-lo junto quebraria o verificador de
  // propósito errado.
  "fixtures",
]);

export function documentos(extensoes = [".md", ".mmd"]) {
  const achados = [];

  for (const alvo of RAIZES_DE_DOCUMENTO) {
    const caminho = join(RAIZ, alvo);
    let info;
    try {
      info = statSync(caminho);
    } catch {
      continue;
    }
    if (info.isDirectory()) andar(caminho, extensoes, achados);
    else if (extensoes.some((e) => caminho.endsWith(e))) achados.push(caminho);
  }

  return achados.sort();
}

function andar(diretorio, extensoes, achados) {
  for (const entrada of readdirSync(diretorio, { withFileTypes: true })) {
    if (IGNORADOS.has(entrada.name)) continue;
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) andar(caminho, extensoes, achados);
    else if (extensoes.some((e) => entrada.name.endsWith(e))) achados.push(caminho);
  }
}

export const curto = (caminho) => relative(RAIZ, caminho).replaceAll("\\", "/");

export const ler = (caminho) => readFileSync(caminho, "utf8");

/**
 * O relatório.
 *
 * Um verificador que imprime "ok" e sai com zero não prova nada — imprimir **quanto** foi conferido é o que
 * distingue "passou" de "não rodou". É o mesmo princípio do `passWithNoTests: false`.
 */
/**
 * **O plural, e por que ele deixou de ser `(s)`** *(02/09/2026)*
 *
 * O idioma deste pacote era o sufixo `(s)` — `conferido(s)`, `falha(s)` — para não escrever lógica de
 * plural. Só que a `unidade` ficava de fora dele, e a saída dizia *"5 falha(s) em 5 **campo**"* e
 * *"9 **bloco** conferido(s)"*. Pôr `(s)` nela também consertaria `bloco` e `campo` e **estragaria**
 * `operação`: `operação(s)` não é português — o plural é *operações*.
 *
 * Então a contagem passa a decidir a palavra, e quem tem plural irregular ou gênero feminino o
 * **declara**. É a única forma que não obriga um pluralizador de pt-BR dentro de um verificador de
 * documentação — e concordância pela metade (*"operações conferidos"*) é pior que o `(s)` que havia antes.
 */
export function relatar(nome, { conferidos, unidade, plural, genero = "m", falhas, notas = [] }) {
  const linhas = [];
  for (const nota of notas) linhas.push(`   · ${nota}`);

  /** Sem `plural` declarado, o padrão é `+s` — certo para `bloco`, `campo`, `aspecto` e `referência`. */
  const aUnidade = conferidos === 1 ? unidade : (plural ?? `${unidade}s`);
  const raiz = genero === "f" ? "conferida" : "conferido";
  const conferido = conferidos === 1 ? raiz : `${raiz}s`;

  if (falhas.length === 0) {
    console.log(`✓ ${nome}: ${conferidos} ${aUnidade} ${conferido}, nenhuma falha.`);
    for (const linha of linhas) console.log(linha);
    return 0;
  }

  const quantas = falhas.length === 1 ? "1 falha" : `${falhas.length} falhas`;
  console.error(`✗ ${nome}: ${quantas} em ${conferidos} ${aUnidade}.\n`);
  for (const falha of falhas) console.error(`   ${falha}`);
  console.error("");
  for (const linha of linhas) console.error(linha);
  return 1;
}
