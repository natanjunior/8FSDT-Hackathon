import { join } from "node:path";

import { RAIZ, curto, documentos, ler, relatar } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de tom — as sete regras de voz
 * ============================================================================
 *
 * Os outros cinco verificadores conferem FATO: o diagrama compila, o link resolve, a especificação bate
 * com a rota. Este confere FORMA, e a razão de existir é outra: os sinais que fazem um texto ser
 * descartado como gerado por máquina são contáveis, e o que é contável se corrige por limite em vez de
 * por releitura. Dez horas de regra no lugar de quarenta de leitura.
 *
 * ---------------------------------------------------------------------------
 *  Uma lista só, e ela tem de ser o pacote inteiro
 * ---------------------------------------------------------------------------
 *
 * Durante a reescrita houve duas listas: a dos arquivos já reescritos, cuja violação derrubava o build, e
 * a das páginas da estrutura nova, que respondiam também pelas regras de estrutura. Elas existiam porque
 * um portão que exigisse tudo de uma vez ficaria vermelho por semanas, e portão sempre vermelho ensina a
 * ignorar portão.
 *
 * **A reescrita terminou, e as duas viraram a mesma coisa.** Sobrou uma, e a guarda lá embaixo exige que
 * ela seja exatamente o conjunto de documentos conferidos — nem mais, nem menos. Um arquivo novo em
 * `docs/` que ninguém acrescentar aqui derruba o build, em vez de passar despercebido como nota.
 */

/** O pacote entregue, arquivo por arquivo. A guarda do fim exige que esta lista seja exata. */
const DOCUMENTOS = new Set([
  "CONTRIBUTING.md",
  "README.md",
  "docs/README.md",
  "docs/adr/0001-historico-de-transicoes-como-conceito-de-dominio.md",
  "docs/adr/0002-stack-e-plataforma.md",
  "docs/adr/0003-isolamento-de-tenant-na-camada-de-aplicacao.md",
  "docs/adr/0004-execucao-em-container-no-azure.md",
  "docs/adr/0005-regra-de-dependencia-por-inversao.md",
  "docs/adr/0006-organizacao-de-modulos.md",
  "docs/adr/0007-camada-de-interface-com-shadcn-ui.md",
  "docs/adr/0008-a-suite-de-testes-segue-a-garantia.md",
  "docs/adr/0009-documentacao-como-paginas-do-produto.md",
  "docs/adr/0010-o-componente-de-grafico-entra-com-o-recharts.md",
  "docs/adr/0011-sonner-e-cmdk-entram-como-pacotes.md",
  "docs/adr/0012-o-teste-de-ponta-a-ponta-cresce-por-jornada.md",
  "docs/adr/README.md",
  "docs/api.md",
  "docs/atendimento-ao-enunciado.md",
  "docs/banco-de-dados.md",
  "docs/dominio.md",
  "docs/glossario.md",
  "docs/infraestrutura.md",
  "docs/produto.md",
  "docs/seguranca.md",
  "docs/telas.md",
  "docs/testes.md",
  "docs/visao-geral-da-arquitetura.md",
]);

// ---------------------------------------------------------------------------
// As sete regras
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

/**
 * ---------------------------------------------------------------------------
 *  As regras da estrutura nova, que valem só para as páginas da lista `NOVAS`
 * ---------------------------------------------------------------------------
 *
 * As seis acima cuidam do tom. Estas cuidam do **leitor**: a documentação deixou de ser o diário de quem
 * a produziu e passou a ser a documentação de um produto, lida por quem compra e por quem mantém. Tudo o
 * que só serve a quem escreveu — identificador de processo, vocabulário interno, data de quando a frase
 * mudou, seção sobre a própria descoberta — para de entrar.
 *
 * Elas não valem para as páginas antigas de propósito. Cada uma sai quando for substituída, e cobrar
 * delas agora deixaria o portão vermelho sem que ninguém pudesse consertá-lo.
 */
