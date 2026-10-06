import { readdirSync } from "node:fs";
import { join } from "node:path";

import { RAIZ, curto, documentos, ler, relatar } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de contagens — o número escrito em prosa contra o artefato
 * ============================================================================
 *
 * Um número que conta artefato envelhece sozinho. A documentação afirmou catorze tabelas por semanas
 * depois de o esquema ter vinte e duas, e afirmou quarenta e oito operações depois de a especificação ter
 * sessenta e duas. Nenhum verificador olhava para isso: o de contrato comparava o YAML com as rotas, o de
 * referências comparava link com arquivo, e a frase em português não era conferida por ninguém.
 *
 * Este arquivo confere. Para cada substantivo de artefato, há uma fonte da verdade — a especificação, as
 * migrações, a tabela de telas, o código do painel — e todo número escrito antes daquele substantivo tem
 * de bater com ela.
 *
 * ---------------------------------------------------------------------------
 *  O padrão é estreito de propósito, e o preço é uma lista de exceções
 * ---------------------------------------------------------------------------
 *
 * *"As 22 tabelas"* é afirmação do total. *"As duas tabelas que ficam fora"* é recorte, e bate em 2 porque
 * duas é o número certo **daquele** recorte. As duas formas são indistinguíveis por padrão de texto, então
 * a escolha é a mesma que o verificador de tom já fez: **padrão estreito, com a exceção declarada e com
 * dono**. Cada recorte legítimo entra em `SUBCONJUNTOS` numa linha, visível no diff.
 *
 * Quando isto apontar um falso positivo novo, há dois caminhos, e os dois são baratos: declarar o recorte
 * aqui, ou escrever a frase sem o substantivo (*"as duas que ficam fora"*). O que não há é passar batido.
 */

// ---------------------------------------------------------------------------
// As fontes da verdade
// ---------------------------------------------------------------------------

const METODOS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

/** A especificação executável: quantas operações, em quantos caminhos. */
function daEspecificacao() {
  const linhas = ler(join(RAIZ, "docs/api/openapi.yaml")).split(/\r?\n/u);
  let dentro = false;
  let operacoes = 0;
  let caminhos = 0;

  for (const linha of linhas) {
    if (/^paths:\s*$/u.test(linha)) {
      dentro = true;
      continue;
    }
    if (dentro && /^[A-Za-z]/u.test(linha)) dentro = false;
    if (!dentro) continue;

    if (/^ {2}\/[^:]*:\s*$/u.test(linha)) caminhos += 1;
    const metodo = /^ {4}([a-z]+):\s*$/u.exec(linha);
    if (metodo && METODOS.has(metodo[1])) operacoes += 1;
  }

  return { operacoes, caminhos };
}

/** O esquema: quantas tabelas o conjunto de migrações cria, e quantas migrações são. */
function dasMigracoes() {
  const pasta = join(RAIZ, "supabase/migrations");
  const arquivos = readdirSync(pasta).filter((nome) => nome.endsWith(".sql"));
  const tabelas = new Set();

  for (const nome of arquivos) {
    const sql = ler(join(pasta, nome)).replace(/--[^\n]*/gu, "");
    for (const [, tabela] of sql.matchAll(/create table(?:\s+if not exists)?\s+(\w+)/giu)) {
      tabelas.add(tabela.toLowerCase());
    }
  }

  return { tabelas: tabelas.size, migracoes: arquivos.length };
}

/**
 * As telas: as linhas da tabela que as lista.
 *
 * A fonte é a própria página, e não `app/`, porque uma tela do inventário pode não ter endereço próprio —
 * a de vínculo sem permissões é um estado da casca. O que este número garante é a consistência entre a
 * prosa e a lista ao lado dela, que é onde a divergência aparece.
 */
function dasTelas() {
  const pagina = ler(join(RAIZ, "docs/telas.md"));
  const tabela = /^\| Tela \| Endere[çc]o.*?\n\|[-\s|:]+\n((?:\|.*\n)+)/mu.exec(pagina);
  if (!tabela) return { telas: 0 };
  return { telas: tabela[1].trim().split(/\r?\n/u).filter((l) => l.startsWith("|")).length };
}

/** Os quadros do painel: os cartões numerados da tela. */
function doPainel() {
  const tela = ler(join(RAIZ, "app/(casca)/dashboard/page.tsx"));
  return { quadros: (tela.match(/numero=\{?\d/gu) ?? []).length };
}

function verdadeDoRepositorio() {
  return { ...daEspecificacao(), ...dasMigracoes(), ...dasTelas(), ...doPainel() };
}

// ---------------------------------------------------------------------------
// Os números escritos em português
// ---------------------------------------------------------------------------

const UNIDADES = {
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};

const DEZENAS = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};

/** Devolve o número que a frase escreve, ou `null` quando ela não é número. */
export function numeroDe(frase) {
  const texto = frase.trim().toLocaleLowerCase("pt-BR");
  if (/^\d{1,4}$/u.test(texto)) return Number(texto);

  const composto = /^(\w+)\s+e\s+(\w+)$/u.exec(texto);
  if (composto) {
    const dezena = DEZENAS[composto[1]];
    const unidade = UNIDADES[composto[2]];
    return dezena !== undefined && unidade !== undefined ? dezena + unidade : null;
  }

  return DEZENAS[texto] ?? UNIDADES[texto] ?? null;
}

