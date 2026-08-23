import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Consulta = <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

/**
 * Aplica o esquema inteiro num Postgres nu ou no do Supabase CLI.
 *
 * **Lê as migrações do diretório, em ordem de nome** — e não uma lista escrita à mão. Uma lista à mão
 * envelhece em silêncio: a migração seguinte entra no repositório, o teste continua verde contra um
 * esquema antigo, e ninguém percebe até o `db push` da nuvem.
 *
 * **O schema `auth` nunca é derrubado.** Contra o Postgres do Supabase CLI ele é o do provedor, com as
 * contas de quem está desenvolvendo — um `drop schema auth cascade` aqui apagaria o login de verdade. O
 * shim é `create ... if not exists`, então é no-op contra o CLI e cria as duas colunas de que a FK
 * depende contra o Postgres nu do CI.
 */
export async function aplicarEsquema(consulta: Consulta): Promise<void> {
  const raiz = new URL("../../", import.meta.url);
  const shim = readFileSync(fileURLToPath(new URL("testes/integracao/esquema-de-auth.sql", raiz)), "utf8");

  const diretorio = new URL("supabase/migrations/", raiz);
  const migracoes = readdirSync(fileURLToPath(diretorio))
    .filter((nome) => nome.endsWith(".sql"))
    .sort()
    .map((nome) => readFileSync(fileURLToPath(new URL(nome, diretorio)), "utf8"));

  if (migracoes.length === 0) {
    throw new Error("Nenhuma migração em supabase/migrations/ — o teste rodaria contra o vazio.");
  }

  // Estado limpo em toda execução: o teste não pode depender do que a anterior deixou. `cascade` cobre as
  // FKs entre elas, inclusive a composta que `vinculos` passou a ter para `areas`.
  await consulta(`drop table if exists categorias, areas, vinculos, organizacoes, pessoas cascade`);
  await consulta(`drop type if exists papel_vinculo`);
  await consulta(`drop type if exists tipo_area`);

  await consulta(shim);
  for (const migracao of migracoes) await consulta(migracao);
}
