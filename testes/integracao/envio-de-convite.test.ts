import { randomBytes } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import {
  repositorioEscopadoDeConvitesPessoais,
  repositorioEscopadoDeVinculos,
} from "@/infraestrutura/repositorios/organizacao";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  Os envios do convite por e-mail — item 122
 * ============================================================================
 *
 * **O que o banco garante, provado no banco**: o índice de um por dia por endereço, o dia de Brasília, a
 * chave `set null` para o convite e a de quem enviou, que é rastro. O registro do envio, com os dois
 * limites e a transação que só confirma o que saiu, vem na Tarefa 3, neste mesmo arquivo.
 */

const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `122-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

let idOrganizacao = "";
let idOutraOrganizacao = "";
let idGestora = "";
let idGestoraDaOutra = "";
let contadorDeContas = 0;

beforeAll(async () => {
  process.env.BANCO_URL = URL_DO_BANCO;
  pool = new Pool({ connectionString: URL_DO_BANCO, max: 6 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);

  const organizacoes = await consulta<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico) values ('Prédio do 122', $1), ('Outro do 122', $2) returning id`,
    [`H${SUFIXO.slice(-7).toUpperCase()}`, `J${SUFIXO.slice(-7).toUpperCase()}`],
  );
  idOrganizacao = organizacoes[0]!.id;
  idOutraOrganizacao = organizacoes[1]!.id;
  idGestora = await cadastrarGestorComConta("Gestora do Envio");
  idGestoraDaOutra = await cadastrarGestorComConta("Gestora da Outra", idOutraOrganizacao);
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Auxiliares: SQL cru, como nos outros arquivos de integração.

function tokenDeTeste(): string {
  return randomBytes(32).toString("base64url");
}

async function usuarioNovo(): Promise<string> {
  contadorDeContas += 1;
  const [usuario] = await consulta<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [`conta-${contadorDeContas}-${SUFIXO}@exemplo.test`],
  );
  return usuario!.id;
}

/** Uma Pessoa sem conta, com vínculo de Solicitante e, se dado, um e-mail de ordem 1. */
async function cadastrarSemConta(
  nome: string,
  opcoes: { email?: string; organizacaoId?: string; papel?: string } = {},
): Promise<string> {
  const [pessoa] = await consulta<{ id: string }>(`insert into pessoas (nome) values ($1) returning id`, [nome]);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, $3)`, [
    pessoa!.id,
    opcoes.organizacaoId ?? idOrganizacao,
    opcoes.papel ?? "solicitante",
  ]);
  if (opcoes.email !== undefined) {
    await consulta(`insert into contatos (pessoa_id, tipo, valor, ordem) values ($1, 'email', $2, 1)`, [
      pessoa!.id,
      opcoes.email,
    ]);
  }
  return pessoa!.id;
}

async function cadastrarGestorComConta(nome: string, organizacaoId = idOrganizacao): Promise<string> {
  const usuario = await usuarioNovo();
  const [pessoa] = await consulta<{ id: string }>(`insert into pessoas (usuario_id, nome) values ($1, $2) returning id`, [
    usuario,
    nome,
  ]);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`, [
    pessoa!.id,
    organizacaoId,
  ]);
  return pessoa!.id;
}

function vinculos(organizacaoId = idOrganizacao) {
  return repositorioEscopadoDeVinculos(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

function convitesEscopados(organizacaoId = idOrganizacao) {
  return repositorioEscopadoDeConvitesPessoais(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

/** Um envio por SQL cru, ligado ao convite pelo token. */
async function inserirEnvio(token: string, email: string, por = idGestora, organizacaoId = idOrganizacao) {
  return consulta(
    `insert into envios_de_convite (organizacao_id, convite_pessoal_id, email, enviado_por_pessoa_id)
     select $1, id, $2, $3 from convites_pessoais where token = $4`,
    [organizacaoId, email, por, token],
  );
}

// ---------------------------------------------------------------------------

describe("a tabela (item 122)", () => {
  it("o mesmo endereço, em outra caixa, no mesmo dia e organização, é recusado pelo banco", async () => {
    const pessoa = await cadastrarSemConta("Caixa Alta", { email: "Caixa.Alta@example.com" });
    const convite = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    await inserirEnvio(convite.token, "Caixa.Alta@example.com");
    await expect(inserirEnvio(convite.token, "caixa.alta@example.com")).rejects.toThrow(/envios_de_convite_dia_uk/u);
  });

  it("o dia gravado é o de Brasília", async () => {
    const [linha] = await consulta<{ ok: boolean }>(
      `select dia = (now() at time zone 'America/Sao_Paulo')::date as ok
         from envios_de_convite order by enviado_em desc limit 1`,
    );
    expect(linha?.ok).toBe(true);
  });

  it("remover o participante sem rastro que recebeu e-mail passa, e o envio fica sem o elo", async () => {
    const pessoa = await cadastrarSemConta("Removível Que Recebeu", { email: "removivel@example.com" });
    const convite = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    await inserirEnvio(convite.token, "removivel@example.com");
    expect((await vinculos().remover(pessoa)).desfecho).toBe("removido");
    const [linha] = await consulta<{ convite_pessoal_id: string | null; organizacao_id: string }>(
      `select convite_pessoal_id, organizacao_id from envios_de_convite where email = 'removivel@example.com'`,
    );
    expect(linha?.convite_pessoal_id).toBeNull();
    // O `set null (coluna)` não anulou a organização.
    expect(linha?.organizacao_id).toBe(idOrganizacao);
  });

  it("quem enviou tem rastro, e não pode ser removido", async () => {
    const gestor = await cadastrarGestorComConta("Gestor Que Enviou");
    const pessoa = await cadastrarSemConta("Recebeu Do Gestor", { email: "recebeu@example.com" });
    // O convite nasce pela Gestora da organização, e não pelo Gestor novo: senão a `criado_por` do 121 já
    // daria rastro a ele, e o caso passaria sem o `or exists` de `envios_de_convite`.
    const convite = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    await inserirEnvio(convite.token, "recebeu@example.com", gestor);
    expect((await vinculos().impedimentosDeRemocao()).get(gestor)).toBe("historico");
  });
});
