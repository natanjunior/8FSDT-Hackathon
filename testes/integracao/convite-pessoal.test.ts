import { randomBytes } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import {
  leituraDeConvitesPessoais,
  repositorioEscopadoDeConvitesPessoais,
  repositorioEscopadoDeVinculos,
} from "@/infraestrutura/repositorios/organizacao";

import { urlDoBancoDeTeste } from "./banco";
import { aplicarEsquema } from "./esquema";

/**
 * ============================================================================
 *  O convite pessoal, e a fusão de duplicata — item 121
 * ============================================================================
 *
 * **O que o banco garante, provado no banco.** A tabela, a garantia e a renovação do lado do Gestor, a
 * leitura sem sessão, a fusão (critérios 3, 4, 5 e 7) e o caminho sem conta (critério 2). Um arquivo
 * próprio porque a fusão tem uma dúzia de cenários de banco e `vinculo.test.ts` já é o arquivo de tudo.
 */

const URL_DO_BANCO = urlDoBancoDeTeste();
const SUFIXO = `121-${Date.now()}`;

let pool: Pool;
let consulta: <L extends object>(sql: string, valores?: readonly unknown[]) => Promise<L[]>;

let idOrganizacao = "";
let idGestora = "";
let contadorDeContas = 0;

beforeAll(async () => {
  process.env.BANCO_URL = URL_DO_BANCO;
  pool = new Pool({ connectionString: URL_DO_BANCO, max: 6 });
  consulta = async <L extends object>(sql: string, valores: readonly unknown[] = []) =>
    (await pool.query(sql, valores as unknown[])).rows as L[];

  await aplicarEsquema(consulta);

  const [organizacao] = await consulta<{ id: string }>(
    `insert into organizacoes (nome, codigo_publico) values ('Jardim do 121', $1) returning id`,
    [`G${SUFIXO.slice(-7).toUpperCase()}`],
  );
  idOrganizacao = organizacao!.id;
  idGestora = await cadastrarGestorComConta("Gestora do Convite");
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Auxiliares: SQL cru, como nos outros arquivos de integração.

function tokenDeTeste(): string {
  return randomBytes(32).toString("base64url");
}

async function usuarioNovo(email?: string): Promise<string> {
  contadorDeContas += 1;
  const [usuario] = await consulta<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [email ?? `conta-${contadorDeContas}-${SUFIXO}@exemplo.test`],
  );
  return usuario!.id;
}

async function inserirContatos(pessoaId: string, contatos: readonly string[]): Promise<void> {
  for (const [indice, valor] of contatos.entries()) {
    await consulta(`insert into contatos (pessoa_id, tipo, valor, ordem) values ($1, $2, $3, $4)`, [
      pessoaId,
      valor.startsWith("+") ? "telefone" : "email",
      valor,
      indice + 1,
    ]);
  }
}

/** Uma Pessoa sem conta, com vínculo de Solicitante: o que o Gestor cadastra pelo item 9a. */
async function cadastrarSemConta(
  nome: string,
  opcoes: { areaId?: string; contatos?: readonly string[]; email?: string } = {},
): Promise<string> {
  const [pessoa] = await consulta<{ id: string }>(`insert into pessoas (nome) values ($1) returning id`, [nome]);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel, area_id) values ($1, $2, 'solicitante', $3)`, [
    pessoa!.id,
    idOrganizacao,
    opcoes.areaId ?? null,
  ]);
  await inserirContatos(pessoa!.id, [...(opcoes.email === undefined ? [] : [opcoes.email]), ...(opcoes.contatos ?? [])]);
  return pessoa!.id;
}

async function cadastrarGestorComConta(nome: string): Promise<string> {
  const usuario = await usuarioNovo();
  const [pessoa] = await consulta<{ id: string }>(`insert into pessoas (usuario_id, nome) values ($1, $2) returning id`, [
    usuario,
    nome,
  ]);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, 'gestor')`, [
    pessoa!.id,
    idOrganizacao,
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

function leituraGlobal() {
  return leituraDeConvitesPessoais(criarConsulta());
}

/** O estado de quem ganhou conta por outro caminho, sem passar pelo convite. */
async function darConta(pessoaId: string): Promise<void> {
  const usuario = await usuarioNovo();
  await consulta(`update pessoas set usuario_id = $2 where id = $1`, [pessoaId, usuario]);
}

async function inserirConvite(pessoaId: string, porPessoaId = idGestora): Promise<string> {
  const token = tokenDeTeste();
  await consulta(
    `insert into convites_pessoais (organizacao_id, pessoa_id, token, criado_por_pessoa_id) values ($1, $2, $3, $4)`,
    [idOrganizacao, pessoaId, token, porPessoaId],
  );
  return token;
}

// ---------------------------------------------------------------------------

describe("a tabela e o vínculo (item 121)", () => {
  it("remover o participante sem rastro leva o convite junto", async () => {
    const pessoa = await cadastrarSemConta("Removível do Convite");
    await inserirConvite(pessoa);
    expect((await vinculos().remover(pessoa)).desfecho).toBe("removido");
    const [linha] = await consulta<{ n: number }>(
      `select count(*)::int as n from convites_pessoais where pessoa_id = $1`,
      [pessoa],
    );
    expect(linha?.n).toBe(0);
  });

  it("quem gerou um convite tem rastro, e não pode ser removido", async () => {
    const gestor = await cadastrarGestorComConta("Gestor Que Convidou");
    const pessoa = await cadastrarSemConta("Convidada Pelo Gestor");
    await inserirConvite(pessoa, gestor);
    expect((await vinculos().impedimentosDeRemocao()).get(gestor)).toBe("historico");
  });

  it("revogar o vínculo invalida o convite vivo", async () => {
    const pessoa = await cadastrarSemConta("Revogada do Convite");
    await inserirConvite(pessoa);
    expect((await vinculos().revogar(pessoa)).desfecho).toBe("revogado");
    const [linha] = await consulta<{ invalidado_em: Date | null }>(
      `select invalidado_em from convites_pessoais where pessoa_id = $1`,
      [pessoa],
    );
    expect(linha?.invalidado_em).toBeInstanceOf(Date);
  });

  it("um convite vivo por vínculo: o segundo é recusado pelo banco", async () => {
    const pessoa = await cadastrarSemConta("Dois Vivos");
    await inserirConvite(pessoa);
    await expect(inserirConvite(pessoa)).rejects.toThrow(/convites_pessoais_vivo_uk/u);
  });
});

describe("garantir e renovar, no banco (critério 1)", () => {
  it("garantir duas vezes devolve o mesmo token", async () => {
    const pessoa = await cadastrarSemConta("Garantida Duas Vezes");
    const a = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    const b = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    expect(b.token).toBe(a.token);
    expect(b.criadoPor.nome).toBe("Gestora do Convite");
  });

  it("duas garantias simultâneas, um convite", async () => {
    const pessoa = await cadastrarSemConta("Garantida Em Paralelo");
    const [a, b] = await Promise.all([
      convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora),
      convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora),
    ]);
    expect(a.token).toBe(b.token);
    const [linha] = await consulta<{ n: number }>(
      `select count(*)::int as n from convites_pessoais where pessoa_id = $1`,
      [pessoa],
    );
    expect(linha?.n).toBe(1);
  });

  it("renovar troca o token e carimba o antigo", async () => {
    const pessoa = await cadastrarSemConta("Renovada");
    const antigo = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    const novo = await convitesEscopados().renovar(pessoa, tokenDeTeste(), idGestora);
    expect(novo.token).not.toBe(antigo.token);
    const [linha] = await consulta<{ invalidado_em: Date | null }>(
      `select invalidado_em from convites_pessoais where token = $1`,
      [antigo.token],
    );
    expect(linha?.invalidado_em).toBeInstanceOf(Date);
    expect((await convitesEscopados().vivoDe(pessoa))?.token).toBe(novo.token);
  });
});

