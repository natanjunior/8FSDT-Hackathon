import { join } from "node:path";

import { RAIZ, documentos, ler, relatar } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador do site — a documentação como o leitor a recebe
 * ============================================================================
 *
 * Os outros verificadores leem os arquivos de `docs/`. Este lê o site publicado, e existe porque as duas
 * coisas divergiram sem ninguém ver: os arquivos passavam em tudo, e no site 292 links do corpo davam
 * 404, os diagramas apareciam como código e a busca não respondia.
 *
 * Uso: `npm run verificar:site -- <url-base>`, ou com `URL_PUBLICA` no ambiente. A esteira o roda depois
 * de cada publicação.
 *
 * O que ele confere:
 *
 * - **links**: toda página alcançável a partir de `/documentacao` responde, e toda âncora aponta para um
 *   título que existe na página de destino;
 * - **diagramas**: cada bloco `mermaid` de `docs/` chega à página como diagrama, e nenhum como código;
 * - **busca**: a rota responde, e acha alguma coisa;
 * - **referência da API**: a página e os dois arquivos do Swagger UI respondem;
 * - **acabamento**: um título por página, e a interface em português.
 */

const BASE = (process.argv[2] ?? process.env.URL_PUBLICA ?? "").replace(/\/+$/u, "");
if (BASE === "") {
  console.error("✗ Site: informe a URL base, como argumento ou em URL_PUBLICA.");
  process.exit(2);
}

/** A primeira resposta depois de ociosidade traz a partida a frio, medida em 20,7 s. */
const TEMPO_LIMITE_MS = 60_000;
const EM_PARALELO = 4;

const KEYWORDS_MERMAID =
  /^(?:stateDiagram|flowchart|graph\s|sequenceDiagram|erDiagram|classDiagram|C4\w+|journey|gantt|mindmap|timeline)/u;

const TEXTO_EM_INGLES = [">Search<", ">On this page<", ">No results found<", ">Next Page<", ">Previous Page<"];

/**
 * Página com mais de um `<h1>`: hoje não há nenhuma, e o mapa fica porque a exceção precisa ter dono
 * no dia em que aparecer. A única que existiu era a Arquitetura, dois documentos numa página, e ela saiu
 * quando virou Visão geral mais Domínio.
 */
const TITULOS_ESPERADOS = new Map();

async function buscar(url, tentativas = 2) {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS), redirect: "follow" });
      const corpo = await resposta.text();
      return { status: resposta.status, corpo, url: resposta.url };
    } catch (erro) {
      if (tentativa >= tentativas) return { status: 0, corpo: "", url, erro: String(erro) };
    }
  }
}

const semAncora = (url) => url.split("#")[0];

/** Os endereços de uma página, resolvidos contra ela. Só os do próprio site importam. */
function enderecosDe(html, urlDaPagina) {
  const achados = [];
  for (const [, href] of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gu)) {
    const decodificado = href.replaceAll("&amp;", "&");
    let alvo;
    try {
      alvo = new URL(decodificado, urlDaPagina);
    } catch {
      continue;
    }
    if (alvo.origin !== new URL(BASE).origin) continue;
    if (alvo.pathname.startsWith("/_next/")) continue;
    achados.push(alvo.href);
  }
  return achados;
}

const ehPaginaDeDocumentacao = (url) => {
  const { pathname } = new URL(url);
  return pathname.startsWith("/documentacao") && !pathname.startsWith("/documentacao/api/") && !/\.\w+$/u.test(pathname);
};

const idsDe = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/gu)].map(([, id]) => decodeURIComponent(id)));