/** Os substantivos conferidos, e a chave da verdade que responde por cada um. */
const SUBSTANTIVOS = [
  [/opera[çc][õo]es/u, "operacoes"],
  [/caminhos/u, "caminhos"],
  [/tabelas/u, "tabelas"],
  [/migra[çc][õo]es/u, "migracoes"],
  [/telas/u, "telas"],
  [/quadros/u, "quadros"],
];

const CANDIDATO =
  /(\d{1,4}|[A-Za-zÀ-ÿ]+(?:\s+e\s+[A-Za-zÀ-ÿ]+)?)\s+(opera[çc][õo]es|caminhos|tabelas|migra[çc][õo]es|telas|quadros)\b/giu;

/**
 * Recortes legítimos, declarados um por um.
 *
 * Cada entrada é a frase exata que o texto escreve. Ela conta uma parte, e não o total, então o número
 * dela está certo e não bate com a fonte da verdade. A exceção fica aqui para ser vista no diff.
 */
const SUBCONJUNTOS = new Set([
  // o par de carimbos de tempo que o gatilho do banco move
  "seis tabelas",
  // as que ficam fora do limite de uma organização
  "duas tabelas",
  // as três que o gatilho ganhou depois
  "três tabelas",
  // as operações que rodam sem organização ativa
  "sete operações",
  // os dois quadros de linha que abrem a tabela de dados
  "dois quadros",
  // as migrações que repetiram a nota do relógio de atualização
  "duas migrações",
  // as que rodavam sem organização ativa quando a ADR-0018 foi escrita
  "cinco operações",
  // as que rodam sem sessão nenhuma, que é recorte de outra pergunta
  "duas operações",
]);

/** Mede um documento e devolve a lista de divergências, uma frase por divergência. */
export function divergenciasDe(conteudo, verdade) {
  const divergencias = [];
  const semCodigo = conteudo.replace(/```[\s\S]*?```/gu, "").replace(/`[^`\n]*`/gu, "");

  for (const [, escrito, substantivo] of semCodigo.matchAll(CANDIDATO)) {
    const numero = numeroDe(escrito);
    if (numero === null) continue;

    const frase = `${escrito.toLocaleLowerCase("pt-BR")} ${substantivo.toLocaleLowerCase("pt-BR")}`;
    if (SUBCONJUNTOS.has(frase)) continue;

    const chave = SUBSTANTIVOS.find(([padrao]) => padrao.test(substantivo))?.[1];
    const real = verdade[chave];
    if (real === undefined) continue;

    if (numero !== real) {
      divergencias.push(`"${frase}" — o repositório tem ${real}`);
    }
  }

  return divergencias;
}

// ---------------------------------------------------------------------------

const verdade = verdadeDoRepositorio();
const falhas = [];
const notas = [];
let conferidos = 0;

for (const caminho of documentos([".md"])) {
  conferidos += 1;
  for (const divergencia of divergenciasDe(ler(caminho), verdade)) {
    falhas.push(`${curto(caminho)} — ${divergencia}`);
  }
}

notas.push(
  `a verdade medida: ${verdade.operacoes} operações em ${verdade.caminhos} caminhos · ` +
    `${verdade.tabelas} tabelas em ${verdade.migracoes} migrações · ` +
    `${verdade.telas} telas · ${verdade.quadros} quadros`,
);

// ---------------------------------------------------------------------------
// O controle DIFERENCIAL, com verdade sintética: o mesmo par de fixtures que os outros verificadores,
// e a verdade passada por parâmetro para que a fixture não precise ser reescrita quando o esquema crescer.
// ---------------------------------------------------------------------------

const VERDADE_DO_CONTROLE = {
  operacoes: 62, caminhos: 52, tabelas: 22, migracoes: 23, telas: 20, quadros: 7,
};

const fixture = (nome) => join(RAIZ, "ferramentas/verificadores/fixtures", nome);

const doNegativo = divergenciasDe(ler(fixture("contagens-negativo.md")), VERDADE_DO_CONTROLE);
const doPositivo = divergenciasDe(ler(fixture("contagens-positivo.md")), VERDADE_DO_CONTROLE);

if (doNegativo.length < Object.keys(VERDADE_DO_CONTROLE).length) {
  falhas.push(
    `CONTROLE NEGATIVO INCOMPLETO — a fixture erra os ${Object.keys(VERDADE_DO_CONTROLE).length} ` +
      `números e o verificador pegou ${doNegativo.length}: ${doNegativo.join(" · ")}`,
  );
} else if (doPositivo.length > 0) {
  falhas.push(`CONTROLE POSITIVO REPROVADO — os números certos deveriam passar: ${doPositivo.join(" · ")}`);
} else {
  notas.push(
    `controle: ${doNegativo.length} números errados recusados e os certos aceitos, então o verificador ` +
      "discrimina em vez de recusar tudo",
  );
}

if (numeroDe("vinte e duas") !== 22 || numeroDe("tabelas") !== null) {
  falhas.push("CONTROLE DO NUMERAL FALHOU — a leitura de número escrito em palavra parou de funcionar");
}

notas.push(`${SUBCONJUNTOS.size} recortes declarados, que contam parte e não total`);

process.exit(relatar("Contagens", { conferidos, unidade: "documento", falhas, notas }));
