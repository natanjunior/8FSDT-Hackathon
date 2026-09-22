import { readFileSync } from "node:fs";
import { join } from "node:path";

import { relatar, RAIZ } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador do ambiente publicado — as variáveis que o Container App tem
 *  contra as que o repositório declara
 * ============================================================================
 *
 * **O defeito que ele existe para impedir apareceu em 20/09/2026.** O item 13a declarou
 * `ARMAZENAMENTO_CONEXAO` como quinta variável de execução em 25/08, e ela nunca chegou ao Container App.
 * Anexar foto ficou quebrado em produção por **26 dias**, sem que nada acusasse: a suíte roda contra o
 * Azurite, o uso local funciona, e o teste de ponta a ponta não anexava foto.
 *
 * ---------------------------------------------------------------------------
 *  De onde sai a lista do que é exigido
 * ---------------------------------------------------------------------------
 *
 * Do `.env.example`, e só dele: as linhas que começam com `NOME=` na **coluna zero**. As de ferramenta
 * (`BANCO_URL_TESTE`, `URL_PUBLICA`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) estão comentadas
 * naquele arquivo, e o cabeçalho dele diz por quê — a aplicação não lê nenhuma.
 *
 * **A consequência é a que se quer:** a sexta variável de execução que alguém acrescentar ao
 * `.env.example` passa a ser exigida em produção no mesmo commit, sem ninguém precisar lembrar disso.
 *
 * ---------------------------------------------------------------------------
 *  O que ele NÃO confere
 * ---------------------------------------------------------------------------
 *
 * Que o **valor** esteja certo. Ele compara nomes. Uma `ARMAZENAMENTO_CONEXAO` apontando para uma conta
 * que não existe passa por ele — e quem pega isso é a conferência à mão pelo caminho de verdade. Uma sonda
 * que *usasse* a credencial teria de escrever no storage a cada implantação.
 */

/** Os nomes declarados como variável de execução: `NOME=` na coluna zero, nunca comentado. */
export function declaradas(conteudo) {
  return conteudo
    .split(/\r?\n/u)
    .map((linha) => /^([A-Z][A-Z0-9_]*)=/u.exec(linha)?.[1])
    .filter((nome) => nome !== undefined);
}

/** O que o repositório exige e a nuvem não tem. */
export function faltando(exigidas, publicadas) {
  const tem = new Set(publicadas);
  return exigidas.filter((nome) => !tem.has(nome));
}

const exigidas = declaradas(readFileSync(join(RAIZ, ".env.example"), "utf8"));

const falhas = [];
const notas = [];

// ---------------------------------------------------------------------------
// O par de controles, no molde do `tom.mjs`: sem eles, um `faltando` que
// devolvesse sempre `[]` passaria por verificador bom para sempre.
// ---------------------------------------------------------------------------

/** O controle NEGATIVO é o V-11 em forma de lista: tudo publicado, menos o storage. */
const semOStorage = exigidas.filter((nome) => nome !== "ARMAZENAMENTO_CONEXAO");
const doNegativo = faltando(exigidas, semOStorage);

if (doNegativo.length !== 1 || doNegativo[0] !== "ARMAZENAMENTO_CONEXAO") {
  falhas.push(
    "CONTROLE NEGATIVO REPROVADO — uma publicação sem ARMAZENAMENTO_CONEXAO tem de acusar exatamente " +
      `essa variável, e acusou: ${doNegativo.join(", ") || "nada"}. ` +
      "Ou a regra parou de discriminar, ou o .env.example não declara mais essa variável.",
  );
} else {
  notas.push("controle negativo reprovado como deve — a ausência de uma variável é acusada pelo nome");
}

/** O controle POSITIVO: a publicação completa tem de passar, senão o verificador recusa tudo. */
const doPositivo = faltando(exigidas, exigidas);

if (doPositivo.length > 0) {
  falhas.push(
    `CONTROLE POSITIVO REPROVADO — a publicação completa deveria passar: ${doPositivo.join(", ")}`,
  );
} else {
  notas.push("controle positivo aprovado como deve — o verificador está discriminando, não recusando tudo");
}

// ---------------------------------------------------------------------------
// O caso de verdade.
// ---------------------------------------------------------------------------

async function publicadas() {
  const doArgumento = process.argv[2];
  if (doArgumento !== undefined && doArgumento !== "") return JSON.parse(doArgumento);

  /**
   * **Sem argumento e sem cano, ele explicaria nada e ficaria pendurado para sempre** esperando uma
   * entrada padrão que ninguém vai fechar. Quem roda `npm run verificar:ambiente` na própria máquina
   * merece a frase, não o travamento.
   */
  if (process.stdin.isTTY === true) {
    throw new Error(
      "sem lista de variáveis publicadas. Passe o JSON como argumento ou pelo cano:\n" +
        '     npm run verificar:ambiente \'["SUPABASE_URL","…"]\'\n' +
        "     az containerapp show … -o json | npm run --silent verificar:ambiente",
    );
  }

  const pedacos = [];
  for await (const pedaco of process.stdin) pedacos.push(pedaco);
  return JSON.parse(Buffer.concat(pedacos).toString("utf8"));
}

let publicadasAgora;
try {
  publicadasAgora = await publicadas();
} catch (erro) {
  console.error(
    "✗ ambiente publicado: não consegui ler a lista de variáveis publicadas.\n\n" +
      '   Ela vem da saída de `az containerapp show … --query "properties.template.containers[0].env[].name" -o json`,\n' +
      "   por argumento ou pela entrada padrão.\n" +
      `   ${erro instanceof Error ? erro.message : String(erro)}`,
  );
  process.exit(2);
}

if (!Array.isArray(publicadasAgora) || publicadasAgora.some((nome) => typeof nome !== "string")) {
  console.error("✗ ambiente publicado: a lista precisa ser um array JSON de strings.");
  process.exit(2);
}

for (const nome of faltando(exigidas, publicadasAgora)) {
  falhas.push(
    `${nome} está declarada no .env.example e NÃO existe no Container App. ` +
      "A aplicação sobe e quebra só no caminho que a usa — que foi exatamente o V-11.",
  );
}

process.exit(
  relatar("ambiente publicado", {
    conferidos: exigidas.length,
    unidade: "variável",
    plural: "variáveis",
    genero: "f",
    falhas,
    notas,
  }),
);
