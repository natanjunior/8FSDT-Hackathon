import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * ============================================================================
 *  Item 129 — a cópia de segurança do banco, pelo próprio Actions
 * ============================================================================
 *
 * **O segredo `BANCO_URL` só existe dentro do Actions, e este teste não o exige.** Ele executa o `run`
 * do passo de cópia, extraído do próprio workflow, com `docker` e `gh` substituídos por roteiros falsos
 * no `PATH`. O que se prova é o roteiro: as recusas com causa nomeada, a URL sem string de consulta, a
 * senha fora do log. O que NÃO se prova é a cópia do banco publicado, que só a primeira execução
 * agendada prova.
 *
 * **Por que não contra o Postgres local.** O teste de integração alcança o Postgres pela pilha de pé
 * (`testes/integracao/banco.ts`), e o roteiro chama o `pg_dump` dentro de um contêiner. Exigir os dois
 * tiraria este teste do laço curto, que é onde uma edição descuidada do workflow tem de ser barrada.
 *
 * **O `bash` no Windows é o do Git, achado pelo próprio `git`.** O `bash` do `PATH` do Windows costuma
 * ser o do WSL, que roda em outro sistema de arquivos e não enxerga o diretório temporário.
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const WORKFLOW = ".github/workflows/copia-de-seguranca-do-banco.yml";
const NOME_DO_PASSO = "o pg_dump 17 copia o banco para um arquivo";

const TEXTO = readFileSync(RAIZ + WORKFLOW, "utf8");

interface Passo {
  readonly name?: string;
  readonly id?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly env?: Record<string, string>;
  readonly with?: Record<string, string | number>;
}

interface Workflow {
  readonly on: { readonly schedule?: { readonly cron: string }[]; readonly workflow_dispatch?: unknown };
  readonly jobs: Record<string, { readonly steps: Passo[] }>;
}

const workflow = parse(TEXTO) as Workflow;
const passos = Object.values(workflow.jobs).flatMap((emprego) => emprego.steps);
const passoDaCopia = passos.find((passo) => passo.name === NOME_DO_PASSO);
const passoDoArtefato = passos.find((passo) => passo.uses?.startsWith("actions/upload-artifact@"));

function bashDisponivel(): string {
  if (process.platform !== "win32") return "bash";
  const execucao = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
  const bash = join(resolve(execucao, "..", "..", ".."), "bin", "bash.exe");
  if (!existsSync(bash)) {
    throw new Error(`O bash do Git não está em ${bash}, e o teste da cópia de segurança precisa dele.`);
  }
  return bash;
}

const BASH = bashDisponivel();
const DIRETORIOS: string[] = [];

afterAll(() => {
  for (const diretorio of DIRETORIOS) rmSync(diretorio, { recursive: true, force: true });
});

/** O `docker` falso: responde à versão, registra os argumentos e devolve a cópia que o cenário pede. */
const DOCKER_FALSO = `#!/usr/bin/env bash
printf '%s\\n' "$@" >> "$REGISTRO_DOCKER"
for argumento in "$@"; do
  if [ "$argumento" = "--version" ]; then echo "pg_dump (PostgreSQL) $VERSAO_FALSA"; exit 0; fi
done
case "$DUMP_FALSO" in
  vazio) exit 0 ;;
  falha) echo "pg_dump: error: connection to server failed" >&2; exit 1 ;;
  lixo) printf 'nao sou uma copia' ;;
  *) printf 'PGDMP\\001\\016\\000conteudo' ;;
esac
`;

/** O `gh` falso: a única chamada do roteiro é a visibilidade do repositório. */
const GH_FALSO = `#!/usr/bin/env bash
printf '%s\\n' "$@" >> "$REGISTRO_GH"
[ "$GH_FALHA" = "sim" ] && { echo "gh: HTTP 401" >&2; exit 1; }
echo "$REPO_PRIVADO"
`;

interface Cenario {
  readonly bancoUrl?: string;
  readonly versao?: string;
  readonly dump?: "ok" | "vazio" | "falha" | "lixo";
  readonly privado?: "true" | "false";
  readonly ghFalha?: boolean;
}

interface Resultado {
  readonly codigo: number | null;
  readonly log: string;
  readonly argumentosDoDocker: string[];
  readonly saida: string;
  readonly copia: Buffer | null;
}

const SENHA = "SENHA-QUE-NAO-PODE-VAZAR";
const URL_DO_PROVEDOR = `postgresql://postgres.ref:${SENHA}@pooler.exemplo.com:5432/postgres?uselibpqcompat=true&sslmode=disable`;

