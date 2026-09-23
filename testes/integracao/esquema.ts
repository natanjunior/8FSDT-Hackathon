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
  // FKs entre elas, inclusive a composta que `vinculos` tem para `areas` e a que `pedidos_de_entrada` tem
  // para `vinculos`.
  // A ordem importa: `mensagens` antes de `canais_conversa` (a FK é RESTRICT) e
  // as duas antes de `atribuicoes`, `ocorrencias` e `vinculos`, para onde elas
  // apontam. Depois, `atribuicoes` antes de `ocorrencias` E de `vinculos` (as
  // três FKs são RESTRICT), `anexos` antes de `ocorrencias` (a FK é RESTRICT),
  // `registros_transicao` antes de `ocorrencias`, e as três antes de
  // `categorias`/`areas`. `autorizacoes_de_upload` vem na frente de `pessoas`,
  // que é para onde a FK dela aponta. O `cascade` cobre, mas a ordem explícita
  // documenta a direção das FKs.
  await consulta(
    `drop table if exists mensagens, canais_conversa, atribuicoes, anexos, autorizacoes_de_upload,
                          registros_transicao, ocorrencias, contatos, pedidos_de_entrada, categorias,
                          areas, vinculos, organizacoes, pessoas cascade`,
  );
  await consulta(`drop type if exists papel_vinculo`);
  await consulta(`drop type if exists tipo_area`);
  await consulta(`drop type if exists situacao_pedido_entrada`);
  await consulta(`drop type if exists tipo_contato`);
  await consulta(`drop type if exists finalidade_contato`);
  await consulta(`drop type if exists status_ocorrencia`);
  await consulta(`drop type if exists prioridade_ocorrencia`);
  await consulta(`drop type if exists motivo_pausa`);
  await consulta(`drop type if exists motivo_cancelamento`);
  await consulta(`drop type if exists vinculo_ocorrencia`);
  await consulta(`drop type if exists tipo_anexo`);
  await consulta(`drop type if exists fonte_anexo`);
  await consulta(`drop type if exists motivo_encerramento_atribuicao`);
  await consulta(`drop type if exists tipo_canal`);
  // **A migração 005 é a primeira do repositório a criar uma FUNÇÃO**, e é por isso que aparece um
  // `drop function` aqui. `drop table ... cascade` derruba o **gatilho**, porque ele depende da tabela —
  // e **não** derruba a função, que não depende de nada. Sem esta linha, o **segundo** arquivo de
  // integração a chamar `aplicarEsquema` no mesmo banco falha em
  // `create function registros_transicao_append_only ... already exists`. E são vários arquivos rodando
  // em série (`fileParallelism: false`) — o número deles esteve escrito aqui e envelheceu sozinho.
  await consulta(`drop function if exists registros_transicao_append_only() cascade`);

  await consulta(shim);
  for (const migracao of migracoes) await consulta(migracao);
}
