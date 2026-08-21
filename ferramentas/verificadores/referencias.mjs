import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { curto, documentos, ler, relatar } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de links e de referências de seção
 * ============================================================================
 *
 * Duas verificações, e as duas atacam a mesma falha silenciosa: **a referência que aponta para o lugar
 * errado parece exatamente igual à que aponta para o certo**. O leitor só descobre ao clicar, e a banca
 * clica.
 *
 * 1. **Todo link relativo resolve.** `docs/` inteiro se sustenta em links relativos, e o `docs/README.md` é
 *    o índice comentado de onze documentos que se citam em cruz.
 * 2. **Todo `§N` aponta para uma seção que existe em algum documento do pacote.**
 *
 * ---------------------------------------------------------------------------
 *  Por que a segunda verificação é esta, e não a que se esperaria
 * ---------------------------------------------------------------------------
 *
 * A verificação forte seria *"`§4.5` existe no documento a que a citação se refere"*. **Ela não é
 * implementável sobre este pacote**, e a razão é um achado, não uma limitação de esforço:
 *
 * > **A documentação não tem convenção de atribuição para `§N`.** O mesmo `§8.5` sem qualquer marcador
 * > significa *o contrato* quando escrito no inventário de telas, e *este documento* quando escrito no
 * > contrato. As duas formas convivem, e nada no texto as distingue.
 *
 * Duas tentativas foram feitas e as duas foram descartadas com número: atribuir pelo documento mencionado na
 * vizinhança da citação produziu **217 falhas**, e a versão com padrões estreitos, **147** — em ambos os
 * casos a esmagadora maioria eram invenções da heurística, não referências quebradas. Um verificador que
 * grita 147 vezes errado é pior que nenhum: ensina a ignorá-lo.
 *
 * **O que ficou é sólido e não tem falso positivo:** um `§N` que não existe em **nenhum** documento indexado
 * está quebrado — não importa a qual documento ele pretendia se referir. É menos do que se queria, e é
 * verdade.
 *
 * **A proposta para tornar a verificação forte possível** está no relatório desta tarefa, como questão ao
 * hub: uma convenção de citação (`§N` sempre do próprio documento; para outro, `arquivo.md §N`) e uma
 * passada de normalização em `docs/`. Enquanto ela não existir, este script confere o que dá para conferir e
 * **diz** o que não confere — porque um verificador que some com o que não sabe fazer lê-se como se
 * soubesse.
 */

/** `§` que segue um destes nomes é de norma externa, não de documento nosso. */
const NORMA_EXTERNA = /\b(?:RFC|ISO|NBR|ABNT|E\.164)\b[^.§]{0,40}$/iu;

// ---------------------------------------------------------------------------
// Índice de seções
// ---------------------------------------------------------------------------

/**
 * As seções numeradas de um documento.
 *
 * **Duas formas, e as duas contam.** Cabeçalho — `## 4. Autenticação`, `### 6.2.1 O que…`, `## 1 · O
 * produto` — e **negrito no começo da linha**: `**7.1 · Idioma: pt-BR…**`, `**2.5 · ON DELETE RESTRICT…**`.
 * A segunda não é exceção: é como a §7 do contrato e a §2 do modelo numeram as suas dez subseções cada, e um
 * verificador que só olhasse cabeçalho declararia inexistentes vinte das seções mais citadas do pacote.
 */
function secoesDe(conteudo) {
  const secoes = new Set();

  const acrescentar = (numero) => {
    secoes.add(numero);
    // `§6` num documento cujo cabeçalho é `6.2` é referência ao grupo, que existe.
    const partes = numero.split(".");
    for (let i = 1; i < partes.length; i += 1) secoes.add(partes.slice(0, i).join("."));
  };

  for (const linha of conteudo.split(/\r?\n/u)) {
    const cabecalho = /^#{2,6}\s+(\d+(?:\.\d+)*)/u.exec(linha);
    if (cabecalho?.[1] !== undefined) acrescentar(cabecalho[1]);

    const negrito = /^\s*\*\*(\d+(?:\.\d+)*)\s*[·.)]/u.exec(linha);
    if (negrito?.[1] !== undefined) acrescentar(negrito[1]);
  }

  return secoes;
}

const porDocumento = new Map();
const universo = new Set();

for (const caminho of documentos([".md"])) {
  const secoes = secoesDe(ler(caminho));
  porDocumento.set(curto(caminho), secoes);
  for (const secao of secoes) universo.add(secao);
}

// ---------------------------------------------------------------------------

const falhas = [];
let linksConferidos = 0;
let secoesConferidas = 0;
let deNormaExterna = 0;

for (const caminho of documentos([".md"])) {
  const conteudo = ler(caminho);
  const eu = curto(caminho);

  // ------------------------------------------------------------------- links
  for (const achado of conteudo.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
    const alvo = achado[1];
    if (alvo === undefined || /^(?:https?:|mailto:|tel:|#)/iu.test(alvo)) continue;

    linksConferidos += 1;

    const arquivo = alvo.split("#")[0];
    if (arquivo === undefined || arquivo === "") continue; // link só de âncora

    if (!existsSync(resolve(dirname(caminho), decodeURIComponent(arquivo)))) {
      falhas.push(`${eu} — link relativo não resolve: ${alvo}`);
    }
  }

  // ---------------------------------------------------------------------- §N
  for (const achado of conteudo.matchAll(/§\s*(\d+(?:\.\d+)*)/gu)) {
    const numero = achado[1];
    const posicao = achado.index ?? 0;
    if (numero === undefined) continue;

    if (NORMA_EXTERNA.test(conteudo.slice(Math.max(0, posicao - 130), posicao))) {
      deNormaExterna += 1;
      continue;
    }

    secoesConferidas += 1;

    if (!universo.has(numero)) {
      // Nenhum documento do pacote tem esta seção. Não há atribuição possível que salve a referência.
      const linha = conteudo.slice(0, posicao).split(/\r?\n/u).length;
      falhas.push(
        `${eu}:${linha} — §${numero} não existe em NENHUM documento do pacote. ` +
          "Ou a seção foi renumerada e a citação ficou, ou o número está errado.",
      );
    }
  }
}

/** Quais documentos têm seções numeradas, e quantas — para que "conferido" não seja palavra vazia. */
const comSecoes = [...porDocumento.entries()]
  .filter(([, secoes]) => secoes.size > 0)
  .map(([nome, secoes]) => `${nome.replace(/^docs\//u, "")}:${secoes.size}`);

process.exit(
  relatar("Links e referências", {
    conferidos: linksConferidos + secoesConferidas,
    unidade: "referência",
    falhas,
    notas: [
      `${linksConferidos} links relativos`,
      `${secoesConferidas} referências §N contra um universo de ${universo.size} seções numeradas`,
      `${deNormaExterna} referências a norma externa, ignoradas por nome`,
      `documentos com seções numeradas: ${comSecoes.join(" · ")}`,
      "não confere ATRIBUIÇÃO (a qual documento cada §N se refere) — ver o cabeçalho deste arquivo",
    ],
  }),
);
