import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { relatar, RAIZ } from "./comum.mjs";

/**
 * ============================================================================
 *  Verificador de imagem — nenhum segredo assado
 * ============================================================================
 *
 * O Definition of Done: *"Nenhum segredo assado na imagem. Sem `ARG` com
 * segredo, sem `.env` copiado para dentro do container. A imagem publicada é
 * pública (ADR-0004), e o que entra numa camada permanece legível **mesmo que
 * um `RUN rm` apague o arquivo depois**."*
 *
 * Era item de conferência humana. Aqui vira portão: vale em toda construção,
 * não só no dia em que alguém olhou.
 *
 * **Quatro recusas, e a primeira é a que a frase do DoD exige.** Olhar só o
 * sistema de arquivos final não encontra o arquivo apagado por um `RUN rm` — a
 * camada guarda, o sistema final não mostra. Por isso a conferência A lê o
 * histórico de construção, que é onde o `COPY` continua escrito.
 *
 * **Limite declarado (1):** o histórico do artefato final não mostra os
 * estágios intermediários de uma construção multi-estágio. A defesa contra eles
 * é o `.dockerignore`, mais a conferência C.
 *
 * **Limite declarado (2):** conforme o construtor, um `ARG` pode não gerar
 * entrada de histórico — o BuildKit nem sempre a emite. Por isso o controle
 * negativo **não exige que a regra do `ARG` dispare**: ele exige que a
 * conferência A dispare, e quem sempre a faz disparar é o `COPY` do `.env`.
 */

const NOMES = ["SUPABASE_URL", "SUPABASE_CHAVE_ANONIMA", "BANCO_URL", "SEGREDO_DE_SESSAO"];

/** Prefixos das chaves do provedor. Valor vazado é pior que nome vazado. */
const VALORES = ["sb_publishable_", "sb_secret_"];

/**
 * A base, e o motivo de ela estar aqui: `docker history` mostra **também as
 * camadas da imagem base**, que não são nossas e que podem legitimamente ter um
 * `ARG`. Recusar por causa delas seria alarme falso permanente. Então as
 * camadas da base são subtraídas, e o que sobra é o que este repositório
 * construiu.
 *
 * **Tem de ser a mesma base do `Dockerfile`.** Se ela mudar lá, muda aqui.
 */
const BASE = "node:24-alpine";

const IMAGEM = process.argv[2] ?? "resolve-ai:local";
const CONTROLE = "resolve-ai-controle-negativo:conferencia";

