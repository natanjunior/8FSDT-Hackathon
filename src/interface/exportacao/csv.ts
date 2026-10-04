import { diaDoArquivo } from "@/interface/componentes/datas";

/**
 * ============================================================================
 *  O CSV que abre no Excel em pt-BR — item 124
 * ============================================================================
 *
 * Construção de texto, sem biblioteca (critério 7). As quatro decisões que fazem o arquivo abrir certo:
 *
 * | Decisão | Por quê |
 * |---|---|
 * | BOM UTF-8 nos primeiros bytes | sem ele o Excel lê em ANSI e quebra os acentos |
 * | `;` como separador | é o que o Excel em pt-BR espera, porque a vírgula é a casa decimal |
 * | CRLF entre registros, e no fim | é o fim de linha do Excel no Windows (RFC 4180) |
 * | aspas só quando a célula tem `;`, `"`, CR ou LF, e `"` vira `""` | a quebra de linha da descrição fica dentro da célula |
 *
 * E a quinta, que é de segurança (critério 10): texto que começa com `=`, `+`, `-`, `@`, TAB ou CR ganha um
 * apóstrofo na frente, para a planilha o mostrar como texto. Título e descrição são escritos pelo
 * Solicitante e abertos pelo Gestor; sem isso, `=HIPERLINK(…)` vira link na máquina de quem gere.
 * **Número não passa por aqui**: `-1` é número, e neutralizá-lo o transformaria em texto.
 */

/** Escrito como escape, e nunca como o caractere literal: invisível no fonte, ele some num copiar e colar. */
export const BOM = "﻿";
const SEPARADOR = ";";
const FIM_DE_LINHA = "\r\n";
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/u;
const PEDE_ASPAS = /[;"\r\n]/u;

/** Uma célula: texto, número, ou vazio (`null`). */
export type Celula = string | number | null;

/** Uma coluna declarada: o título do cabeçalho e como ler a célula de uma linha. */
export type ColunaDoArquivo<L> = { readonly titulo: string; readonly celula: (linha: L) => Celula };

export function neutralizar(texto: string): string {
  return INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
}

function escrever(celula: Celula): string {
  if (celula === null) return "";
  const texto = typeof celula === "number" ? String(celula) : neutralizar(celula);
  return PEDE_ASPAS.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function montarCsv<L>(colunas: readonly ColunaDoArquivo<L>[], linhas: readonly L[]): string {
  const registros = [
    colunas.map((coluna) => escrever(coluna.titulo)),
    ...linhas.map((linha) => colunas.map((coluna) => escrever(coluna.celula(linha)))),
  ];
  return BOM + registros.map((registro) => registro.join(SEPARADOR) + FIM_DE_LINHA).join("");
}

/** `ocorrencias-condominio-jardim-das-flores-2026-10-03.csv`. ASCII puro, então cabe em `filename="…"`. */
export function nomeDoArquivo(recurso: string, nomeDaOrganizacao: string, agoraIso: string): string {
  const organizacao =
    nomeDaOrganizacao
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "organizacao";
  return `${recurso}-${organizacao}-${diaDoArquivo(agoraIso)}.csv`;
}
