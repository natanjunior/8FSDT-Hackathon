import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { RAIZ } from "../verificadores/comum.mjs";
import { lerRoteiro } from "./roteiro.mjs";
import { lerDeclaracoes } from "./declaracao.mjs";

/**
 * ============================================================================
 *  O mapa de cobertura do roteiro de validação
 * ============================================================================
 *
 * **Ele existe para encurtar uma decisão que continua sendo humana.** A coluna `Val` do painel significa
 * *"eu exercitei e está de pé"*, e é a única que só o dono marca. Este programa não marca nada: ele diz,
 * por item do painel, o que a máquina já provou, o que só o olho prova, e o que ninguém cobre — para que
 * quem for validar abra o item, exercite o que sobrou, e decida com a lista curta na mão.
 *
 * **O mapa é gerado e nunca escrito à mão.** Um arquivo que pudesse ser editado apodreceria na primeira
 * semana e passaria a mentir com aparência de precisão, que é pior que não existir.
 *
 * ---------------------------------------------------------------------------
 *  As duas fontes, e por que são duas
 * ---------------------------------------------------------------------------
 *
 * **O roteiro** dá o universo: quais itens existem, a que item do painel cada um pertence, e quais só um
 * humano confere — esses trazem `[olho]` e a razão.
 *
 * **O relatório do Playwright** dá o que foi provado, pela anotação que cada teste empurra ao lado da
 * asserção. Prosa em comentário não serve: extrair critério do fonte por expressão regular traz `127.0`
 * junto de `14.3`.
 *
 * ---------------------------------------------------------------------------
 *  A guarda, e ela derruba o programa
 * ---------------------------------------------------------------------------
 *
 * **Anotação que cita passo inexistente é erro, e não aviso.** É assim que um mapa apodrece: o roteiro é
 * renumerado, as anotações continuam apontando para o que era, e o mapa segue verde afirmando cobertura
 * de coisa nenhuma. Aqui isso para a geração e diz qual anotação e qual passo.
 *
 * **Item marcado `[olho]` que algum teste declara cobrir também para o programa.** Ou o marcador está
 * errado, ou o teste está declarando a mais — e as duas coisas precisam de gente.
 */

const CAMINHO_DO_ROTEIRO = join(RAIZ, "trabalho/roteiro-de-validacao.md");
const CAMINHO_DO_RELATORIO = join(RAIZ, "test-results/relatorio.json");
const CAMINHO_DO_MAPA = join(RAIZ, "trabalho/cobertura-do-roteiro.md");

const ESTADOS = {
  provado: { rotulo: "provado", ordem: 0 },
  parcial: { rotulo: "parcial", ordem: 1 },
  pendente: { rotulo: "prova pendente", ordem: 2 },
  olho: { rotulo: "só o olho", ordem: 3 },
  descoberto: { rotulo: "descoberto", ordem: 4 },
};

/**
 * **A prova pendente nunca desaparece atrás de uma prova verde, e essa é a regra mais importante daqui.**
 *
 * Um item pode ser declarado por dois testes: um que roda e prova metade, e um `test.fixme` que prova a
 * outra metade e não roda, porque guarda defeito conhecido. Deixar o verde ganhar em silêncio esconderia
 * a informação mais acionável que existe — há prova escrita esperando um conserto, e quem validar aquilo
 * à mão precisa saber que o defeito é conhecido em vez de descobri-lo de novo.
 */
function decidirEstado(item, declaracoes) {
  if (declaracoes.length === 0) {
    return item.olho === null
      ? { estado: "descoberto", porque: null }
      : { estado: "olho", porque: item.olho };
  }

  const pendentes = declaracoes.filter((d) => d.pendente);
  const aviso =
    pendentes.length === 0
      ? ""
      : ` **Prova pendente** em ${[...new Set(pendentes.map((d) => d.arquivo))].join(", ")}: ` +
        "o teste está escrito e não roda, porque guarda defeito conhecido.";

  const verdes = declaracoes.filter((d) => d.verde && !d.pendente);
  if (verdes.length === 0) {
    const onde = [...new Set(pendentes.map((d) => d.arquivo))].join(", ");
    return {
      estado: "pendente",
      porque: `o único teste que afirma isto não roda, porque guarda defeito conhecido (${onde})`,
    };
  }

  const inteiras = verdes.filter((d) => !d.parcial);
  if (inteiras.length > 0) {
    return { estado: "provado", porque: aviso.trim() || null };
  }

  const faltas = [...new Set(verdes.map((d) => d.falta).filter(Boolean))];
  return {
    estado: "parcial",
    porque: (faltas.join(" · ") || "o teste toca o passo sem afirmar tudo") + aviso,
  };
}