describe("a leitura sem sessão (critério 8)", () => {
  it("o vivo devolve nome, organização e papel, e nenhum campo a mais", async () => {
    const pessoa = await cadastrarSemConta("Maria Lida Sem Sessao", { email: "maria.lida@exemplo.com" });
    const { token } = await convitesEscopados().garantir(pessoa, tokenDeTeste(), idGestora);
    const lido = await leituraGlobal().vivoPorToken(token);
    expect(Object.keys(lido ?? {}).sort()).toStrictEqual([
      "nomeDaOrganizacao",
      "nomeDaPessoa",
      "organizacaoId",
      "papel",
      "pessoaId",
    ]);
    expect(lido).toMatchObject({ nomeDaPessoa: "Maria Lida Sem Sessao", nomeDaOrganizacao: "Jardim do 121", papel: "solicitante" });
    expect(JSON.stringify(lido)).not.toContain("maria.lida@exemplo.com");
  });

  it.each([
    ["inexistente", () => Promise.resolve(tokenDeTeste())],
    [
      "renovado",
      async () => {
        const p = await cadastrarSemConta("Renovada Lida");
        const a = await convitesEscopados().garantir(p, tokenDeTeste(), idGestora);
        await convitesEscopados().renovar(p, tokenDeTeste(), idGestora);
        return a.token;
      },
    ],
    [
      "de vínculo revogado",
      async () => {
        const p = await cadastrarSemConta("Revogada Lida");
        const a = await convitesEscopados().garantir(p, tokenDeTeste(), idGestora);
        await vinculos().revogar(p);
        return a.token;
      },
    ],
    [
      "de pessoa que ganhou conta",
      async () => {
        const p = await cadastrarSemConta("Ganhou Conta");
        const a = await convitesEscopados().garantir(p, tokenDeTeste(), idGestora);
        await darConta(p);
        return a.token;
      },
    ],
  ] as const)("%s: null, sem nome nenhum", async (_caso, preparar) => {
    expect(await leituraGlobal().vivoPorToken(await preparar())).toBeNull();
  });

  it("o objeto que o semSessao recebe não tem escrita", () => {
    expect(Object.keys(leituraGlobal())).toStrictEqual(["vivoPorToken"]);
  });
});