/** Um cenário roda uma vez só: no Windows cada `bash` do Git custa meio segundo para nascer. */
const JA_EXECUTADOS = new Map<string, Resultado>();

function executar(cenario: Cenario): Resultado {
  const chave = JSON.stringify(cenario);
  const anterior = JA_EXECUTADOS.get(chave);
  if (anterior !== undefined) return anterior;
  const resultado = executarDeFato(cenario);
  JA_EXECUTADOS.set(chave, resultado);
  return resultado;
}

function executarDeFato(cenario: Cenario): Resultado {
  const diretorio = mkdtempSync(join(tmpdir(), "copia-de-seguranca-"));
  DIRETORIOS.push(diretorio);
  mkdirSync(join(diretorio, "bin"));
  writeFileSync(join(diretorio, "bin", "docker"), DOCKER_FALSO);
  writeFileSync(join(diretorio, "bin", "gh"), GH_FALSO);
  chmodSync(join(diretorio, "bin", "docker"), 0o755);
  chmodSync(join(diretorio, "bin", "gh"), 0o755);
  writeFileSync(join(diretorio, "roteiro.sh"), passoDaCopia?.run ?? "exit 99");

  // O mesmo `bash -eo pipefail` com que o Actions roda um `run`. Os caminhos nascem dentro do bash,
  // para valerem igual no Linux e no bash do Git.
  const montagem = [
    'export PATH="$(pwd)/bin:$PATH"',
    'export REGISTRO_DOCKER="$(pwd)/docker.txt" REGISTRO_GH="$(pwd)/gh.txt" GITHUB_OUTPUT="$(pwd)/saida.txt"',
    "touch docker.txt gh.txt saida.txt",
    "bash --noprofile --norc -eo pipefail roteiro.sh",
  ].join("\n");

  const execucao = spawnSync(BASH, ["--noprofile", "--norc", "-c", montagem], {
    cwd: diretorio,
    encoding: "utf8",
    env: {
      ...process.env,
      BANCO_URL: cenario.bancoUrl ?? URL_DO_PROVEDOR,
      GH_TOKEN: "token-falso",
      REPOSITORIO: "dono/repositorio",
      GITHUB_RUN_ID: "4242",
      VERSAO_FALSA: cenario.versao ?? "17.6",
      DUMP_FALSO: cenario.dump ?? "ok",
      REPO_PRIVADO: cenario.privado ?? "true",
      GH_FALHA: cenario.ghFalha === true ? "sim" : "nao",
    },
  });

  const arquivoDaCopia = join(diretorio, "copia-do-banco.dump");
  return {
    codigo: execucao.status,
    log: `${execucao.stdout}${execucao.stderr}`,
    argumentosDoDocker: readFileSync(join(diretorio, "docker.txt"), "utf8").split("\n"),
    saida: readFileSync(join(diretorio, "saida.txt"), "utf8"),
    copia: existsSync(arquivoDaCopia) ? readFileSync(arquivoDaCopia) : null,
  };
}