const textoPuro = (html) =>
  html
    .replaceAll(/<[^>]+>/gu, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .trim();

// ---------------------------------------------------------------------------
// 1 · Rastreamento
// ---------------------------------------------------------------------------

const falhas = [];
const notas = [];

const paginas = new Map(); // url sem âncora -> { status, corpo }
const referencias = []; // { de, para }
const fila = [`${BASE}/documentacao`];
const vistas = new Set(fila);

while (fila.length > 0) {
  const lote = fila.splice(0, EM_PARALELO);
  const respostas = await Promise.all(lote.map((url) => buscar(url)));

  for (const [indice, resposta] of respostas.entries()) {
    const pedida = lote[indice];
    const final = semAncora(resposta.url);
    paginas.set(pedida, resposta);
    paginas.set(final, resposta);
    if (resposta.status !== 200 || !ehPaginaDeDocumentacao(final)) continue;

    for (const endereco of enderecosDe(resposta.corpo, final)) {
      referencias.push({ de: new URL(final).pathname, para: endereco });
      const alvo = semAncora(endereco);
      if (vistas.has(alvo)) continue;
      vistas.add(alvo);
      fila.push(alvo);
    }
  }
}

const documentacao = [...paginas.entries()].filter(
  ([url, r]) => r.status === 200 && ehPaginaDeDocumentacao(url) && url === semAncora(r.url),
);

// ---------------------------------------------------------------------------
// 2 · Links e âncoras
// ---------------------------------------------------------------------------

const quebrados = new Map();
for (const { de, para } of referencias) {
  const alvo = paginas.get(semAncora(para));
  const caminho = new URL(para).pathname + (new URL(para).hash || "");
  if (!alvo || alvo.status >= 400 || alvo.status === 0) {
    const chave = `${alvo?.status ?? "?"} ${caminho}`;
    quebrados.set(chave, [...(quebrados.get(chave) ?? []), de]);
    continue;
  }
  const ancora = decodeURIComponent(new URL(para).hash.slice(1));
  if (ancora !== "" && ehPaginaDeDocumentacao(semAncora(para)) && !idsDe(alvo.corpo).has(ancora)) {
    const chave = `âncora ${caminho}`;
    quebrados.set(chave, [...(quebrados.get(chave) ?? []), de]);
  }
}
for (const [chave, origens] of quebrados) {
  const unicas = [...new Set(origens)];
  falhas.push(`link ${chave} — em ${unicas.slice(0, 3).join(", ")}${unicas.length > 3 ? ` e mais ${unicas.length - 3}` : ""}`);
}
notas.push(`${referencias.length} links seguidos, ${new Set(referencias.map((r) => r.para)).size} endereços distintos`);

// ---------------------------------------------------------------------------
// 3 · Diagramas
// ---------------------------------------------------------------------------

/**
 * **O universo é o que a navegação alcança, e não o diretório inteiro.**
 *
 * Uma página substituída sai da barra lateral e o arquivo dela fica, porque as páginas ainda não trocadas
 * a citam. O rastreador não chega nela, então contar os blocos de `docs/` inteiro compararia laranjas com
 * maçãs e o portão ficaria vermelho sem defeito nenhum. Aqui cada página visitada é traduzida de volta
 * para o arquivo que a gerou, e só os blocos dela entram na conta.
 */
const arquivoDaPagina = (url) => {
  const resto = new URL(url).pathname.replace(/^\/documentacao\/?/u, "");
  return resto === "" ? null : join(RAIZ, "docs", `${resto}.md`);
};

let esperados = 0;
for (const [url] of documentacao) {
  const arquivo = arquivoDaPagina(url);
  if (!arquivo) continue;
  try {
    esperados += (ler(arquivo).match(/^\s*```mermaid\s*$/gmu) ?? []).length;
  } catch {
    // Página sem arquivo correspondente, como a referência da API. Não tem diagrama a contar.
  }
}

let desenhados = 0;
for (const [url, { corpo }] of documentacao) {
  desenhados += (corpo.match(/data-diagrama=""/gu) ?? []).length;
  for (const [, conteudo] of corpo.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gu)) {
    if (KEYWORDS_MERMAID.test(textoPuro(conteudo))) {
      falhas.push(`diagrama como código em ${new URL(url).pathname}`);
    }
  }
}
if (esperados === 0) {
  falhas.push("nenhum bloco mermaid nas páginas visitadas: a conferência de diagramas não confere nada");
} else if (desenhados !== esperados) {
  falhas.push(
    `diagramas: ${esperados} blocos mermaid nas páginas visitadas, ${desenhados} desenhados`,
  );
} else {
  notas.push(`${desenhados} diagramas, um por bloco mermaid das páginas visitadas`);
}

// ---------------------------------------------------------------------------
// 4 · Busca
// ---------------------------------------------------------------------------

const busca = await buscar(`${BASE}/documentacao/api/busca?query=${encodeURIComponent("ocorrência")}`);
let resultados = -1;
try {
  resultados = JSON.parse(busca.corpo).length;
} catch {
  // corpo que não é JSON cai na falha abaixo
}
if (busca.status !== 200 || !(resultados > 0)) {
  falhas.push(`busca: status ${busca.status}, ${resultados < 0 ? "resposta não é lista" : `${resultados} resultados`}`);
} else {
  notas.push(`busca por "ocorrência": ${resultados} resultados`);
}

// ---------------------------------------------------------------------------
// 5 · Referência da API
// ---------------------------------------------------------------------------

for (const [caminho, contem] of [
  ["/documentacao/api/referencia", "swagger-ui"],
  ["/documentacao/api/referencia/swagger-ui.css", ".swagger-ui"],
  ["/documentacao/api/referencia/swagger-ui-bundle.js", "SwaggerUIBundle"],
  ["/documentacao/api/openapi.yaml", "openapi:"],
]) {
  const r = await buscar(`${BASE}${caminho}`);
  if (r.status !== 200 || !r.corpo.includes(contem)) falhas.push(`referência da API: ${caminho} respondeu ${r.status}`);
}

// ---------------------------------------------------------------------------
// 6 · Acabamento
// ---------------------------------------------------------------------------

for (const [url, { corpo }] of documentacao) {
  const caminho = new URL(url).pathname;
  const titulos = (corpo.match(/<h1\b/gu) ?? []).length;
  const esperado = TITULOS_ESPERADOS.get(caminho) ?? 1;
  if (titulos !== esperado) falhas.push(`${caminho}: ${titulos} títulos <h1>, e o esperado é ${esperado}`);
  else if (esperado !== 1) notas.push(`${caminho}: ${esperado} títulos <h1>, por exceção registrada neste arquivo`);
  const ingles = TEXTO_EM_INGLES.filter((texto) => corpo.includes(texto));
  if (ingles.length > 0) falhas.push(`${caminho}: interface em inglês (${ingles.join(" ")})`);
}

// ---------------------------------------------------------------------------
// Controles: sem eles, um site que responde 200 para tudo passaria por site sem link quebrado.
// ---------------------------------------------------------------------------

const inexistente = await buscar(`${BASE}/documentacao/pagina-que-nao-existe-${Date.now()}`);
if (inexistente.status !== 404) {
  falhas.push(`CONTROLE: uma página inexistente respondeu ${inexistente.status}, e não 404`);
} else {
  notas.push("controle: página inexistente responde 404, então um link quebrado seria visto");
}
if (documentacao.length < 2) {
  falhas.push(`CONTROLE: só ${documentacao.length} página alcançada a partir de /documentacao`);
}

notas.unshift(`site conferido: ${BASE}`);

process.exit(
  relatar("Site", { conferidos: documentacao.length, unidade: "página", genero: "f", falhas, notas }),
);
