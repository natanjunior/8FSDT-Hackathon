#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
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
    "",
  ].join("\n");

  writeFileSync(caminhoDoEnv, conteudo, "utf8");
  console.log("   · quatro variáveis escritas; o segredo de sessão foi gerado agora.");
}

// ---------------------------------------------------------------------------
// 3 · O esquema. Idempotente: aplica o que falta e não apaga o que existe.
// ---------------------------------------------------------------------------

anunciar("Migrações");
rodar("supabase", ["migration", "up"]);

// ---------------------------------------------------------------------------
// 4 · A aplicação, no mesmo Dockerfile que vai a produção. Fica em primeiro
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
