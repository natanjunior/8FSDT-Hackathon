import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import {
  repositorioEscopadoDeConvitesPessoais,
  repositorioEscopadoDeEnviosDeConvite,
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

function enviosEscopados(organizacaoId = idOrganizacao) {
  return repositorioEscopadoDeEnviosDeConvite(
    escoparConsulta(consulta, organizacaoId),
    escoparTransacao(criarTransacao(), organizacaoId),
  );
}

/** Um `entregar` que resolve ou rejeita, conta as chamadas e, se pedido, espera antes de responder. */
function entregarQue(resultado: "aceita" | "recusa", esperaMs = 0) {
  const chamadas: string[] = [];
  return {
    chamadas,
    entregar: async (vivo: { token: string }) => {
      chamadas.push(vivo.token);
      if (esperaMs > 0) await new Promise((pronto) => setTimeout(pronto, esperaMs));
      if (resultado === "recusa") throw new Error("recusado pelo provedor");
    },
  };
}

function enviar(pessoaId: string, email: string, entrega = entregarQue("aceita"), organizacaoId = idOrganizacao) {
  return enviosEscopados(organizacaoId).registrarEnvio({
    pessoaId,
    email,
    porPessoaId: organizacaoId === idOrganizacao ? idGestora : idGestoraDaOutra,
    token: tokenDeTeste(),
    entregar: entrega.entregar,
  });
}

async function contarEnvios(email: string): Promise<number> {
  const [linha] = await consulta<{ n: number }>(
    `select count(*)::int as n from envios_de_convite where lower(email) = lower($1)`,
    [email],
  );
  return linha?.n ?? 0;
}

/** Envios antigos por SQL cru, em dias passados, para o índice do dia não interferir. */
async function enviosDeDiasPassados(pessoaId: string, quantos: number, email: string): Promise<void> {
  const convite = await convitesEscopados().garantir(pessoaId, tokenDeTeste(), idGestora);
  for (let i = 1; i <= quantos; i += 1) {
    await consulta(
      `insert into envios_de_convite (organizacao_id, convite_pessoal_id, email, enviado_por_pessoa_id, dia, enviado_em)
       select $1, id, $2, $3, (now() at time zone 'America/Sao_Paulo')::date - $5::int, now() - make_interval(days => $5::int)
         from convites_pessoais where token = $4`,
      [idOrganizacao, email, idGestora, convite.token, i],
    );
  }
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

describe("registrar um envio (critérios 2, 5 e 6)", () => {
  it("grava a linha com email, quem enviou e quando, e aponta para o convite vivo", async () => {
    const pessoa = await cadastrarSemConta("Primeiro Envio", { email: "primeiro@example.com" });
    const entrega = entregarQue("aceita");
    const resultado = await enviar(pessoa, "primeiro@example.com", entrega);
    expect(resultado.desfecho).toBe("enviado");
    const vivo = await convitesEscopados().vivoDe(pessoa);
    expect(entrega.chamadas).toStrictEqual([vivo?.token]);
    const [linha] = await consulta<{ email: string; enviado_por_pessoa_id: string; token: string }>(
      `select e.email, e.enviado_por_pessoa_id, c.token
         from envios_de_convite e join convites_pessoais c on c.id = e.convite_pessoal_id
        where lower(e.email) = 'primeiro@example.com'`,
    );
    expect(linha).toStrictEqual({ email: "primeiro@example.com", enviado_por_pessoa_id: idGestora, token: vivo?.token });
  });

  it("o segundo envio no mesmo dia ao mesmo endereço é limite-do-dia, e não chama o provedor", async () => {
    const pessoa = await cadastrarSemConta("Duas Vezes Hoje", { email: "duas.vezes@example.com" });
    await enviar(pessoa, "duas.vezes@example.com");
    const entrega = entregarQue("aceita");
    expect((await enviar(pessoa, "Duas.Vezes@example.com", entrega)).desfecho).toBe("limite-do-dia");
    expect(entrega.chamadas).toStrictEqual([]);
    expect(await contarEnvios("duas.vezes@example.com")).toBe(1);
  });

  it("outro endereço da mesma pessoa no mesmo dia passa", async () => {
    const pessoa = await cadastrarSemConta("Dois Endereços", { email: "um.endereco@example.com" });
    await enviar(pessoa, "um.endereco@example.com");
    expect((await enviar(pessoa, "outro.endereco@example.com")).desfecho).toBe("enviado");
  });

  it("o mesmo endereço em outra organização no mesmo dia passa", async () => {
    const aqui = await cadastrarSemConta("Aqui", { email: "compartilhado@example.com" });
    const la = await cadastrarSemConta("Lá", { email: "compartilhado@example.com", organizacaoId: idOutraOrganizacao });
    expect((await enviar(aqui, "compartilhado@example.com")).desfecho).toBe("enviado");
    expect((await enviar(la, "compartilhado@example.com", entregarQue("aceita"), idOutraOrganizacao)).desfecho).toBe(
      "enviado",
    );
  });

  it("o envio de ontem não bloqueia hoje", async () => {
    const pessoa = await cadastrarSemConta("Recebeu Ontem", { email: "ontem@example.com" });
    await enviosDeDiasPassados(pessoa, 1, "ontem@example.com");
    expect((await enviar(pessoa, "ontem@example.com")).desfecho).toBe("enviado");
  });

  it("o décimo passa, o décimo primeiro é limite-do-participante", async () => {
    const pessoa = await cadastrarSemConta("Dez Envios", { email: "dez@example.com" });
    await enviosDeDiasPassados(pessoa, 9, "dez@example.com");
    expect((await enviar(pessoa, "dez@example.com")).desfecho).toBe("enviado");
    const entrega = entregarQue("aceita");
    expect((await enviar(pessoa, "outro.dez@example.com", entrega)).desfecho).toBe("limite-do-participante");
    expect(entrega.chamadas).toStrictEqual([]);
  });

  it("gerar novo link não zera a contagem", async () => {
    const pessoa = await cadastrarSemConta("Renovou", { email: "renovou@example.com" });
    await enviosDeDiasPassados(pessoa, 9, "renovou@example.com");
    await convitesEscopados().renovar(pessoa, tokenDeTeste(), idGestora);
    expect((await enviar(pessoa, "renovou@example.com")).desfecho).toBe("enviado");
    expect((await enviar(pessoa, "renovou.outro@example.com")).desfecho).toBe("limite-do-participante");
  });

  it("o provedor recusa: falha-no-envio, nenhuma linha, e o limite do dia intacto", async () => {
    const pessoa = await cadastrarSemConta("Falha No Envio", { email: "falha@example.com" });
    expect((await enviar(pessoa, "falha@example.com", entregarQue("recusa"))).desfecho).toBe("falha-no-envio");
    expect(await contarEnvios("falha@example.com")).toBe(0);
    expect((await enviar(pessoa, "falha@example.com")).desfecho).toBe("enviado");
  });

  it("dois envios simultâneos ao mesmo endereço: um passa", async () => {
    const ana = await cadastrarSemConta("Ana Simultânea", { email: "simultaneo@example.com" });
    const bia = await cadastrarSemConta("Bia Simultânea", { email: "simultaneo@example.com" });
    const desfechos = (
      await Promise.all([
        enviar(ana, "simultaneo@example.com", entregarQue("aceita", 200)),
        enviar(bia, "simultaneo@example.com", entregarQue("aceita", 200)),
      ])
    )
      .map((r) => r.desfecho)
      .sort();
    expect(desfechos).toStrictEqual(["enviado", "limite-do-dia"]);
    expect(await contarEnvios("simultaneo@example.com")).toBe(1);
  });

  it("o décimo e o décimo primeiro simultâneos: um passa", async () => {
    const pessoa = await cadastrarSemConta("Nove E Dois", { email: "nove@example.com" });
    await enviosDeDiasPassados(pessoa, 9, "nove@example.com");
    const desfechos = (
      await Promise.all([
        enviar(pessoa, "nove.a@example.com", entregarQue("aceita", 200)),
        enviar(pessoa, "nove.b@example.com", entregarQue("aceita", 200)),
      ])
    )
      .map((r) => r.desfecho)
      .sort();
    expect(desfechos).toStrictEqual(["enviado", "limite-do-participante"]);
  });

  it("com os dois limites valendo, o desfecho é limite-do-dia", async () => {
    const pessoa = await cadastrarSemConta("Os Dois Limites", { email: "dois.limites@example.com" });
    await enviosDeDiasPassados(pessoa, 9, "dois.limites@example.com");
    expect((await enviar(pessoa, "dois.limites@example.com")).desfecho).toBe("enviado");
    expect((await enviar(pessoa, "dois.limites@example.com")).desfecho).toBe("limite-do-dia");
  });

  it("nenhum caminho de código faz update nem delete em envios_de_convite (critério 5)", () => {
    const raiz = fileURLToPath(new URL("../../", import.meta.url));
    const proibido = /update\s+envios_de_convite|delete\s+from\s+envios_de_convite/iu;
    const culpados: string[] = [];
    for (const pasta of ["src", "app"]) {
      for (const arquivo of readdirSync(`${raiz}${pasta}`, { recursive: true, encoding: "utf8" })) {
        if (!/\.(ts|tsx)$/u.test(arquivo)) continue;
        if (proibido.test(readFileSync(`${raiz}${pasta}/${arquivo}`, "utf8"))) culpados.push(`${pasta}/${arquivo}`);
      }
    }
    expect(culpados).toStrictEqual([]);
  });

  it("o envio cria o convite de quem nunca teve o modal aberto", async () => {
    const pessoa = await cadastrarSemConta("Sem Modal", { email: "sem.modal@example.com" });
    expect(await convitesEscopados().vivoDe(pessoa)).toBeNull();
    await enviar(pessoa, "sem.modal@example.com");
    expect(await convitesEscopados().vivoDe(pessoa)).not.toBeNull();
  });

  it("recadastrar o mesmo endereço no mesmo dia, depois de remover, ainda é limite-do-dia", async () => {
    const primeira = await cadastrarSemConta("Removida No Dia", { email: "recadastro@example.com" });
    expect((await enviar(primeira, "recadastro@example.com")).desfecho).toBe("enviado");
    expect((await vinculos().remover(primeira)).desfecho).toBe("removido");
    const segunda = await cadastrarSemConta("Recadastrada No Dia", { email: "recadastro@example.com" });
    expect((await enviar(segunda, "recadastro@example.com")).desfecho).toBe("limite-do-dia");
  });

  it("em outra organização, o registro com a pessoa daqui não escreve nada", async () => {
    const pessoa = await cadastrarSemConta("Daqui Só", { email: "daqui.so@example.com" });
    await expect(enviar(pessoa, "daqui.so@example.com", entregarQue("aceita"), idOutraOrganizacao)).rejects.toThrow();
    expect(await contarEnvios("daqui.so@example.com")).toBe(0);
    expect(await convitesEscopados().vivoDe(pessoa)).toBeNull();
  });
});

describe("o resumo de uma pessoa", () => {
  it("devolve o último envio, a contagem e se o endereço já recebeu hoje", async () => {
    const pessoa = await cadastrarSemConta("Resumida", { email: "resumida@example.com" });
    await enviosDeDiasPassados(pessoa, 2, "resumida@example.com");
    const envio = await enviar(pessoa, "resumida@example.com");
    const resumo = await enviosEscopados().resumoDe(pessoa, "Resumida@example.com");
    expect(resumo).toStrictEqual({
      ultimoEnvioEm: envio.desfecho === "enviado" ? envio.enviadoEm : "",
      doParticipante: 3,
      enderecoJaRecebeuHoje: true,
    });
  });

  it("sem e-mail, enderecoJaRecebeuHoje é false", async () => {
    const pessoa = await cadastrarSemConta("Sem Endereço");
    expect(await enviosEscopados().resumoDe(pessoa, null)).toStrictEqual({
      ultimoEnvioEm: null,
      doParticipante: 0,
      enderecoJaRecebeuHoje: false,
    });
  });
});