const DA_ESTRUTURA_NOVA = [
  /**
   * Identificador de processo. Os do próprio sistema ficam: nome de tabela, de endpoint, de código de
   * erro, de comando e de tela. `RNFn` fica também, porque requisito não funcional medido é requisito.
   */
  [
    "identificador de processo",
    /\b(?:D(?:[1-9]|1\d|2[0-7])|P[1-6]|PA-\d{1,2}|S-[APT]\d{1,2}|Q-(?:API-\d|[PT]-?\d{1,2})|DG-\d|POL-\d{1,2}|[RL]-\d{1,2}|[EFGS]\d{1,2})\b/gu,
  ],
  ["vocabulário de processo", /\bhub\b/giu],
  ["título de correção ou de revisão", /^#{1,6}.*\b(?:corre[çc][ãa]o|corrigid|revisto|emenda|nota de revis[ãa]o)\b.*$/gimu],
  [
    "seção de processo ou de descoberta",
    /^#{1,6}.*\b(?:o que .{0,30}descobriu|o que .{0,30}revelou|decis[õo]es da revis[ãa]o|propostas de mudan[çc]a|como este documento é mantido|quest[õo]es ao hub|suposi[çc][õo]es declaradas|o que deu errado|limita[çc][õo]es)\b.*$/gimu,
  ],
];

/**
 * Data no corpo: o histórico é do `git log`. As exceções são campos declarados — o status de uma ADR e
 * o prazo de entrega —, e a linha de status pode
 * quebrar em duas — a continuação começa pelo separador, e por isso ele também está isento.
 */
const DATA_NO_CORPO =
  /^(?!\s*(?:(?:\*\*)?(?:Status|Data|Entrega)\b|·)).*?\b(\d{2}\/\d{2}\/\d{4})\b.*$/gmu;

/**
 * Referência a arquivo escrita como código, sem link.
 *
 * `` `contrato-de-api.md` §8.5 `` não é clicável em superfície nenhuma: no GitHub é texto, e na página é
 * texto. Referência a documento vira link, e o leitor chega lá.
 */
const ARQUIVO_SEM_LINK = /(.|^)`[^`\n]*\.(?:md|ya?ml|html)`(.{0,2})/gu;

/**
 * A máquina de estados mora num lugar só.
 *
 * O ciclo de vida aparecia desenhado em mais de uma página e enumerado em várias outras. Cada cópia
 * envelhece sozinha, e quem lê não sabe qual é a boa. O que rende cópia não é o nome de um estado: é o
 * desenho e a lista de quem vai para onde. Então a regra separa as duas coisas.
 *
 * **Desenhar a máquina, ou enumerar transições, só na página do domínio.** Vale para toda página nova, e
 * pega tanto o bloco Mermaid quanto a seta em prosa.
 *
 * **Nomear estados tem teto de dois**, para que uma página não recite a máquina de viés. A exceção é
 * declarada por arquivo: O produto fala a língua do sistema por decisão editorial, então nomeia os
 * estados à vontade — e continua sem poder desenhar nem enumerar transição.
 */
const DONO_DA_MAQUINA_DE_ESTADOS = "docs/dominio.md";

/**
 * Páginas autorizadas a nomear estados sem teto. A proibição de desenhar e de enumerar continua.
 *
 * O produto fala a língua do sistema por decisão editorial, e o glossário é onde os nomes são definidos:
 * uma lista de termos que não pudesse citar três deles não seria um glossário.
 */
const PODEM_NOMEAR_ESTADOS = new Set(["docs/glossario.md", "docs/produto.md"]);

const DIAGRAMA_DE_ESTADOS = /stateDiagram(?:-v2)?/gu;
const ESTADO = "(?:Aberta|Em\\s*an[áa]lise|EmAnalise|Em\\s*atendimento|EmAtendimento|Resolvida|Cancelada|Pausada)";
const NOME_DE_ESTADO = new RegExp(`(?<![\\w-])${ESTADO}(?![\\w-])`, "giu");
const TRANSICAO_ENUMERADA = new RegExp(`${ESTADO}\\s*(?:--?>|→|=>)\\s*${ESTADO}`, "giu");
const TETO_DE_ESTADOS_CITADOS = 2;

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
export function violacoesDe(conteudo, eu = "", nova = false) {
  const linhas = conteudo.split(/\r?\n/u);

  const palavras = conteudo.split(/\s+/u).filter(Boolean).length;
  const violacoes = [];

  if (nova) {
    for (const [nome, padrao] of DA_ESTRUTURA_NOVA) {
      const achados = conteudo.match(padrao) ?? [];
      if (achados.length > 0) {
        violacoes.push(`estrutura — ${achados.length} de ${nome}: ${achados[0].trim().slice(0, 50)}`);
      }
    }

    const datas = conteudo.match(DATA_NO_CORPO) ?? [];
    if (datas.length > 0) violacoes.push(`estrutura — ${datas.length} datas no corpo`);

    if (eu !== DONO_DA_MAQUINA_DE_ESTADOS) {
      const diagramas = (conteudo.match(DIAGRAMA_DE_ESTADOS) ?? []).length;
      if (diagramas > 0) {
        violacoes.push(
          `estrutura — ${diagramas} diagrama de estados fora de ${DONO_DA_MAQUINA_DE_ESTADOS}`,
        );
      }

      const transicoes = conteudo.match(TRANSICAO_ENUMERADA) ?? [];
      if (transicoes.length > 0) {
        violacoes.push(
          `estrutura — ${transicoes.length} transições enumeradas fora de ` +
            `${DONO_DA_MAQUINA_DE_ESTADOS}: ${transicoes[0].trim().slice(0, 40)}`,
        );
      }

      if (!PODEM_NOMEAR_ESTADOS.has(eu)) {
        const citados = new Set(
          (conteudo.match(NOME_DE_ESTADO) ?? []).map((nome) =>
            nome.toLocaleLowerCase("pt-BR").replace(/\s+/gu, " "),
          ),
        );
        if (citados.size > TETO_DE_ESTADOS_CITADOS) {
          violacoes.push(
            `estrutura — ${citados.size} estados nomeados (${[...citados].join(", ")}); ` +
              `o teto é ${TETO_DE_ESTADOS_CITADOS} fora de ${DONO_DA_MAQUINA_DE_ESTADOS}`,
          );
        }
      }
    }

    const semLink = [...conteudo.matchAll(ARQUIVO_SEM_LINK)].filter(
      ([, antes, depois]) => antes !== "[" && !depois.startsWith("]("),
    );
    if (semLink.length > 0) {
      violacoes.push(
        `estrutura — ${semLink.length} referências a arquivo em código, sem link: ` +
          semLink[0][0].trim().slice(0, 40),
      );
    }
  }

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

const encontrados = documentos([".md"]).map(curto);

for (const caminho of documentos([".md"])) {
  const eu = curto(caminho);
  conferidos += 1;
  for (const violacao of violacoesDe(ler(caminho), eu, true)) falhas.push(`${eu} — ${violacao}`);
}

/**
 * A guarda da lista, e ela fecha nos dois sentidos.
 *
 * **Arquivo em `docs/` que não está na lista** seria um documento entregue sem portão nenhum, que é como
 * a reescrita começou e o estado a que ela não pode voltar. **Nome na lista sem arquivo** é lista que
 * envelheceu, e lista que envelhece deixa de significar alguma coisa.
 */
const foraDaLista = encontrados.filter((eu) => !DOCUMENTOS.has(eu));
const semArquivo = [...DOCUMENTOS].filter((eu) => !encontrados.includes(eu));

if (foraDaLista.length > 0 || semArquivo.length > 0) {
  falhas.push(
    `A LISTA E O DISCO DIVERGEM — ${DOCUMENTOS.size} na lista, ${encontrados.length} no disco. ` +
      (foraDaLista.length > 0 ? `Fora da lista: ${foraDaLista.join(", ")}. ` : "") +
      (semArquivo.length > 0 ? `Na lista sem arquivo: ${semArquivo.join(", ")}.` : ""),
  );
} else {
  notas.push(`a lista tem os ${DOCUMENTOS.size} documentos do disco, e nenhum a mais`);
}

/**
 * E a navegação, que é a terceira ponta.
 *
 * Um arquivo pode existir, estar na lista e mesmo assim não aparecer para ninguém, porque a barra lateral
 * sai de `meta.json` e não da pasta. Toda página de `docs/` tem de estar num `meta.json`, e o `README` de
 * cada pasta é a exceção, porque ele é o índice dela.
 */
const naNavegacao = new Set();
for (const pasta of ["docs", "docs/adr"]) {
  const meta = JSON.parse(ler(join(RAIZ, pasta, "meta.json")));
  for (const pagina of meta.pages ?? []) {
    if (pagina.startsWith("---")) continue;
    naNavegacao.add(pagina === "adr" ? "docs/adr" : `${pasta}/${pagina}.md`);
  }
}

const invisiveis = encontrados.filter(
  (eu) => eu.startsWith("docs/") && !eu.endsWith("README.md") && !naNavegacao.has(eu),
);

if (invisiveis.length > 0) {
  falhas.push(`FORA DA NAVEGAÇÃO — existem e não aparecem na barra lateral: ${invisiveis.join(", ")}`);
} else {
  notas.push(`as ${naNavegacao.size - 1} páginas da navegação existem em disco, e nenhuma página sobra`);
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

/**
 * As regras da estrutura nova têm controle próprio, porque valem só para uma lista de arquivos.
 *
 * O mesmo controle negativo serve: lido como página nova, ele tem de violar todas; lido como página
 * antiga, nenhuma. Uma regra que vale para todo mundo, ou para ninguém, falha aqui.
 */
const comoNova = violacoesDe(ler(fixture("tom-negativo.md")), "", true).filter((v) =>
  v.startsWith("estrutura"),
);
const comoAntiga = violacoesDe(ler(fixture("tom-negativo.md")), "", false).filter((v) =>
  v.startsWith("estrutura"),
);
const positivoComoNova = violacoesDe(ler(fixture("tom-positivo.md")), "", true);

if (comoNova.length < DA_ESTRUTURA_NOVA.length + 5 || comoAntiga.length > 0) {
  falhas.push(
    `CONTROLE DA ESTRUTURA FALHOU — o controle negativo deu ${comoNova.length} violações de estrutura ` +
      `como página nova, e ${comoAntiga.length} como página antiga, que tem de ser zero.`,
  );
} else if (positivoComoNova.length > 0) {
  falhas.push(`CONTROLE POSITIVO REPROVADO como página nova: ${positivoComoNova.join(" · ")}`);
} else {
  notas.push(
    `estrutura conferida: ${comoNova.length} regras acusam no controle negativo, e só nas páginas novas.`,
  );
}

/**
 * A regra da máquina de estados tem controle próprio, porque é a única que depende de QUAL arquivo é.
 *
 * São três leituras do MESMO conteúdo, e as três têm de dar resultados diferentes:
 *
 *   · como página qualquer  -> as três acusam: desenho, transição e nomes;
 *   · como página autorizada a nomear -> só duas, porque o teto de nomes não vale para ela;
 *   · como a página do domínio -> nenhuma.
 *
 * Uma regra que valesse para todo mundo apagaria a máquina de estados do lugar onde ela deve estar; uma
 * que valesse para ninguém deixaria a cópia voltar. A exceção por arquivo só é exceção se o controle
 * mostrar que ela muda o resultado.
 */
const soEstados = (lista) =>
  lista.filter((v) => /diagrama de estados|transições enumeradas|estados nomeados/u.test(v));
const comoEstaPagina = (eu) => soEstados(violacoesDe(ler(fixture("tom-negativo.md")), eu, true));

const comoOutra = comoEstaPagina("docs/outra-pagina.md");
const comoAutorizada = comoEstaPagina([...PODEM_NOMEAR_ESTADOS][0]);
const comoDono = comoEstaPagina(DONO_DA_MAQUINA_DE_ESTADOS);

if (comoOutra.length !== 3 || comoAutorizada.length !== 2 || comoDono.length > 0) {
  falhas.push(
    "CONTROLE DA MÁQUINA DE ESTADOS FALHOU — o controle negativo deu " +
      `${comoOutra.length} violações numa página qualquer (tem de ser 3), ` +
      `${comoAutorizada.length} numa página autorizada a nomear (tem de ser 2) e ` +
      `${comoDono.length} em ${DONO_DA_MAQUINA_DE_ESTADOS}, que tem de ser zero.`,
  );
} else {
  notas.push(
    "máquina de estados conferida: desenhar e enumerar transição só em " +
      `${DONO_DA_MAQUINA_DE_ESTADOS}, e nomear sem teto só em ${[...PODEM_NOMEAR_ESTADOS].join(", ")}.`,
  );
}

process.exit(relatar("Tom", { conferidos, unidade: "documento", falhas, notas }));
