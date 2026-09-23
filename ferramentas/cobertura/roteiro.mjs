/**
 * ============================================================================
 *  O roteiro de validação, lido como dado
 * ============================================================================
 *
 * O `trabalho/roteiro-de-validacao.md` é prosa para quem valida à mão, e **ao mesmo tempo** é a lista de
 * tudo que o produto promete. Este módulo lê a segunda coisa sem estragar a primeira: ele não exige
 * formato novo, só reconhece o que o documento já tem.
 *
 * **A identidade de um item é `<rótulo da seção> · <número>`**, que é a forma que o humano já usa ao
 * falar de um passo: `4.2 · 10`. O rótulo vem do `##` mais próximo, e um `###` não o troca — na Parte 4
 * os subtítulos (*A prioridade*, *Analisar*, *Atribuir*) dividem a leitura mas **compartilham a
 * numeração**, que corre de 1 a 77 dentro da parte.
 *
 * **Por que o rótulo e não o número sozinho:** na Parte 2 a numeração reinicia a cada passo, então `3`
 * aparece seis vezes. Na Parte 4 ela é contínua e o número bastaria. Um identificador que funcione nas
 * duas é o par.
 *
 * ---------------------------------------------------------------------------
 *  O marcador `[olho]`
 * ---------------------------------------------------------------------------
 *
 * Um item que **só um humano confere** traz `[olho]` e a razão em meia linha. É a única marca que este
 * módulo exige do documento, e ela existe porque sem ela a máquina não distingue *impossível de
 * automatizar* de *ninguém fez ainda* — e essas duas coisas pedem decisões opostas de quem valida.
 *
 * A razão é obrigatória. `[olho]` sozinho é recusado, porque um marcador sem motivo vira um jeito de
 * calar um item.
 */

const CERCA = /^```/u;
const PARTE = /^#\s+(.+)$/u;
const SECAO = /^##\s+(.+)$/u;
const SUBSECAO = /^###\s+(.+)$/u;
const ITEM = /^\s{0,3}(\d+)\.\s+(\S.*)$/u;
/** A marca aceita a crase em volta, porque no documento ela é código: `` `[olho]` a razão ``. */
const OLHO = /`?\[olho\]`?\s*([^\n]*)/u;

/**
 * O chapéu em negrito que abre uma lista dentro de uma seção — `**6a — criar conta (T-11) e entrar**`,
 * `**44 — o tema Meridian**`, `**4a · 5 — as duas listas**`.
 *
 * Ele importa por duas razões. **Dá a atribuição de painel mais fina que existe no documento:** o
 * cabeçalho da seção diz *"valida 4a · 5 · 4b · 9b"* para treze itens de uma vez, e o chapéu diz qual
 * dos quatro é cada um. **E marca onde a numeração pode reiniciar:** no Passo 1 há duas listas, e as
 * duas começam em `1`.
 */
const CHAPEU = /^\*\*([0-9][0-9a-z]*(?:\s*·\s*[0-9][0-9a-z]*)*)\s*—/u;

/** Seções que enumeram instrução de uso, e não coisa a validar. */
const FORA = [/^Quando algo falhar/u, /^Como ler/u, /^Preparo/u, /^Antes de começar/u];

/** O item riscado é decisão registrada de que aquilo não se confere mais. */
const RISCADO = /^~~/u;

/**
 * Do título de uma parte ou seção, o rótulo curto que serve de identidade.
 *
 * `## 4.2 · A lista do Gestor …` → `4.2` · `## Passo 1 · Criar a conta …` → `2.1`, com a parte vindo de
 * fora · `# Parte 3 · Configurar …` → `3`.
 */
function rotularSecao(titulo, numeroDaParte) {
  const porNumero = /^(\d+(?:\.\d+)?)\s*·/u.exec(titulo);
  if (porNumero) return porNumero[1];

  const porPasso = /^Passo\s+(\d+)/u.exec(titulo);
  if (porPasso && numeroDaParte) return `${numeroDaParte}.${porPasso[1]}`;

  return null;
}

/** Os itens do painel que uma parte ou seção declara validar, do `→ valida **7a** · **8**`. */
function itensDoPainel(titulo) {
  const depois = /→\s*valida\s+(.+)$/u.exec(titulo);
  if (!depois) return [];
  return depois[1]
    .replace(/\*\*/gu, "")
    .split(/[·,]/u)
    .map((pedaco) => pedaco.trim())
    .filter((pedaco) => /^[0-9]/u.test(pedaco))
    .map((pedaco) => pedaco.replace(/\s+.*$/u, ""));
}

/**
 * Lê o roteiro e devolve a lista de itens, cada um com identidade, texto, parte, e — quando houver — o
 * marcador de olho com a razão.
 */
