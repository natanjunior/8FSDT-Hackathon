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
    console.error(`\n✗ \`${comando} ${argumentos.join(" ")}\` falhou (código ${resultado.status}).`);
    process.exit(resultado.status ?? 1);
  }

  return resultado.stdout ?? "";
}

function anunciar(texto) {
  console.log(`\n── ${texto} ${"─".repeat(Math.max(0, 68 - texto.length))}`);
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

if (existsSync(caminhoDoEnv)) {
  anunciar(".env.local já existe — não vou encostar nele");
} else {
  anunciar("Escrevendo o .env.local a partir do `supabase status`");

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
    console.error(
      `\n✗ O \`supabase status\` não trouxe ${nomes.join(" nem ")}. ` +
        `Rode \`supabase status -o env\` e ajuste os nomes neste script — a CLI já os mudou antes.`,
    );
    return process.exit(1);
  };

  /** A CLI imprime 127.0.0.1; dentro do container isso é o próprio container. */
  const paraODocker = (url) => url.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal");

  const conteudo = [
    "# Escrito por `npm run local` (ferramentas/ambiente-local.mjs).",
    "# Os porquês de cada variável estão no `.env.example`, que é a documentação.",
    "# Este arquivo é ignorado pelo git e pelo Docker — nada daqui entra na imagem.",
    "",
    `SUPABASE_URL=${paraODocker(exigir("API_URL"))}`,
    `SUPABASE_CHAVE_ANONIMA=${exigir("PUBLISHABLE_KEY", "ANON_KEY")}`,
    `BANCO_URL=${paraODocker(exigir("DB_URL"))}`,
    `SEGREDO_DE_SESSAO=${randomBytes(32).toString("base64url")}`,
    "ARMAZENAMENTO_CONEXAO=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;" +
      "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
      "BlobEndpoint=http://host.docker.internal:10000/devstoreaccount1;",
    "",
  ].join("\n");

  writeFileSync(caminhoDoEnv, conteudo, "utf8");
  console.log("   · cinco variáveis escritas; o segredo de sessão foi gerado agora.");
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
rodar("docker", ["compose", "up", "--detach", "--wait", "--wait-timeout", "60", "azurite"]);
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
