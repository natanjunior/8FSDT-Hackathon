import { join } from "node:path";

import { RAIZ, curto, documentos, ler, relatar } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de tom — as seis regras contáveis
 * ============================================================================
 *
 * Os outros cinco verificadores conferem FATO: o diagrama compila, o link resolve, a especificação bate
 * com a rota. Este confere FORMA, e a razão de existir é outra: os sinais que fazem um texto ser
 * descartado como gerado por máquina são contáveis, e o que é contável se corrige por limite em vez de
 * por releitura. Dez horas de regra no lugar de quarenta de leitura.
 *
 * ---------------------------------------------------------------------------
 *  Por que há uma lista de aprovados, em vez de o portão valer para tudo
 * ---------------------------------------------------------------------------
 *
 * A reescrita é de 22 arquivos — 23 depois que o Event Storming atravessar — e leva semanas. Um portão
 * que exigisse todos de uma vez ficaria vermelho o tempo todo, e portão sempre vermelho ensina a ignorar
 * portão. Então:
 *
 *   · arquivo em APROVADOS  -> violação é FALHA, e o build cai;
 *   · arquivo fora da lista -> violação é NOTA, e o build passa.
 *
 * Cada tarefa da reescrita acrescenta uma linha à lista. Quando ela tiver os 23, o `if` deixa de ter
 * função e sai — e nesse dia o portão vale para o pacote inteiro.
 */

/** Arquivos já reescritos. Uma linha por tarefa concluída da reescrita. */
const APROVADOS = new Set([
  "docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md",
  "docs/adr/0002-stack-e-plataforma.md",
  "docs/adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md",
  "docs/adr/0004-execucao-em-container-no-azure.md",
  "docs/adr/0005-regra-de-dependencia-por-inversao.md",
  "docs/adr/0006-organizacao-de-modulos.md",
  "docs/adr/0007-camada-de-interface-com-shadcn-ui.md",
  "docs/adr/0008-a-suite-de-testes-segue-a-garantia.md",
  "docs/adr/0009-documentacao-como-paginas-do-produto.md",
  "docs/adr/README.md",
  "docs/arquitetura.md",
  "docs/definition-of-done.md",
  "docs/documentacao-da-demanda.md",
  "docs/escopo.md",
  "docs/event-storming.md",
  "docs/fluxos-e-diagramas.md",
  "docs/glossario.md",
  "docs/modelo-de-dados.md",
  "docs/premissas-e-questoes-abertas.md",
]);

// ---------------------------------------------------------------------------
// As seis regras
// ---------------------------------------------------------------------------

/** Regras 1 e 2 — densidade. Uma a cada N palavras, no máximo. */
const PALAVRAS_POR_NEGRITO = 50;
const PALAVRAS_POR_TRAVESSAO = 100;

/** Regra 6 — o bloco de citação vira aviso, e aviso é raro. */
const PALAVRAS_POR_BLOCO_DE_CITACAO = 2000;

const NEGRITO = /\*\*[^*\n]+\*\*/gu;
const TRAVESSAO = /—/gu;

/**
 * Regra 3 — ênfase performática.
 *
 * O padrão "não A, mas B" foi medido no pacote e deu **zero** ocorrências. Ficou de fora: padrão que
 * nunca dispara é ruído na lista, e lista com ruído é lista que ninguém revisa.
 *
 * O `é` das duas primeiras entradas é acentuado de propósito. A primeira versão usava a classe `[ée]`,
 * que casa também com o `e` da conjunção — e transformava *"não é um processo, e sim outro"* em falso
 * positivo. Contado: 144 ocorrências reais contra 119 com o padrão frouxo, e as duas contagens erravam
 * em direções diferentes.
 */
const PERFORMATICO = [
  ["não é X, é Y", /não é (?:apenas |só )?[^,.;\n]{1,45}, é /gu],
  [
    "fecho enfático",
    /(?:e (?:isso|isto) (?:importa|muda tudo)|com todas as letras|não por acaso|vale (?:dizer|registrar|saber|notar)|fica dito|o que importa é|que é o que interessa|e a razão importa)/gu,
  ],
  [
    "é exatamente / é justamente",
    /(?:é exatamente|é justamente|é precisamente|exatamente o que|justamente o que)/gu,
  ],
];

