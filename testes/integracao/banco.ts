/**
 * ============================================================================
 *  Onde a suíte de integração escreve — e onde ela tem proibido escrever
 * ============================================================================
 *
 * **O defeito que este módulo fecha (item 39.2).** Cada teste de integração resolvia o destino com
 * `process.env.BANCO_URL_TESTE ?? process.env.BANCO_URL`. Na máquina de quem implementa a primeira não
 * existe, então o `??` caía no **banco de desenvolvimento** — e `aplicarEsquema` derruba as tabelas do
 * esquema e reaplica as migrações por fora da CLI. Isso apagava os dados de trabalho e deixava
 * `supabase_migrations.schema_migrations` atrasada, fazendo o `npm run local` seguinte falhar com
 * `type "situacao_pedido_entrada" already exists`.
 *
 * **A trava compara o database, e deliberadamente não compara o host.** Neste projeto `127.0.0.1` e
 * `host.docker.internal` são **o mesmo servidor com dois nomes** — o `.env.example` documenta por que o
 * nome precisa ser o mesmo no navegador e no container. Uma trava que comparasse host veria hostnames
 * diferentes para o mesmo Postgres e deixaria passar justamente o caso que o `.env.example:50` sugeria.
 * Falso positivo custa uma mensagem; falso negativo custa o banco.
 */

/** O mesmo nome do database do serviço de Postgres do `entrega.yml`, para que local e CI não divirjam. */
export const DATABASE_DE_TESTE = "resolveai_teste";

export type AmbienteDoBanco = {
  readonly BANCO_URL_TESTE?: string | undefined;
  readonly BANCO_URL?: string | undefined;
};

/**
 * Resolve para onde a suíte aponta. **Pura**: recebe o ambiente em vez de lê-lo, e é o que torna a trava
 * testável sem Postgres.
 */
export function resolverBancoDeTeste(ambiente: AmbienteDoBanco): string {
  const explicita = (ambiente.BANCO_URL_TESTE ?? "").trim();
  const desenvolvimento = (ambiente.BANCO_URL ?? "").trim();

  if (explicita === "" && desenvolvimento === "") {
    throw new Error(
      "Nem BANCO_URL_TESTE nem BANCO_URL estão definidas, e o teste de integração exige Postgres de " +
        "verdade. Suba o ambiente com `npm run local`: ele escreve o .env.local e cria o database `" +
        DATABASE_DE_TESTE +
        "`.",
    );
  }

  const alvo = explicita === "" ? comDatabase(desenvolvimento, DATABASE_DE_TESTE) : explicita;

  if (desenvolvimento !== "" && databaseDe(alvo) === databaseDe(desenvolvimento)) {
    throw new Error(
      `A suíte de integração ia rodar contra o database \`${databaseDe(alvo)}\`, que é o mesmo de ` +
        "BANCO_URL — o banco de desenvolvimento. Ela derruba as tabelas do esquema e reaplica as migrações " +
        "por fora da CLI, então isso apagaria os dados de trabalho e dessincronizaria o histórico de " +
        `migrações. Aponte BANCO_URL_TESTE para outro database (o esperado é \`${DATABASE_DE_TESTE}\`, ` +
        "que `npm run local` cria) ou remova a variável, e a derivação faz isso sozinha.",
    );
  }

  return alvo;
}

/**
 * O ambiente **no momento do import**, e não na hora da chamada.
 *
 * Vários testes fazem `process.env.BANCO_URL = URL_DO_BANCO` no `beforeAll` para amarrar o
 * `criarTransacao`. Ler `process.env` depois disso faria a trava comparar o alvo com uma `BANCO_URL` já
 * sobrescrita **com a própria URL de teste** — e recusar rodar por engano.
 */
const AMBIENTE_NO_CARREGAMENTO: AmbienteDoBanco = {
  BANCO_URL_TESTE: process.env.BANCO_URL_TESTE,
  BANCO_URL: process.env.BANCO_URL,
};

let memoria: string | undefined;

/** O destino da suíte. Resolve uma vez e lembra — o erro sai no `beforeAll` de quem chamar primeiro. */
export function urlDoBancoDeTeste(): string {
  memoria ??= resolverBancoDeTeste(AMBIENTE_NO_CARREGAMENTO);
  return memoria;
}

function comDatabase(url: string, database: string): string {
  const alvo = new URL(url);
  alvo.pathname = `/${database}`;
  return alvo.toString();
}

function databaseDe(url: string): string {
  return new URL(url).pathname.replace(/^\//u, "");
}