// ---------------------------------------------------------------------------

const falhas = [];

if (!existsSync(CAMINHO_DO_RELATORIO)) {
  console.error(
    "✗ Mapa do roteiro: não achei `test-results/relatorio.json`.\n" +
      "   Ele nasce de `npm run teste:ponta-a-ponta`, que exige a pilha de pé e a semente aplicada.\n" +
      "   Sem o relatório o mapa diria que nada foi provado, que é falso e pior que não existir.",
  );
  process.exit(1);
}

const { itens, problemas } = lerRoteiro(readFileSync(CAMINHO_DO_ROTEIRO, "utf8"));
falhas.push(...problemas);

const { porItem, testes } = lerDeclaracoes(JSON.parse(readFileSync(CAMINHO_DO_RELATORIO, "utf8")));

const conhecidos = new Set(itens.map((item) => item.id));
for (const [id, declaracoes] of porItem) {
  if (conhecidos.has(id)) continue;
  const quem = [...new Set(declaracoes.map((d) => d.arquivo))].join(", ");
  falhas.push(
    `a anotação \`roteiro=${id}\` (${quem}) aponta para um passo que não existe no roteiro — ` +
      "ou o passo foi renumerado, ou a anotação está errada",
  );
}

for (const item of itens) {
  const declaracoes = porItem.get(item.id) ?? [];
  if (item.olho !== null && declaracoes.length > 0) {
    const quem = [...new Set(declaracoes.map((d) => d.arquivo))].join(", ");
    falhas.push(
      `o item \`${item.id}\` está marcado \`[olho]\` e mesmo assim é declarado por ${quem} — ` +
        "ou o marcador está errado, ou o teste declara a mais",
    );
  }
}