function docker(argumentos, { tolerarFalha = false } = {}) {
  try {
    return execFileSync("docker", argumentos, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (erro) {
    if (tolerarFalha) return "";
    console.error(`\n✗ \`docker ${argumentos.join(" ")}\` falhou.\n${erro.stderr ?? erro.message}`);
    return process.exit(1);
  }
}

const resumir = (texto) => texto.replaceAll(/\s+/gu, " ").trim().slice(0, 120);

const historicoDe = (imagem, { tolerarFalha = false } = {}) =>
  docker(["history", "--no-trunc", "--format", "{{.CreatedBy}}", imagem], { tolerarFalha })
    .split(/\r?\n/u)
    .filter((linha) => linha.trim() !== "");

/** As camadas que já vieram da base não são nossas — e não são conferidas. */
const daBase = new Set(historicoDe(BASE, { tolerarFalha: true }));

/** As quatro conferências. Devolve a lista de falhas — vazia quer dizer limpa. */
function conferir(imagem) {
  const falhas = [];

  // --- A · o histórico de construção, menos o que veio da base -------------
  for (const linha of historicoDe(imagem).filter((l) => !daBase.has(l))) {
    if (/(^|\|\s*|\s)ARG\s+\w/u.test(linha)) falhas.push(`A · ARG na construção: ${resumir(linha)}`);
    if (/COPY[^|]*\s\.env(\.|\s|$)/iu.test(linha)) falhas.push(`A · .env copiado numa camada: ${resumir(linha)}`);
    for (const nome of NOMES) {
      if (linha.includes(nome)) falhas.push(`A · ${nome} no histórico: ${resumir(linha)}`);
    }
    for (const prefixo of VALORES) {
      if (linha.includes(prefixo)) falhas.push(`A · valor de chave no histórico: ${resumir(linha)}`);
    }
  }

  // --- B · o ambiente que a imagem carrega ---------------------------------
  const ambiente = JSON.parse(docker(["image", "inspect", "--format", "{{json .Config.Env}}", imagem]));

  for (const par of ambiente) {
    const nome = par.split("=")[0] ?? "";
    if (NOMES.includes(nome)) falhas.push(`B · ${nome} embutida no ambiente da imagem`);
    if (nome.startsWith("NEXT_PUBLIC_")) falhas.push(`B · ${nome} embutida — o projeto não tem nenhuma NEXT_PUBLIC_*`);
    for (const prefixo of VALORES) {
      if (par.includes(prefixo)) falhas.push(`B · valor de chave no ambiente: ${nome}`);
    }
  }

  // --- C · o sistema de arquivos final -------------------------------------
  const encontrados = docker(
    ["run", "--rm", "--entrypoint", "sh", imagem, "-c", "find /app -maxdepth 3 -name '.env*' -print"],
    { tolerarFalha: true },
  );

  for (const caminho of encontrados.split(/\r?\n/u).filter((l) => l.trim() !== "")) {
    falhas.push(`C · arquivo de ambiente dentro da imagem: ${caminho.trim()}`);
  }

  // --- D · o que vai ao navegador ------------------------------------------
  const alvos = [...NOMES, ...VALORES].join("|");
  const noPacote = docker(
    [
      "run", "--rm", "--entrypoint", "sh", imagem,
      "-c", `grep -rlE '${alvos}' /app/.next/static /app/public 2>/dev/null | head -5`,
    ],
    { tolerarFalha: true },
  );

  for (const arquivo of noPacote.split(/\r?\n/u).filter((l) => l.trim() !== "")) {
    falhas.push(`D · nome ou valor de variável dentro do pacote do navegador: ${arquivo.trim()}`);
  }

  return falhas;
}

// ---------------------------------------------------------------------------

const existe = docker(["image", "inspect", "--format", "{{.Id}}", IMAGEM], { tolerarFalha: true });

if (existe.trim() === "") {
  console.error(
    `\n✗ A imagem \`${IMAGEM}\` não existe nesta máquina.\n` +
      `   Construa com \`docker compose build\` (ou passe outra: \`npm run verificar:imagem -- outra:etiqueta\`).`,
  );
  process.exit(1);
}

const falhas = conferir(IMAGEM);

// ---------------------------------------------------------------------------
// O controle diferencial: uma imagem que comete os erros de propósito. Se ela
// passar, o verificador não está verificando — e aí a falha é do verificador,
// não da imagem de verdade. Ver o Dockerfile em fixtures/imagem-insegura/.
// ---------------------------------------------------------------------------

const notas = [];

docker(["build", "--quiet", "-t", CONTROLE, join(RAIZ, "ferramentas/verificadores/fixtures/imagem-insegura")]);

const doControle = conferir(CONTROLE);

/**
 * **Não basta o controle ser recusado: ele tem de ser recusado pelas quatro.**
 * As conferências C e D rodam `find` e `grep` dentro do container e toleram
 * falha — uma opção que o BusyBox não tenha devolveria saída vazia, que é
 * indistinguível de imagem limpa. Exigir que cada conferência dispare contra o
 * controle é o que impede uma delas de passar em silêncio para sempre.
 */
const familias = new Set(doControle.map((falha) => falha.slice(0, 1)));
const mudas = ["A", "B", "C", "D"].filter((letra) => !familias.has(letra));

if (mudas.length > 0) {
  falhas.push(
    `CONTROLE NEGATIVO INCOMPLETO — a imagem que erra de propósito não foi recusada pela(s) conferência(s) ` +
      `${mudas.join(", ")}. Conferência que não dispara contra o controle é conferência que pode estar ` +
      `passando em silêncio: comando do docker trocado, opção que o BusyBox não tem, ou o fixture mudou.`,
  );
} else {
  notas.push(`controle negativo recusado pelas quatro conferências — ${doControle.length} falha(s) ao todo.`);
}

docker(["image", "rm", "-f", CONTROLE], { tolerarFalha: true });

process.exit(relatar("Imagem", { conferidos: 4, unidade: "aspecto", falhas, notas }));
