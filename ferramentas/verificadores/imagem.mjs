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
 * Era item de conferência humana. Aqui vira portão: obrigatório antes de a
 * imagem ir ao registro, no emprego `publicar` — não em toda construção. Em
 * pull request ele não roda, porque `publicar` depende de `migrar`, que a
 * esteira pula ali (`entrega.yml`).
 *
 * **Quatro recusas, e a primeira é a que a frase do DoD exige.** Olhar só o
 * sistema de arquivos final não encontra o arquivo apagado por um `RUN rm` — a
 * camada guarda, o sistema final não mostra. Por isso a conferência A lê o
 * histórico de construção, que é onde o `COPY` continua escrito.
 *
 * **C e D toleram falha, e saída vazia é o resultado que as duas dão tanto
 * para "imagem limpa" quanto para "não consegui olhar".** Sem `sh` no
 * container, com os diretórios movidos, ou com uma opção do BusyBox faltando,
 * as duas voltariam vazias do mesmo jeito. Por isso existe o canário positivo:
 * antes de confiar na saída vazia de C ou D, ele prova, contra a própria
 * `IMAGEM`, que `/app`, `/app/.next/static` e `/app/public` existem e são
 * legíveis pelo usuário com que ela roda. Canário mudo é falha, não imagem
 * limpa.
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

/** As sete do `.env.example`. A `ARMAZENAMENTO_CONEXAO` faltava desde o 13a; as duas do e-mail são do 122. */
const NOMES = [
  "SUPABASE_URL",
  "SUPABASE_CHAVE_ANONIMA",
  "BANCO_URL",
  "SEGREDO_DE_SESSAO",
  "ARMAZENAMENTO_CONEXAO",
  "CORREIO_SMTP_URL",
  "CORREIO_REMETENTE",
];

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

// Acumulador de notas informativas — linhas que aparecem no relatório mas não
// derrubam a esteira. Declarado aqui, e não mais abaixo, porque a subtração de
// camadas da base já pode gerar uma logo em seguida.
const notas = [];

/** As camadas que já vieram da base não são nossas — e não são conferidas. */
const daBase = new Set(historicoDe(BASE, { tolerarFalha: true }));

if (daBase.size === 0) {
  // No runner, a base é puxada pelo construtor buildx, não para o daemon — o
  // `docker history` dela falha, `tolerarFalha` devolve "", e a subtração vira
  // conjunto vazio. Hoje inofensivo (a conferência A passa a varrer também as
  // camadas da própria base, e nada nelas casa com as regras), mas silencioso
  // não pode ser: fica registrado aqui.
  notas.push(
    "a base (`node:24-alpine`) não estava no daemon; a subtração de camadas da base não foi aplicada — " +
      "a conferência A também varreu as camadas dela.",
  );
}

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
  const ambiente = JSON.parse(docker(["image", "inspect", "--format", "{{json .Config.Env}}", imagem])) ?? [];

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

/**
 * O canário positivo — o oposto do controle negativo, mais abaixo. O controle
 * prova que C e D disparam contra uma imagem que erra de propósito; ele não
 * prova que as duas enxergam a imagem sob teste de verdade. Este canário
 * prova isso: roda `sh` dentro da imagem indicada e exige que os diretórios
 * que C (`/app`) e D (`/app/.next/static`, `/app/public`) varrem existam e
 * sejam legíveis pelo usuário com que a imagem roda. Sem `sh`, sem os
 * diretórios, ou sem permissão de leitura, o canário não ecoa — e devolve
 * `false`, não uma saída vazia que alguém possa confundir com "está tudo bem".
 */
function canarioPositivo(imagem) {
  const saida = docker(
    [
      "run", "--rm", "--entrypoint", "sh", imagem,
      "-c", "test -r /app && test -r /app/.next/static && test -r /app/public && echo CANARIO-OK",
    ],
    { tolerarFalha: true },
  );
  return saida.includes("CANARIO-OK");
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
// Canário positivo, contra a própria IMAGEM. Se ele não ecoar, C e D acabaram
// de ficar cegas — e uma saída vazia delas, sem isto, seria lida como imagem
// limpa em vez de conferência que não conseguiu olhar.
// ---------------------------------------------------------------------------

if (!canarioPositivo(IMAGEM)) {
  falhas.push(
    "CANÁRIO · `sh` não respondeu, ou /app, /app/.next/static ou /app/public não são legíveis nesta imagem — " +
      "sem isso, a saída vazia de C ou D não distingue imagem limpa de conferência cega.",
  );
}

// ---------------------------------------------------------------------------
// O controle diferencial: uma imagem que comete os erros de propósito. Se ela
// passar, o verificador não está verificando — e aí a falha é do verificador,
// não da imagem de verdade. Ver o Dockerfile em fixtures/imagem-insegura/.
//
// `--load`: no emprego `publicar`, o `docker/setup-buildx-action` já trocou o
// construtor corrente para o driver `docker-container`. Com ele, um `build`
// sem `--load` e sem `--push` não entrega nada ao daemon — a etiqueta nunca
// passa a existir, e o `docker history` do controle, logo abaixo, falharia
// por um motivo que não tem nada a ver com a imagem de verdade. `--load` é
// no-op com o driver `docker` padrão, então a máquina de quem desenvolve não
// muda em nada.
// ---------------------------------------------------------------------------

docker(["build", "--quiet", "--load", "-t", CONTROLE, join(RAIZ, "ferramentas/verificadores/fixtures/imagem-insegura")]);

const doControle = conferir(CONTROLE);

/**
 * **Não basta o controle ser recusado: ele tem de ser recusado pelas quatro.**
 * As conferências C e D rodam `find` e `grep` dentro do container e toleram
 * falha — uma opção que o BusyBox não tenha devolveria saída vazia, que é
 * indistinguível de imagem limpa. Exigir que cada conferência dispare contra o
 * controle prova que as quatro funcionam **contra uma imagem que erra de
 * propósito** — não que elas enxergam a imagem sob teste; essa segunda prova
 * é o canário positivo, lá em cima, contra a própria `IMAGEM`.
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