if (falhas.length > 0) {
  console.error(`✗ Mapa do roteiro: ${falhas.length} ${falhas.length === 1 ? "falha" : "falhas"}.`);
  for (const falha of falhas) console.error(`   · ${falha}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------

const decididos = itens.map((item) => ({
  ...item,
  ...decidirEstado(item, porItem.get(item.id) ?? []),
  declaracoes: porItem.get(item.id) ?? [],
}));

const porPainel = new Map();
for (const item of decididos) {
  const chaves = item.painel.length > 0 ? item.painel : ["(fora do painel)"];
  for (const chave of chaves) {
    if (!porPainel.has(chave)) porPainel.set(chave, []);
    porPainel.get(chave).push(item);
  }
}

const contar = (lista) => {
  const conta = { provado: 0, parcial: 0, pendente: 0, olho: 0, descoberto: 0 };
  for (const item of lista) conta[item.estado] += 1;
  return conta;
};

const resumir = (conta) => {
  const pedacos = [];
  const nome = (chave, n) =>
    chave === "provado"
      ? `${n} ${n === 1 ? "provado" : "provados"}`
      : chave === "parcial"
        ? `${n} ${n === 1 ? "parcial" : "parciais"}`
        : chave === "pendente"
          ? `${n} com prova pendente`
          : chave === "olho"
            ? `${n} só o olho`
            : `${n} ${n === 1 ? "descoberto" : "descobertos"}`;
  for (const chave of ["provado", "parcial", "pendente", "olho", "descoberto"]) {
    if (conta[chave] > 0) pedacos.push(nome(chave, conta[chave]));
  }
  return pedacos.length > 0 ? pedacos.join(", ") : "nenhum item";
};

const total = contar(decididos);
const ordemDoPainel = [...porPainel.keys()].sort((a, b) => {
  const numero = (chave) => Number.parseFloat(chave) || Number.POSITIVE_INFINITY;
  return numero(a) - numero(b) || a.localeCompare(b, "pt-BR");
});

const linhas = [];

linhas.push("# Cobertura do roteiro de validação");
linhas.push("");
linhas.push(
  "**Gerado por `npm run mapa:roteiro`. Não edite à mão** — a próxima geração apaga o que você escrever, " +
    "e um mapa editável mente com aparência de precisão.",
);
linhas.push("");
linhas.push(
  "Ele não marca `Val` e não decide nada. Diz, por item do painel, o que a máquina já provou e o que " +
    "sobra para quem exercita — para que a marcação vire uma decisão curta.",
);
linhas.push("");
linhas.push(`**Universo:** ${decididos.length} itens do roteiro, em ${porPainel.size} itens do painel.`);
linhas.push("");
linhas.push("| Estado | Itens | O que significa |");
linhas.push("|---|---|---|");
linhas.push(`| **provado** | ${total.provado} | há teste verde afirmando aquilo |`);
linhas.push(`| **parcial** | ${total.parcial} | o teste toca o passo sem afirmar tudo o que ele pede |`);
linhas.push(
  `| **prova pendente** | ${total.pendente} | o teste existe e não roda, porque guarda defeito conhecido |`,
);
linhas.push(`| **só o olho** | ${total.olho} | nenhuma máquina alcança; o roteiro diz por quê |`);
linhas.push(`| **descoberto** | ${total.descoberto} | ninguém cobre, e nada impede que alguém cubra |`);
linhas.push("");
/**
 * **A linha do estado conta mal a prova pendente, e por isso ela tem contagem própria.** Um item pode ter
 * teste verde provando metade e teste marcado provando a outra: o estado dele é `parcial`, e a coluna
 * acima não o mostra. O que interessa a quem valida é o número de itens que **têm defeito conhecido com
 * teste escrito esperando conserto**, e ele não cabe numa tabela de estados mutuamente exclusivos.
 */
const comProvaPendente = decididos.filter((item) =>
  (item.declaracoes ?? []).some((d) => d.pendente),
);

linhas.push(
  `**Fonte da execução:** ${testes.length} testes de ponta a ponta, ` +
    `${testes.filter((t) => t.verde).length} verdes e ${testes.filter((t) => t.pendente).length} pendentes.`,
);
linhas.push("");

if (comProvaPendente.length > 0) {
  const quais = comProvaPendente.map((item) => `\`${item.id}\``).join(", ");
  linhas.push(
    `**${comProvaPendente.length} ${comProvaPendente.length === 1 ? "item tem" : "itens têm"} prova ` +
      `pendente** — ${quais}. O teste que os afirma por inteiro está escrito e não roda, porque guarda ` +
      "defeito de produto conhecido. Eles aparecem abaixo no estado que o teste verde alcança, com o " +
      "aviso ao lado; nenhum deles conta como provado.",
  );
}
linhas.push("");
linhas.push("---");
linhas.push("");

for (const chave of ordemDoPainel) {
  const daChave = porPainel.get(chave).sort((a, b) => ESTADOS[a.estado].ordem - ESTADOS[b.estado].ordem);
  const conta = contar(daChave);

  linhas.push(`## Item ${chave}`);
  linhas.push("");
  linhas.push(`**${resumir(conta)}.**`);
  linhas.push("");
  linhas.push("| Passo | Estado | O que o passo pede | O que falta, ou por quê |");
  linhas.push("|---|---|---|---|");

  for (const item of daChave) {
    const texto = item.texto.replace(/\s*\[olho\][^\n]*/u, "").replace(/\|/gu, "\\|").slice(0, 110);
    const porque = (item.porque ?? "").replace(/\|/gu, "\\|");
    linhas.push(
      `| \`${item.id}\` | ${ESTADOS[item.estado].rotulo} | ${texto} | ${porque || "—"} |`,
    );
  }
  linhas.push("");
}

writeFileSync(CAMINHO_DO_MAPA, `${linhas.join("\n")}\n`, "utf8");

console.log(`✓ Mapa do roteiro: ${decididos.length} itens conferidos, nenhuma falha.`);
console.log(`   · ${resumir(total)}`);
console.log(`   · ${porPainel.size} itens do painel`);
console.log(`   · escrito em trabalho/cobertura-do-roteiro.md`);
