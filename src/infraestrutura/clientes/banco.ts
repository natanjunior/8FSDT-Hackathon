import { Pool } from "pg";

/**
 * ============================================================================
 *  O cliente de banco. **Este arquivo e o `autenticacao.ts` ao lado são os
 *  únicos do repositório autorizados a importar um SDK** — ADR-0006, regra de
 *  lint 1, conferida por `eslint.config.mjs`.
 * ============================================================================
 */

/**
 * A superfície que os repositórios consomem. **Nenhum tipo do driver atravessa** — nem `Pool`, nem
 * `QueryResult`, nem `PoolClient`.
 *
 * É o que a ADR-0005 exige do tipo de retorno da porta, aplicado um degrau abaixo: se o tipo do driver
 * vazasse até aqui, trocar de driver deixaria de ser trocar uma implementação.
 */
export interface Consulta {
  <L extends object>(sql: string, valores?: readonly unknown[]): Promise<L[]>;
}

let poolCompartilhado: Pool | null = null;

/**
 * O pool do processo.
 *
 * A aplicação roda como **container de longa vida** (ADR-0004), não como função — então um pool
 * compartilhado é o desenho certo, e não o antipadrão que seria em serverless.
 */
function pool(): Pool {
  if (poolCompartilhado !== null) return poolCompartilhado;

  const url = process.env.BANCO_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "BANCO_URL não está definida. Em produção ela chega como variável de ambiente do Container App, " +
        "em tempo de execução — nunca como ARG de build (ADR-0004: a imagem é pública).",
    );
  }

  poolCompartilhado = new Pool({
    connectionString: url,
    // O free tier tem teto de conexões, e o Container Apps escala a zero: pool pequeno, ocioso curto.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    //
    // **Nada de TLS decidido por palpite: quem decide é o `sslmode` da própria URL.**
    //
    // A primeira versão deste arquivo ligava TLS quando o host não fosse `127.0.0.1` nem `localhost`. A
    // heurística quebrou no primeiro `docker compose up`: dentro do container o host é
    // `host.docker.internal`, o mesmo Postgres local passou a ser tratado como remoto, e a aplicação
    // subiu **saudável** para falhar com *"the server does not support SSL connections"* só na primeira
    // consulta. Adivinhar a topologia a partir do nome do host é errado por construção — o mesmo banco
    // tem nomes diferentes de lugares diferentes.
    //
    // Sem a opção `ssl`, o `pg` lê `sslmode` da string de conexão, que é onde a informação de verdade
    // está: local sem `sslmode` não usa TLS; a URL do Supabase traz `?sslmode=require`.
  });

  return poolCompartilhado;
}

/** A função de consulta do processo. */
export function criarConsulta(): Consulta {
  return async <L extends object>(sql: string, valores: readonly unknown[] = []): Promise<L[]> => {
    const resultado = await pool().query(sql, valores as unknown[]);
    return resultado.rows as L[];
  };
}

/**
 * Uma unidade de trabalho: tudo o que passar pela `Consulta` recebida acontece na **mesma transação**.
 *
 * **Por que ela existe, e não é conveniência.** A FK `(criada_por_pessoa_id, id)` de `organizacoes` para
 * `vinculos` é `DEFERRABLE INITIALLY DEFERRED` — a verificação é adiada para o `COMMIT` justamente porque
 * a organização é inserida **antes** do vínculo que ela referencia (modelo §6.3). Sem uma transação, o
 * `INSERT` da organização é recusado na hora. A POL-01 **não é implementável** sem isto.
 *
 * O que atravessa continua sendo `Consulta`: nenhum tipo do driver sai daqui, e quem recebe não sabe que
 * está numa transação — sabe apenas que o que ele fizer acontece junto.
 */
export interface Transacao {
  <T>(trabalho: (consulta: Consulta) => Promise<T>): Promise<T>;
}

/**
 * A função de transação do processo.
 *
 * **Um client dedicado, e não o pool.** `pool.query` pode servir cada chamada por uma conexão diferente, e
 * `begin` numa e `insert` noutra é uma transação vazia seguida de escritas soltas — o modo de falhar mais
 * silencioso que existe aqui. `connect()` amarra as chamadas a uma conexão só, e o `finally` a devolve
 * mesmo quando o trabalho lança.
 */
export function criarTransacao(): Transacao {
  return async <T>(trabalho: (consulta: Consulta) => Promise<T>): Promise<T> => {
    const cliente = await pool().connect();

    const consulta: Consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) => {
      const resultado = await cliente.query(sql, valores as unknown[]);
      return resultado.rows as L[];
    };

    try {
      await cliente.query("begin");
      const resultado = await trabalho(consulta);
      await cliente.query("commit");
      return resultado;
    } catch (erro) {
      // O `rollback` pode falhar se a conexão já caiu. O erro que importa é o original — engoli-lo aqui
      // trocaria "a semente falhou" por "rollback falhou", que é a mensagem errada para quem depura.
      await cliente.query("rollback").catch(() => undefined);
      throw erro;
    } finally {
      cliente.release();
    }
  };
}
