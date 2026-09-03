#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { RAIZ } from "./verificadores/comum.mjs";

/**
 * ============================================================================
 *  Um comando sobe o ambiente local — E7 do enunciado, critério 39.1
 * ============================================================================
 *
 * O critério pede *"num clone limpo, sem nenhum passo manual"*. Antes deste
 * arquivo eram quatro comandos e duas variáveis preenchidas à mão, e "à mão"
 * é onde a verificação por outra pessoa morria.
 *
 * **A divisão da `arquitetura.md` §9 continua intacta:** o Supabase CLI é dono
 * de Postgres e Auth, o `docker-compose.yml` é dono da aplicação. Este script
 * não reimplementa nenhum dos dois — ele só põe os dois na ordem certa.
 *
 * A ordem importa e não é a que a spec desenhou: a chave vem do
 * `supabase status`, que **exige a pilha de pé**. Então é start, depois status,
 * depois o arquivo.
 *
 * `migration up` e não `db reset`: o segundo apaga o banco local, e um comando
 * de subida que destrói dados na segunda execução é uma armadilha. Quem quer
 * recriar do zero tem `npm run migrar:local`, que já existe e diz o que faz.
 */

const NO_WINDOWS = process.platform === "win32";

/** A CLI do Supabase é um `.cmd` no Windows; sem `shell` o spawn não a encontra. */
function rodar(comando, argumentos, { capturar = false } = {}) {
  const resultado = spawnSync(comando, argumentos, {
    cwd: RAIZ,
    encoding: "utf8",
    shell: NO_WINDOWS,
    stdio: capturar ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (resultado.status !== 0) {
    // `status: null` não é falha do comando — é o comando **não ter sido
    // encontrado ou não ter chegado a rodar**, e os dois casos apareciam como
    // `falhou (código null)`, que não diz nada a quem rodou.
    console.error(`\n✗ \`${comando} ${argumentos.join(" ")}\` falhou (código ${resultado.status ?? "não chegou a rodar"}).`);
    if (resultado.error) console.error(`  ${resultado.error.message}`);
    process.exit(resultado.status ?? 1);
  }

  return resultado.stdout ?? "";
}

function anunciar(texto) {
  console.log(`\n── ${texto} ${"─".repeat(Math.max(0, 68 - texto.length))}`);
}

/** Erro de subida com causa nomeada. Nunca deixe pilha de biblioteca chegar a quem rodou. */
function desistir(titulo, ...linhas) {
  console.error(`\n✗ ${titulo}\n`);
  for (const linha of linhas) console.error(linha ? `  ${linha}` : "");
  console.error("");
  process.exit(1);
}

// ---------------------------------------------------------------------------
//  Diagnóstico de porta — o que faltava, e o que custou (30/08/2026)
//
//  Duas subidas quebraram na mesma porta, por causas OPOSTAS, e as duas
//  chegaram como pilha do SDK do Azure em vez de frase:
//
//    · a 10000 é a porta padrão do Azurite **e** a do Thrift do Spark. Um
//      container de outro projeto a segurava, e o SDK morreu com
//      `Parse Error: Expected HTTP/` — que é protocolo binário, não HTTP;
//    · depois, o nosso próprio container voltou de um restart sem o binding,
//      e o SDK morreu com `ECONNREFUSED`.
//
//  As três funções abaixo existem para que essas duas frases apareçam como
//  frases. Zero dependência de npm, porque este arquivo é o caminho de subida.
// ---------------------------------------------------------------------------

const PORTA_DO_STORAGE = 10000;
const PORTA_DA_APLICACAO = 3000;
const SONDA = `http://127.0.0.1:${PORTA_DO_STORAGE}/devstoreaccount1?comp=list`;

/**
 * Bate na porta **do host** e classifica o que atende. É a pergunta que o
 * `healthcheck` do compose não consegue fazer: ele roda DENTRO do container.
 *
 * `403 AuthorizationFailure` é resposta boa — significa Azurite de pé, só sem
 * assinatura na requisição. Quem confirma a identidade é o cabeçalho `server`.
 */
async function sondarPorta(tempoLimite = 3000) {
  try {
    const resposta = await fetch(SONDA, { signal: AbortSignal.timeout(tempoLimite) });
    const servidor = resposta.headers.get("server") ?? "";
    return { estado: /azurite/iu.test(servidor) ? "azurite" : "outro-http", servidor, status: resposta.status };
  } catch (erro) {
    const causa = erro?.cause ?? erro;
    const codigo = causa?.code ?? erro?.name ?? "";
    const mensagem = String(causa?.message ?? erro?.message ?? erro);

    if (codigo === "ECONNREFUSED") return { estado: "livre" };
    if (codigo === "TimeoutError" || codigo === "AbortError") return { estado: "mudo" };
    // `HPE_*` é o parser de HTTP do Node recusando bytes que não são HTTP.
    if (codigo.startsWith("HPE_") || /Parse Error/iu.test(mensagem)) return { estado: "nao-http", mensagem };
    return { estado: "erro", mensagem };
  }
}

/** Containers que PUBLICAM a porta, e processos do host que a ESCUTAM. */
function donoDaPorta(porta) {
  // **`shell: false`, ao contrário do resto do arquivo, e isto não é descuido.**
  //
  // O `shell: NO_WINDOWS` existe porque a CLI do Supabase é um `.cmd`, que o
  // `CreateProcess` do Windows não encontra sozinho. O `docker` é `.exe` — o
  // shell nunca foi necessário para ele. E é ativamente nocivo aqui: com
  // `shell: true` o `spawnSync` concatena os argumentos **sem escapar**
  // (`DEP0190`), então o `|` do `--format` abaixo vira um *pipe* do `cmd` e a
  // consulta devolve vazio. Vazio, aqui, significa "a porta não é de nenhum
  // container" — e o script passaria a acusar o proxy do próprio Docker
  // (`com.docker.backend.exe`) de estar ocupando a porta do nosso Azurite.
  const consultaDocker = spawnSync("docker", ["ps", "--filter", `publish=${porta}`, "--format", "{{.Names}}|{{.Image}}"], {
    cwd: RAIZ,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
  });

  const containers = (consultaDocker.stdout ?? "")
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((linha) => {
      const [nome, imagem] = linha.split("|");
      return { nome, imagem };
    });

  const consultaHost = NO_WINDOWS
    ? spawnSync("netstat", ["-ano"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    : spawnSync("sh", ["-c", `lsof -nP -iTCP:${porta} -sTCP:LISTEN`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

  const saida = consultaHost.stdout ?? "";

  if (!NO_WINDOWS) {
    const processos = saida
      .trim()
      .split(/\r?\n/u)
      .slice(1)
      .filter(Boolean)
      .map((linha) => {
        const campos = linha.trim().split(/\s+/u);
        return { nome: campos[0], pid: campos[1] };
      });
    return { containers, processos };
  }

  const pids = new Set(
    saida
      .split(/\r?\n/u)
      .filter((linha) => new RegExp(`:${porta}\\s`, "u").test(linha) && /LISTENING/u.test(linha))
      .map((linha) => linha.trim().split(/\s+/u).at(-1))
      .filter((pid) => pid && pid !== "0"),
  );

  const processos = [...pids].map((pid) => {
    const lista = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH", "/FO", "CSV"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { nome: /^"([^"]+)"/u.exec((lista.stdout ?? "").trim())?.[1] ?? "desconhecido", pid };
  });

  return { containers, processos };
}

/**
 * A porta está livre, é nossa, ou é de outro?
 *
 * **Containers primeiro, e a ordem importa.** No Windows, container que publica
 * porta também aparece no `netstat` — como um processo do backend do Docker. Se
 * o `netstat` fosse consultado antes, o nosso próprio Azurite seria acusado de
 * ocupar a porta que ele deve ocupar.
 */
function estadoDaPorta(porta, containerEsperado) {
  const { containers, processos } = donoDaPorta(porta);

  if (containers.some((c) => c.nome === containerEsperado)) return { estado: "nosso" };

  if (containers.length > 0) {
    return {
      estado: "alheio",
      quem: containers.map((c) => `container \`${c.nome}\` (${c.imagem})`),
      comoLiberar: `docker stop ${containers[0].nome}`,
    };
  }

  if (processos.length > 0) {
    return {
      estado: "alheio",
      quem: processos.map((p) => `processo \`${p.nome}\`${p.pid ? ` (PID ${p.pid})` : ""}`),
      comoLiberar: NO_WINDOWS ? `taskkill /PID ${processos[0].pid} /F` : `kill ${processos[0].pid}`,
    };
  }

  return { estado: "livre" };
}

// ---------------------------------------------------------------------------
// 0 · Pré-voo.
//
//     **Existe porque toda falha de pré-requisito chegava como falha de outra
//     coisa.** Docker parado aparecia como erro da CLI do Supabase; porta
//     ocupada aparecia como pilha do SDK do Azure, quatro seções depois. Sete
//     linhas aqui poupam a depuração inteira — e são as sete primeiras coisas
//     que qualquer pessoa conferiria à mão.
// ---------------------------------------------------------------------------

anunciar("Pré-voo");

for (const { programa, argumentos, nome, conserto } of [
  { programa: "docker", argumentos: ["version", "--format", "{{.Server.Version}}"], nome: "Docker", conserto: "Abra o Docker Desktop e espere o ícone ficar verde. Sem daemon, nada aqui sobe." },
  { programa: "supabase", argumentos: ["--version"], nome: "CLI do Supabase", conserto: "Instale com `npm i -g supabase` ou veja o README, seção `O que precisa estar instalado`." },
]) {
  const teste = spawnSync(programa, argumentos, { cwd: RAIZ, encoding: "utf8", shell: NO_WINDOWS, stdio: ["ignore", "pipe", "pipe"] });

  if (teste.status !== 0) {
    const detalhe = `${teste.stdout ?? ""}${teste.stderr ?? ""}`.trim().split(/\r?\n/u)[0];
    desistir(
      `${nome} não respondeu.`,
      conserto,
      "",
      `Comando: \`${programa} ${argumentos.join(" ")}\``,
      detalhe ? `Resposta: ${detalhe}` : `Resposta: (nada — o executável \`${programa}\` provavelmente não está no PATH)`,
    );
  }

  console.log(`   · ${nome} — ${(teste.stdout ?? "").trim().split(/\r?\n/u)[0] || "ok"}`);
}

// As duas portas, conferidas **agora** e não quando cada uma for usada.
//
// Descobrir a 3000 ocupada depois de subir Postgres, escrever `.env.local`,
// migrar, subir o Azurite e **construir a imagem** é descobrir tarde: foram
// quatro minutos de trabalho para morrer no último passo, com uma mensagem do
// daemon sobre `bind` que não nomeia quem está na porta. Aconteceu em
// 30/08/2026, e as duas vezes o culpado tinha nome — `aida-mock` na 10000,
// um `npm run dev` esquecido na 3000.
for (const { porta, container, paraQue, observacao } of [
  { porta: PORTA_DO_STORAGE, container: "resolve-ai-azurite", paraQue: "storage (Azurite)", observacao: "É também a porta do Thrift do Spark — a disputa é comum." },
  { porta: PORTA_DA_APLICACAO, container: "resolve-ai", paraQue: "aplicação", observacao: "Um `npm run dev` aberto em outro terminal usa esta mesma porta." },
]) {
  const estado = estadoDaPorta(porta, container);

  if (estado.estado === "alheio") {
    desistir(
      `A porta ${porta} (${paraQue}) está ocupada por outra coisa.`,
      `Quem está lá: ${estado.quem.join(", ")}.`,
      observacao,
      "",
      "Libere a porta e rode de novo:",
      "",
      `    ${estado.comoLiberar}`,
    );
  }

  console.log(`   · porta ${porta} (${paraQue}) — ${estado.estado === "nosso" ? `já é do \`${container}\`` : "livre"}`);
}

// ---------------------------------------------------------------------------
// 1 · A pilha do provedor. Se já estiver de pé, a CLI diz e sai bem.
// ---------------------------------------------------------------------------

anunciar("Postgres e Auth locais");
rodar("supabase", ["start"]);

// ---------------------------------------------------------------------------
// 2 · O `.env.local`. Escrito só se não existir — arquivo de quem trabalha
//     aqui nunca é sobrescrito por script.
// ---------------------------------------------------------------------------

const caminhoDoEnv = join(RAIZ, ".env.local");

const saida = rodar("supabase", ["status", "-o", "env"], { capturar: true });

/** As linhas vêm como `CHAVE="valor"`. */
const doStatus = new Map(
  saida
    .split(/\r?\n/u)
    .map((linha) => /^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/u.exec(linha.trim()))
    .filter(Boolean)
    .map((achado) => [achado[1], achado[2]]),
);

const exigir = (...nomes) => {
  for (const nome of nomes) {
    const valor = doStatus.get(nome);
    if (valor) return valor;
  }
  return desistir(
    `O \`supabase status\` não trouxe ${nomes.join(" nem ")}.`,
    "Rode `supabase status -o env` e ajuste os nomes neste script — a CLI já os mudou antes.",
  );
};

/** A CLI imprime 127.0.0.1; dentro do container isso é o próprio container. */
const paraODocker = (url) => url.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal");

const ARMAZENAMENTO =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;" +
  "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
  `BlobEndpoint=http://host.docker.internal:${PORTA_DO_STORAGE}/devstoreaccount1;`;

/** As quatro que derivam de fora. `SEGREDO_DE_SESSAO` fica fora: é sorteado por subida. */
const esperadas = {
  SUPABASE_URL: paraODocker(exigir("API_URL")),
  SUPABASE_CHAVE_ANONIMA: exigir("PUBLISHABLE_KEY", "ANON_KEY"),
  BANCO_URL: paraODocker(exigir("DB_URL")),
  ARMAZENAMENTO_CONEXAO: ARMAZENAMENTO,
};

if (!existsSync(caminhoDoEnv)) {
  anunciar("Escrevendo o .env.local a partir do `supabase status`");

  const conteudo = [
    "# Escrito por `npm run local` (ferramentas/ambiente-local.mjs).",
    "# Os porquês de cada variável estão no `.env.example`, que é a documentação.",
    "# Este arquivo é ignorado pelo git e pelo Docker — nada daqui entra na imagem.",
    "",
    ...Object.entries(esperadas).map(([chave, valor]) => `${chave}=${valor}`),
    `SEGREDO_DE_SESSAO=${randomBytes(32).toString("base64url")}`,
    "",
  ].join("\n");

  writeFileSync(caminhoDoEnv, conteudo, "utf8");
  console.log("   · cinco variáveis escritas; o segredo de sessão foi gerado agora.");
} else {
  // -------------------------------------------------------------------------
  //  **Não sobrescreve — mas também não fica calado.**
  //
  //  Até 30/08/2026 esta seção imprimia *".env.local já existe — não vou
  //  encostar nele"* e seguia. A intenção estava certa (arquivo de quem
  //  trabalha aqui não é sobrescrito por script), mas o silêncio custava caro:
  //  a CLI do Supabase **trocou o formato das chaves** (o `ANON_KEY` em JWT
  //  virou `PUBLISHABLE_KEY` com prefixo `sb_publishable_`), e um `.env.local`
  //  escrito antes disso continua ali, plausível, apontando para uma chave que
  //  o Auth não aceita mais. A falha aparece como `401` na primeira
  //  requisição — indistinguível de senha errada.
  //
  //  Comparar e AVISAR mantém as duas propriedades: o arquivo é seu, e a
  //  divergência tem nome. Só nomes de variável são impressos, nunca valores.
  // -------------------------------------------------------------------------
  anunciar(".env.local já existe");

  const doArquivo = new Map(
    readFileSync(caminhoDoEnv, "utf8")
      .split(/\r?\n/u)
      .map((linha) => /^([A-Z0-9_]+)\s*=\s*(.*)$/u.exec(linha.trim()))
      .filter(Boolean)
      .map((achado) => [achado[1], achado[2].trim()]),
  );

  const divergentes = Object.entries(esperadas).filter(([chave, valor]) => doArquivo.get(chave) !== valor);
  const faltando = ["SEGREDO_DE_SESSAO"].filter((chave) => !doArquivo.has(chave));

  if (divergentes.length === 0 && faltando.length === 0) {
    console.log("   · confere com o `supabase status`. Não encostei nele.");
  } else {
    console.warn("   ⚠ ele diverge do que o ambiente local diz agora:");
    for (const [chave] of divergentes) {
      console.warn(`     · ${chave} — ${doArquivo.has(chave) ? "valor diferente do atual" : "ausente"}`);
    }
    for (const chave of faltando) console.warn(`     · ${chave} — ausente`);
    console.warn("");
    console.warn("     A CLI do Supabase já trocou o formato das chaves antes, e chave velha falha");
    console.warn("     como `401` na primeira requisição — que parece senha errada, e não é.");
    console.warn("");
    console.warn("     Para regerar (apaga o `SEGREDO_DE_SESSAO`, o que só derruba as sessões abertas):");
    console.warn("");
    console.warn("         del .env.local  &&  npm run local");
  }
}

// ---------------------------------------------------------------------------
// 3 · O database da suíte de integração.
//
//     **Existe para que a suíte pare de escrever no banco de desenvolvimento.** Ela derruba as tabelas
//     do esquema e reaplica as migrações por fora da CLI (`testes/integracao/esquema.ts`), o que apagava os
//     dados de trabalho e deixava `schema_migrations` atrasada — e a subida seguinte falhava com
//     `type "..." already exists`. O outro lado desta decisão é `testes/integracao/banco.ts`.
//
//     **`docker exec` e não o `pg` do package.json**, para que este arquivo continue sem dependência
//     nenhuma: ele é o caminho de subida, e um `import` aqui o prenderia a `node_modules`.
//
//     *(Até o item 13a a segunda metade desta frase dizia que o emprego `compose` do `entrega.yml` roda
//     `npm run local` num runner **sem `npm ci`**. Deixou de ser verdade: `ferramentas/azurite.mjs`, que
//     o bloco 4.5 abaixo invoca, importa o SDK do Azure, e o emprego passou a instalar. A razão de este
//     arquivo seguir sem `import` é a de cima, que não dependia daquela.)*
// ---------------------------------------------------------------------------

/** Repetido de `testes/integracao/banco.ts` de propósito — ver o comentário acima sobre dependências. */
const DATABASE_DE_TESTE = "resolveai_teste";

/** O `project_id` nomeia os containers do CLI. Uma linha por regex; um parser de TOML seria dependência. */
function projetoDoSupabase() {
  try {
    const toml = readFileSync(join(RAIZ, "supabase", "config.toml"), "utf8");
    return /^\s*project_id\s*=\s*"([^"]+)"/mu.exec(toml)?.[1];
  } catch {
    return undefined;
  }
}

anunciar("Database da suíte de integração");

const projeto = projetoDoSupabase();

if (projeto === undefined) {
  console.warn(`   ⚠ não achei \`project_id\` em supabase/config.toml — pulei o \`${DATABASE_DE_TESTE}\`.`);
  console.warn("     Só o `npm run teste:integracao` depende dele; a subida segue.");
} else {
  // **`createdb` e não `psql -c "create database …"`**, e a diferença não é de gosto: com `shell: true` o
  // `spawnSync` **concatena** os argumentos sem escapar (`DEP0190` do Node), então o espaço de
  // `create database x` vira três argumentos e o psql responde `extra command-line argument "database"
  // ignored`. Nenhum argumento do `createdb` tem espaço, então ele se comporta igual com e sem shell.
  const criacao = spawnSync(
    "docker",
    ["exec", `supabase_db_${projeto}`, "createdb", "-U", "postgres", DATABASE_DE_TESTE],
    { cwd: RAIZ, encoding: "utf8", shell: NO_WINDOWS, stdio: ["ignore", "pipe", "pipe"] },
  );

  const saida = `${criacao.stdout ?? ""}${criacao.stderr ?? ""}`;

  if (criacao.status === 0) {
    console.log(`   · database \`${DATABASE_DE_TESTE}\` criado.`);
  } else if (saida.includes("already exists")) {
    console.log(`   · database \`${DATABASE_DE_TESTE}\` já existe.`);
  } else {
    // **Aviso, e não `process.exit`.** O database de teste não é pré-requisito para a aplicação subir, e
    // derrubar a subida por causa dele criaria um jeito novo de `npm run local` falhar para consertar um
    // jeito antigo — o avesso do que o item 39.2 existe para fazer.
    console.warn(`   ⚠ não consegui criar o database \`${DATABASE_DE_TESTE}\`; a subida segue.`);
    console.warn(`     ${saida.trim().split(/\r?\n/u)[0] ?? "(sem saída)"}`);
    console.warn("     Só o `npm run teste:integracao` depende dele.");
  }
}

// ---------------------------------------------------------------------------
// 4 · O esquema. Idempotente: aplica o que falta e não apaga o que existe.
// ---------------------------------------------------------------------------

anunciar("Migrações");

const migracao = spawnSync("supabase", ["migration", "up"], {
  cwd: RAIZ,
  encoding: "utf8",
  shell: NO_WINDOWS,
  stdio: ["ignore", "pipe", "pipe"],
});

const saidaDaMigracao = `${migracao.stdout ?? ""}${migracao.stderr ?? ""}`;
console.log(saidaDaMigracao.trimEnd());

if (migracao.status !== 0) {
  console.error(`\n✗ \`supabase migration up\` falhou (código ${migracao.status}).`);

  // `already exists` é a assinatura de esquema à frente do histórico: os objetos estão no banco e
  // `schema_migrations` não os registra. Sem esta explicação, a mensagem do Postgres fala de um tipo
  // duplicado e não menciona a causa, que costuma ser um caminho que escreveu por fora da CLI.
  if (saidaDaMigracao.includes("already exists")) {
    console.error(
      "\n  O esquema tem objetos que o histórico de migrações não registra — alguma coisa aplicou\n" +
        "  migração por fora da CLI. Veja a divergência com:\n" +
        "\n      supabase migration list --local\n" +
        "\n  E escolha, sabendo o preço de cada um:\n" +
        "\n      supabase migration repair --status applied <versão> --local\n" +
        "        Registra sem rodar SQL. Só é correto se o esquema JÁ tiver tudo o que aquela migração\n" +
        "        cria — senão ele fica faltando objeto em silêncio, e isso só aparece no `db push`.\n" +
        "\n      npm run migrar:local\n" +
        "        `supabase db reset`: recria do zero e registra certo. APAGA os dados locais E as contas\n" +
        "        de login do `auth`.\n",
    );
  }

  process.exit(migracao.status ?? 1);
}

// ---------------------------------------------------------------------------
// 4.5 · O storage local. Sobe sozinho e é configurado antes da aplicação, para
//       que a primeira foto do dia não caia num contêiner que não existe.
// ---------------------------------------------------------------------------

anunciar("Storage local (Azurite)");

/**
 * Sobe e **confere do host**, com uma tentativa de conserto.
 *
 * O `--wait` do Compose devolve o controle quando o `healthcheck` fica verde, e
 * aquele healthcheck roda DENTRO do container: ele prova que o Azurite iniciou,
 * nunca que o host o alcança. Em 30/08/2026 o container voltou de um restart do
 * daemon com `NetworkSettings.Ports` vazio — verde por dentro, inalcançável por
 * fora —, e a subida morreu com `ECONNREFUSED` dentro do SDK do Azure.
 *
 * A autocura é `--force-recreate`, que foi o que resolveu à mão. Ela roda **uma
 * vez**: se a segunda sonda também falhar, a causa não é estado velho de
 * container, e insistir só atrasaria a mensagem.
 */
rodar("docker", ["compose", "up", "--detach", "--wait", "--wait-timeout", "60", "azurite"]);

let sonda = await sondarPorta();

if (sonda.estado !== "azurite") {
  console.warn(`   ⚠ o container subiu saudável, mas o host não o alcança (${sonda.estado}). Recriando.`);

  spawnSync("docker", ["compose", "up", "--detach", "--force-recreate", "--wait", "--wait-timeout", "60", "azurite"], {
    cwd: RAIZ,
    encoding: "utf8",
    shell: NO_WINDOWS,
    stdio: "inherit",
  });

  sonda = await sondarPorta();
}

if (sonda.estado !== "azurite") {
  const ligacoes = spawnSync("docker", ["port", "resolve-ai-azurite"], {
    cwd: RAIZ,
    encoding: "utf8",
    shell: NO_WINDOWS,
    stdio: ["ignore", "pipe", "ignore"],
  });

  desistir(
    `O Azurite não responde em 127.0.0.1:${PORTA_DO_STORAGE}, nem depois de recriar o container.`,
    `Sonda: ${sonda.estado}${sonda.mensagem ? ` — ${sonda.mensagem}` : ""}`,
    `Portas publicadas pelo container: ${(ligacoes.stdout ?? "").trim() || "NENHUMA — o mapeamento não saiu."}`,
    "",
    "Se a lista acima estiver vazia, o Docker aceitou o container e não publicou a porta.",
    "Reiniciar o Docker Desktop resolve; se não resolver, veja quem mais quer a 10000:",
    "",
    "    docker ps --filter publish=10000",
    "    netstat -ano | findstr :10000",
  );
}

console.log(`   · Azurite alcançável do host (\`${sonda.servidor}\`).`);

// O `azurite.mjs` é o único arquivo de `ferramentas/` com dependência de npm.
// Se `node_modules` não existir, o erro nativo fala de `ERR_MODULE_NOT_FOUND`
// para `@azure/storage-blob` — que não diz a uma pessoa o que fazer.
if (!existsSync(join(RAIZ, "node_modules", "@azure", "storage-blob"))) {
  desistir(
    "Falta o `@azure/storage-blob` para configurar o contêiner e o CORS do Azurite.",
    "Rode `npm ci` e tente de novo.",
    "",
    "Este é o único passo da subida que depende de `node_modules` — todo o resto",
    "deste script roda sem dependência nenhuma, de propósito.",
  );
}

rodar("node", [join(RAIZ, "ferramentas", "azurite.mjs")]);

// ---------------------------------------------------------------------------
// 5 · A aplicação, no mesmo Dockerfile que vai a produção. Fica em primeiro
//     plano: os logs são a razão de alguém rodar isto.
// ---------------------------------------------------------------------------

/**
 * `--desanexado` existe por causa do **critério 5**: a esteira sobe o **mesmo
 * comando** que uma pessoa sobe, e um runner não pode ficar preso num processo
 * em primeiro plano. Sem esta opção a esteira teria de reimplementar a subida —
 * e uma esteira que reimplementa a subida verifica a si mesma, não o caminho
 * que o README documenta.
 *
 * `--wait` devolve o controle só quando o `healthcheck` do compose ficar
 * saudável, então quem chama não precisa dormir e torcer.
 */
const desanexado = process.argv.includes("--desanexado");

anunciar(desanexado ? "A aplicação, em segundo plano" : "A aplicação — http://host.docker.internal:3000");
rodar("docker", [
  "compose", "up", "--build",
  ...(desanexado ? ["--detach", "--wait", "--wait-timeout", "180"] : []),
]);