/**
 * Regra 4 — fonte que o leitor da entrega não tem.
 *
 * **`disciplina` dispara em português comum, e isso é deliberado.** *"Depender da disciplina de quem
 * programa"* nada tem a ver com a disciplina do curso, e mesmo assim é apontado. A alternativa seria um
 * padrão que exigisse contexto de curso em volta, e aí ele deixaria passar *"a disciplina de DevOps"* de
 * quem escrevesse a frase de outro jeito.
 *
 * **Um padrão estreito que às vezes força um sinônimo custa menos que um largo que deixa passar a
 * citação real.** Quando isto apontar um falso positivo, troque a palavra no texto: `cuidado`, `rigor` e
 * `hábito` servem, e o documento não fica pior por isso.
 */
const APARATO = [
  ["marcador de origem", /`?\b(?:ENUNCIADO|NOSSO)\b/gu],
  /**
   * **O padrão era `aula N, p.X` e passou a ser `aula N`, e a razão é uma medição.**
   *
   * A forma com página pegava as citações do material de DDD, que sempre traziam página. O material de
   * Banco de Dados era citado só pelo número — *"a aula 1 lista cinco situações"* —, e 45 dessas
   * atravessavam o portão em quatro documentos, sendo 34 só no modelo de dados.
   *
   * Alargar custou zero: conferido em 13/09/2026, os documentos já aprovados têm **nenhuma** ocorrência
   * da forma curta. Eles foram limpos à mão, porque a convenção sempre foi mais larga que o padrão. O que
   * muda é que agora o portão cobra o que a convenção sempre disse.
   */
  ["citação de aula", /\baulas?\s+\d+\b/giu],
  ["[FONTE EXTERNA]", /\[FONTE EXTERNA\]/gu],
  [
    "fonte inacessível",
    /\b(?:o professor|a apostila|da apostila|na apostila|a disciplina|da disciplina|do curso|no curso|material do curso|Domain Expert)\b/giu,
  ],
];

/** Regra 5 — seção que explica o documento em vez de dizer o que ele tem a dizer. */
const CABECALHO_PROIBIDO =
  /^#{1,6}\s+.*\b(?:Como ler|Suposições declaradas|Questões ao hub|Limitações)\b/iu;

/** Regra 6, primeira metade — errata inline, que não existe mais em lugar nenhum. */
const ERRATA =
  /corre[çc][ãa]o|corrigid|emenda|reda[çc][ãa]o anterior|precis[ãa]o de|acrescentado em|at[ée] esta data|ressalva/iu;

// ---------------------------------------------------------------------------

/** Os blocos `>` de um documento, cada um com a linha em que abre e o texto inteiro. */
function blocosDeCitacao(linhas) {
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    if (!/^\s{0,3}>/u.test(linhas[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (
      j < linhas.length &&
      (/^\s{0,3}>/u.test(linhas[j]) ||
        (/^\s*$/u.test(linhas[j]) && /^\s{0,3}>/u.test(linhas[j + 1] ?? "")))
    ) {
      j += 1;
    }
    blocos.push({ linha: i + 1, texto: linhas.slice(i, j).join("\n") });
    i = j;
  }
  return blocos;
}

/**
 * Mede um documento e devolve a lista de violações, uma frase por violação.
 *
 * Cada frase começa em `regra N` porque o controle diferencial lá embaixo lê esse número para saber
 * quais regras dispararam. Mudar o prefixo quebra o controle, e o controle é o que prova que este
 * arquivo verifica alguma coisa.
 */
export function violacoesDe(conteudo) {
  const linhas = conteudo.split(/\r?\n/u);
  const palavras = conteudo.split(/\s+/u).filter(Boolean).length;
  const violacoes = [];

  const negrito = (conteudo.match(NEGRITO) ?? []).length;
  const tetoNegrito = Math.floor(palavras / PALAVRAS_POR_NEGRITO);
  if (negrito > tetoNegrito) {
    violacoes.push(
      `regra 1 — ${negrito} negritos em ${palavras} palavras ` +
        `(1 a cada ${Math.round(palavras / (negrito || 1))}); o teto é ${tetoNegrito}, ` +
        `então saem ${negrito - tetoNegrito}`,
    );
  }

  const travessao = (conteudo.match(TRAVESSAO) ?? []).length;
  const tetoTravessao = Math.floor(palavras / PALAVRAS_POR_TRAVESSAO);
  if (travessao > tetoTravessao) {
    violacoes.push(
      `regra 2 — ${travessao} travessões em ${palavras} palavras ` +
        `(1 a cada ${Math.round(palavras / (travessao || 1))}); o teto é ${tetoTravessao}, ` +
        `então saem ${travessao - tetoTravessao}`,
    );
  }

  for (const [nome, padrao] of PERFORMATICO) {
    const quantas = (conteudo.match(padrao) ?? []).length;
    if (quantas > 0) violacoes.push(`regra 3 — ${quantas} de "${nome}"`);
  }

  for (const [nome, padrao] of APARATO) {
    const quantas = (conteudo.match(padrao) ?? []).length;
    if (quantas > 0) violacoes.push(`regra 4 — ${quantas} de ${nome}`);
  }

  for (const [indice, linha] of linhas.entries()) {
    if (CABECALHO_PROIBIDO.test(linha)) {
      violacoes.push(`regra 5 — :${indice + 1} ${linha.trim().slice(0, 60)}`);
    }
  }

  const blocos = blocosDeCitacao(linhas);
  const errata = blocos.filter((bloco) => ERRATA.test(bloco.texto));
  if (errata.length > 0) {
    const onde = errata.map((bloco) => `:${bloco.linha}`).join(" ");
    violacoes.push(`regra 6 — ${errata.length} blocos de errata inline (${onde})`);
  }

  const tetoBlocos = Math.max(1, Math.floor(palavras / PALAVRAS_POR_BLOCO_DE_CITACAO));
  if (blocos.length > tetoBlocos) {
    violacoes.push(
      `regra 6 — ${blocos.length} blocos de citação; o teto é ${tetoBlocos}, ` +
        `então saem ${blocos.length - tetoBlocos}`,
    );
  }

  return violacoes;
}

// ---------------------------------------------------------------------------

const falhas = [];
const notas = [];
let conferidos = 0;
let pendentes = 0;

for (const caminho of documentos([".md"])) {
  const eu = curto(caminho);
  conferidos += 1;
  const violacoes = violacoesDe(ler(caminho));

  if (APROVADOS.has(eu)) {
    for (const violacao of violacoes) falhas.push(`${eu} — ${violacao}`);
  } else if (violacoes.length > 0) {
    pendentes += 1;
    notas.push(`${eu}: ${violacoes.join(" · ")}`);
  }
}

// ---------------------------------------------------------------------------
// O controle DIFERENCIAL, no molde do `mermaid.mjs`: dois arquivos que dizem a mesma coisa, e um deles
// tem de ser recusado. Sem isto, um `violacoesDe` que devolvesse sempre `[]` passaria por verificador bom.
// ---------------------------------------------------------------------------

const fixture = (nome) => join(RAIZ, "ferramentas/verificadores/fixtures", nome);

const doNegativo = violacoesDe(ler(fixture("tom-negativo.md")));
const doPositivo = violacoesDe(ler(fixture("tom-positivo.md")));

const REGRAS = [1, 2, 3, 4, 5, 6];
const quebradas = new Set(doNegativo.map((v) => Number(/^regra (\d)/u.exec(v)?.[1])));
const faltando = REGRAS.filter((numero) => !quebradas.has(numero));

if (faltando.length > 0) {
  falhas.push(
    "CONTROLE NEGATIVO INCOMPLETO — o arquivo viola as seis regras e o verificador só pegou " +
      `${[...quebradas].sort().join(", ")}. Não pegou: ${faltando.join(", ")}. ` +
      "Padrão trocado, ou a fixture foi editada.",
  );
} else {
  notas.push(
    `controle negativo reprovado nas seis regras, como deve — ${doNegativo.length} violações`,
  );
}

if (doPositivo.length > 0) {
  falhas.push(
    "CONTROLE POSITIVO REPROVADO — o mesmo conteúdo escrito dentro das regras deveria passar: " +
      doPositivo.join(" · "),
  );
} else {
  notas.push(
    "controle positivo aprovado como deve — o verificador está discriminando, não recusando tudo.",
  );
}

notas.push(
  `${APROVADOS.size} de ${conferidos} documentos já reescritos; ${pendentes} ainda com pendências`,
);

process.exit(relatar("Tom", { conferidos, unidade: "documento", falhas, notas }));
