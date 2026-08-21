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
 * `refs/` e `trabalho/` estão **fora**, e não por descuido: os dois são `.gitignore`, então num clone limpo
 * não existem — e um verificador que só passa na máquina de quem escreveu não verifica nada.
 */
const RAIZES_DE_DOCUMENTO = ["docs", "README.md", "CLAUDE.md"];

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
export function relatar(nome, { conferidos, unidade, falhas, notas = [] }) {
  const linhas = [];
  for (const nota of notas) linhas.push(`   · ${nota}`);

  if (falhas.length === 0) {
    console.log(`✓ ${nome}: ${conferidos} ${unidade} conferido(s), nenhuma falha.`);
    for (const linha of linhas) console.log(linha);
    return 0;
  }

  console.error(`✗ ${nome}: ${falhas.length} falha(s) em ${conferidos} ${unidade}.\n`);
  for (const falha of falhas) console.error(`   ${falha}`);
  console.error("");
  for (const linha of linhas) console.error(linha);
  return 1;
}