describe("o workflow da cópia — critérios 129.1 e 129.5", () => {
  it("é agendado, pode ser disparado à mão, e lê o BANCO_URL que já existe", () => {
    expect(workflow.on.schedule?.length).toBeGreaterThan(0);
    expect("workflow_dispatch" in workflow.on).toBe(true);
    expect(passoDaCopia, `o passo "${NOME_DO_PASSO}" sumiu do workflow`).toBeDefined();
    expect(passoDaCopia?.env?.BANCO_URL).toBe("${{ secrets.BANCO_URL }}");
    // Nenhum segredo além do que já existia (o token da execução não é segredo cadastrado).
    expect(TEXTO.match(/secrets\.[A-Z_]+/gu)).toStrictEqual(["secrets.BANCO_URL"]);
  });

  it("sobe a cópia como artefato, com o nome do dia e falhando se o arquivo não existir", () => {
    expect(passoDoArtefato).toBeDefined();
    expect(passoDoArtefato?.with?.path).toBe("copia-do-banco.dump");
    expect(passoDoArtefato?.with?.["if-no-files-found"]).toBe("error");
    expect(passoDoArtefato?.with?.name).toBe("${{ steps.copia.outputs.nome }}");
    expect(passoDaCopia?.id).toBe("copia");
  });

  it("declara a retenção em dias, com a justificativa escrita logo acima", () => {
    const retencao = passoDoArtefato?.with?.["retention-days"];
    expect(typeof retencao).toBe("number");
    expect(retencao).toBeGreaterThan(0);
    expect(retencao).toBeLessThanOrEqual(90);
    // A linha imediatamente anterior a `retention-days` é comentário: a justificativa não se separa do número.
    const linhas = TEXTO.split("\n");
    const indice = linhas.findIndex((linha) => /^\s*retention-days:/u.test(linha));
    expect(linhas[indice - 1]).toMatch(/^\s*#/u);
  });

  it("pina o pg_dump na imagem postgres:17-alpine, a mesma do banco do entrega.yml", () => {
    expect(passoDaCopia?.run).toContain('IMAGEM="postgres:17-alpine"');
    expect(readFileSync(RAIZ + ".github/workflows/entrega.yml", "utf8")).toContain("image: postgres:17-alpine");
  });
});

describe("o roteiro da cópia, executado sem o segredo — critérios 129.2, 129.3, 129.4 e 129.6", () => {
  it("o caminho feliz: a cópia sai, com a assinatura do formato custom, e o nome do artefato é do dia", () => {
    const resultado = executar({});
    expect(resultado.log).not.toContain("::error::");
    expect(resultado.codigo).toBe(0);
    expect(resultado.copia?.subarray(0, 5).toString("latin1")).toBe("PGDMP");
    expect(resultado.saida).toMatch(/^nome=copia-do-banco-\d{4}-\d{2}-\d{2}-4242\n$/u);
  });

  it("descarta a string de consulta do provedor e declara só o sslmode", () => {
    const { argumentosDoDocker } = executar({});
    const dbname = argumentosDoDocker.filter((argumento) => argumento.startsWith("--dbname="));
    expect(dbname).toStrictEqual([
      `--dbname=postgresql://postgres.ref:${SENHA}@pooler.exemplo.com:5432/postgres?sslmode=require`,
    ]);
    expect(argumentosDoDocker.join(" ")).not.toContain("uselibpqcompat");
    expect(argumentosDoDocker).toContain("postgres:17-alpine");
  });

  // Cinco execuções seguidas: o teto padrão de cinco segundos é curto para o bash do Git no Windows.
  it("não imprime a URL nem a senha em lugar nenhum do log, em nenhum cenário", { timeout: 30_000 }, () => {
    const cenarios: Cenario[] = [{}, { dump: "falha" }, { dump: "vazio" }, { versao: "16.4" }, { dump: "lixo" }];
    for (const cenario of cenarios) {
      const { log } = executar(cenario);
      expect(log, JSON.stringify(cenario)).not.toContain(SENHA);
      expect(log, JSON.stringify(cenario)).not.toContain("pooler.exemplo.com");
    }
  });

  it("falha alto, com a causa nomeada, quando o segredo falta — e não chama o docker", () => {
    const resultado = executar({ bancoUrl: "" });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toContain("::error::BANCO_URL não está cadastrada");
    expect(resultado.argumentosDoDocker.join("")).toBe("");
  });

  it("falha com a versão nomeada quando o pg_dump não é o 17, antes de tocar o banco", () => {
    const resultado = executar({ versao: "16.4" });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toMatch(/::error::O pg_dump da imagem postgres:17-alpine não é da versão 17/u);
    expect(resultado.log).toContain("16.4");
    expect(resultado.argumentosDoDocker.some((argumento) => argumento.startsWith("--dbname="))).toBe(false);
  });

  it("um 17 de outra versão menor passa: a conferência é da versão maior", () => {
    expect(executar({ versao: "17.0" }).codigo).toBe(0);
  });

  it("falha alto quando a cópia sai vazia", () => {
    const resultado = executar({ dump: "vazio" });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toContain("::error::O pg_dump terminou sem erro e a cópia saiu vazia");
    expect(resultado.saida).toBe("");
  });

  it("falha alto quando o arquivo não é uma cópia do formato custom", () => {
    const resultado = executar({ dump: "lixo" });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toContain("assinatura PGDMP");
  });

  it("falha alto quando o pg_dump falha, deixando a causa dele à vista", () => {
    const resultado = executar({ dump: "falha" });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toContain("pg_dump: error: connection to server failed");
    expect(resultado.log).toContain("::error::O pg_dump falhou contra o banco publicado");
  });
});

describe("a cópia não sobe para quem não deveria baixá-la", () => {
  it("recusa com a causa nomeada quando o repositório é público, sem tocar o banco", () => {
    const resultado = executar({ privado: "false" });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toContain("::error::O repositório está público");
    expect(resultado.argumentosDoDocker.join("")).toBe("");
  });

  it("recusa quando a visibilidade não pode ser lida", () => {
    const resultado = executar({ ghFalha: true });
    expect(resultado.codigo).not.toBe(0);
    expect(resultado.log).toContain("::error::Não foi possível ler a visibilidade do repositório");
  });
});