export function lerRoteiro(conteudo) {
  const linhas = conteudo.split(/\r?\n/u);

  const itens = [];
  const problemas = [];

  let parte = null;
  let numeroDaParte = null;
  let rotulo = null;
  let tituloDaSecao = null;
  let painelDaParte = [];
  let painelDaSecao = [];
  let grupo = [];
  let dentroDaCerca = false;
  let ignorandoSecao = false;

  for (const [indice, linha] of linhas.entries()) {
    if (CERCA.test(linha)) {
      dentroDaCerca = !dentroDaCerca;
      continue;
    }
    if (dentroDaCerca) continue;

    const daParte = PARTE.exec(linha);
    if (daParte) {
      const titulo = daParte[1].replace(/\*\*/gu, "").trim();
      parte = titulo;
      numeroDaParte = /^Parte\s+(\d+)/u.exec(titulo)?.[1] ?? null;
      rotulo = numeroDaParte;
      tituloDaSecao = null;
      painelDaParte = itensDoPainel(titulo);
      painelDaSecao = [];
      grupo = [];
      ignorandoSecao = FORA.some((padrao) => padrao.test(titulo));
      continue;
    }

    const daSecao = SECAO.exec(linha);
    if (daSecao) {
      const titulo = daSecao[1].replace(/\*\*/gu, "").trim();
      tituloDaSecao = titulo;
      rotulo = rotularSecao(titulo, numeroDaParte) ?? numeroDaParte;
      painelDaSecao = itensDoPainel(titulo);
      grupo = [];
      ignorandoSecao = FORA.some((padrao) => padrao.test(titulo));
      continue;
    }

    // Um `###` divide a leitura e **não** troca o rótulo: na Parte 4 a numeração atravessa os subtítulos.
    if (SUBSECAO.test(linha)) continue;

    if (ignorandoSecao || rotulo === null) continue;

    const doChapeu = CHAPEU.exec(linha);
    if (doChapeu) {
      grupo = doChapeu[1]
        .split(/·/u)
        .map((pedaco) => pedaco.trim())
        .filter(Boolean);
      continue;
    }

    const doItem = ITEM.exec(linha);
    if (!doItem) continue;

    const [, numero, texto] = doItem;
    if (RISCADO.test(texto)) continue;

    const daMarca = OLHO.exec(texto);
    if (daMarca && daMarca[1].trim() === "") {
      problemas.push(
        `:${indice + 1} o item ${rotulo} · ${numero} traz \`[olho]\` sem razão — ` +
          "um marcador sem motivo é um jeito de calar um item",
      );
    }

    itens.push({
      id: `${rotulo} · ${numero}`,
      grupo: grupo.length > 0 ? grupo.join(" · ") : null,
      rotulo,
      numero: Number(numero),
      parte,
      secao: tituloDaSecao,
      linha: indice + 1,
      texto: texto.replace(/\*\*/gu, "").trim(),
      olho: daMarca ? daMarca[1].trim() : null,
      // O mais fino que o documento oferecer: o chapéu, depois a seção, depois a parte.
      painel: grupo.length > 0 ? grupo : painelDaSecao.length > 0 ? painelDaSecao : painelDaParte,
    });
  }

  /**
   * **A segunda passada existe porque uma seção pode ter mais de uma lista.** No Passo 1 há a de `6a` e a
   * do `44`, e as duas começam em `1`. Quando isso acontece, o chapéu entra na identidade — e entra para
   * TODOS os itens daquela seção, não só para os do segundo grupo, para que `2.1 · 6a · 1` e
   * `2.1 · 44 · 1` se leiam como par em vez de como exceção.
   */
  const porRotulo = new Map();
  for (const item of itens) {
    if (!porRotulo.has(item.rotulo)) porRotulo.set(item.rotulo, []);
    porRotulo.get(item.rotulo).push(item);
  }

  for (const [, daSecao] of porRotulo) {
    const numeros = daSecao.map((item) => item.numero);
    if (new Set(numeros).size === numeros.length) continue;

    for (const item of daSecao) {
      if (item.grupo === null) {
        problemas.push(
          `:${item.linha} o item ${item.id} repete número na seção e não tem chapéu que o desempate — ` +
            "sem identidade única o mapa não sabe apontá-lo",
        );
        continue;
      }
      item.id = `${item.rotulo} · ${item.grupo} · ${item.numero}`;
    }
  }

  const vistos = new Map();
  for (const item of itens) {
    if (vistos.has(item.id)) {
      problemas.push(
        `o identificador \`${item.id}\` aparece duas vezes (linhas ${vistos.get(item.id)} e ${item.linha}) — ` +
          "a identidade de um item precisa ser única para o mapa poder apontá-lo",
      );
    }
    vistos.set(item.id, item.linha);
  }

  return { itens, problemas };
}
