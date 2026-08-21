import { JSDOM } from "jsdom";

import { curto, documentos, ler, relatar, RAIZ } from "./comum.mjs";
import { join } from "node:path";

/**
 * ============================================================================
 *  Verificador de diagrama
 * ============================================================================
 *
 * O Definition of Done: *"todo bloco Mermaid do repositório tem sintaxe válida, verificado por
 * `mermaid.parse()` no pipeline… **Diagrama que não renderiza é documentação que não existe**, e a falha é
 * silenciosa: o GitHub mostra o bloco de código cru e ninguém percebe."*
 *
 * **O controle é o que faz este script ser um verificador.** Sem ele, um `parse` que aceitasse tudo — por
 * versão trocada, por exceção engolida, por não estar sendo chamado — passaria exatamente como um
 * repositório inteiro correto.
 *
 * E o controle é **diferencial**: dois diagramas que diferem em **um par de aspas**. O negativo é
 * `A[Em análise (pelo Gestor)]` — parêntese dentro de rótulo de nó, que é o erro real que este projeto já
 * cometeu ao extrair diagramas do PDF — e tem de ser **recusado, com erro de parse**. O positivo é o mesmo
 * diagrama com o rótulo entre aspas, e tem de ser **aceito**. Se os dois passam, o parser não discrimina; se
 * os dois falham, ele não parseia o que achamos. Nas duas situações o script falha o build, **mesmo que todo
 * diagrama de `docs/` esteja certo**. Ver `fixtures/LEIA.md`.
 *
 * O Mermaid é biblioteca de navegador e o seu sanitizador exige DOM, então o `jsdom` entra aqui e **só
 * aqui**. É dependência de desenvolvimento; nada dela chega ao container.
 */

// ---------------------------------------------------------------------------
// O DOM mínimo que o Mermaid exige
// ---------------------------------------------------------------------------

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });

for (const nome of [
  "window",
  "document",
  "Element",
  "Node",
  "DocumentFragment",
  "HTMLElement",
  "SVGElement",
  "NodeFilter",
  "DOMParser",
  "XMLSerializer",
  "getComputedStyle",
]) {
  globalThis[nome] = dom.window[nome] ?? dom.window;
}
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle;
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.requestAnimationFrame ??= (retorno) => setTimeout(retorno, 0);

const { default: mermaid } = await import("mermaid");

// ---------------------------------------------------------------------------
// Extração dos blocos
// ---------------------------------------------------------------------------

/** ```mermaid … ``` em `.md`; o arquivo inteiro em `.mmd`. */
function blocosDe(caminho, conteudo) {
  if (caminho.endsWith(".mmd")) {
    // O cabeçalho `%%` de proveniência é comentário do próprio Mermaid — entra no parse como está.
    return [{ linha: 1, texto: conteudo }];
  }

  const blocos = [];
  const linhas = conteudo.split(/\r?\n/u);
  let dentro = false;
  let inicio = 0;
  let acumulado = [];

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i] ?? "";
    if (!dentro && /^\s*```+\s*mermaid\s*$/iu.test(linha)) {
      dentro = true;
      inicio = i + 2;
      acumulado = [];
      continue;
    }
    if (dentro && /^\s*```+\s*$/u.test(linha)) {
      dentro = false;
      blocos.push({ linha: inicio, texto: acumulado.join("\n") });
      continue;
    }
    if (dentro) acumulado.push(linha);
  }

  return blocos;
}

async function conferir(texto) {
  try {
    await mermaid.parse(texto);
    return null;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return mensagem.split(/\r?\n/u).slice(0, 3).join(" ").slice(0, 220);
  }
}

// ---------------------------------------------------------------------------

const falhas = [];
let conferidos = 0;

for (const caminho of documentos([".md", ".mmd"])) {
  const conteudo = ler(caminho);
  for (const bloco of blocosDe(caminho, conteudo)) {
    if (bloco.texto.trim() === "") continue;
    conferidos += 1;
    const erro = await conferir(bloco.texto);
    if (erro !== null) falhas.push(`${curto(caminho)}:${bloco.linha} — ${erro}`);
  }
}

// ---------------------------------------------------------------------------
// O controle DIFERENCIAL: dois diagramas que diferem em um par de aspas.
// O negativo tem de ser recusado; o positivo, aceito. Ver `fixtures/LEIA.md`.
// ---------------------------------------------------------------------------

const notas = [];
const fixture = (nome) => join(RAIZ, "ferramentas/verificadores/fixtures", nome);

const doNegativo = await conferir(ler(fixture("controle-negativo.mmd")));
const doPositivo = await conferir(ler(fixture("controle-positivo.mmd")));

if (doNegativo === null) {
  falhas.push(
    "CONTROLE NEGATIVO ACEITO — `A[Em análise (pelo Gestor)]` deveria ser recusado e não foi. " +
      "O verificador não está verificando: parse trocado, exceção engolida, ou o arquivo mudou.",
  );
} else if (!/parse error/iu.test(doNegativo)) {
  // Recusado, mas pelo motivo errado — o que passaria como sucesso e não é.
  falhas.push(`CONTROLE NEGATIVO recusado pelo motivo errado: ${doNegativo}`);
} else {
  notas.push(`controle negativo recusado como deve — ${doNegativo.slice(0, 70)}…`);
}

if (doPositivo !== null) {
  falhas.push(
    `CONTROLE POSITIVO RECUSADO — o mesmo diagrama com o rótulo entre aspas deveria passar: ${doPositivo}`,
  );
} else {
  notas.push("controle positivo aceito como deve — o parser está discriminando, não recusando tudo.");
}

process.exit(relatar("Mermaid", { conferidos, unidade: "bloco", falhas, notas }));
