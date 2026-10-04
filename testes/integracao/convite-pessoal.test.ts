import { randomBytes } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { criarConsulta, criarTransacao } from "@/infraestrutura/clientes";
import { escoparConsulta, escoparTransacao } from "@/infraestrutura/contexto";
import {
  leituraDeConvitesPessoais,
  repositorioDeConvitesPessoais,
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
let idArea101 = "";
let idCategoria = "";
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

  const [area] = await consulta<{ id: string }>(
    `insert into areas (organizacao_id, nome, tipo, ordem) values ($1, 'Apartamento 101', 'privativa', 1) returning id`,
    [idOrganizacao],
  );
  idArea101 = area!.id;
  const [categoria] = await consulta<{ id: string }>(
    `insert into categorias (organizacao_id, nome, icone, ordem) values ($1, 'Elétrica', 'wrench', 1) returning id`,
    [idOrganizacao],
  );
  idCategoria = categoria!.id;
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

function globais() {
  return repositorioDeConvitesPessoais(criarConsulta(), criarTransacao());
}

/** Uma Pessoa com conta e sem vínculo nesta organização: a P2 do caso 1. */
async function pessoaComConta(nome: string, opcoes: { contatos?: readonly string[] } = {}): Promise<string> {
  const usuario = await usuarioNovo();
  const [pessoa] = await consulta<{ id: string }>(`insert into pessoas (usuario_id, nome) values ($1, $2) returning id`, [
    usuario,
    nome,
  ]);
  await inserirContatos(pessoa!.id, opcoes.contatos ?? []);
  return pessoa!.id;
}

/** Uma Pessoa com conta e vínculo ativo aqui: o caso 2, ou a que depois é revogada. */
async function pessoaComContaEVinculo(nome: string, opcoes: { papel?: string } = {}): Promise<string> {
  const pessoa = await pessoaComConta(nome);
  await consulta(`insert into vinculos (pessoa_id, organizacao_id, papel) values ($1, $2, $3)`, [
    pessoa,
    idOrganizacao,
    opcoes.papel ?? "solicitante",
  ]);
  return pessoa;
}

async function contarVinculos(pessoaId: string): Promise<number> {
  const [linha] = await consulta<{ n: number }>(`select count(*)::int as n from vinculos where pessoa_id = $1`, [
    pessoaId,
  ]);
  return linha?.n ?? 0;
}

async function contatosDe(pessoaId: string): Promise<{ tipo: string; valor: string; ordem: number }[]> {
  return consulta<{ tipo: string; valor: string; ordem: number }>(
    `select tipo::text as tipo, valor, ordem from contatos where pessoa_id = $1 order by ordem`,
    [pessoaId],
  );
}

/** Uma ocorrência da Gestora, com a trilha de duas linhas, que a P1 atende. */
async function ocorrenciaEmAtendimentoCom(responsavel: string): Promise<string> {
  const [ocorrencia] = await consulta<{ id: string }>(
    `insert into ocorrencias
       (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id, status)
     values ($1, $2, $3, 'privativa', 'Tomada sem energia', 'Desde ontem.', $4, 'em_atendimento')
     returning id`,
    [idOrganizacao, idCategoria, idArea101, idGestora],
  );
  await consulta(
    `insert into registros_transicao
       (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
     values ($1, $2, 1, null, 'aberta', $3), ($1, $2, 2, 'aberta', 'em_atendimento', $3)`,
    [idOrganizacao, ocorrencia!.id, idGestora],
  );
  await consulta(
    `insert into atribuicoes (organizacao_id, ocorrencia_id, responsavel_pessoa_id, atribuido_por_pessoa_id)
     values ($1, $2, $3, $4)`,
    [idOrganizacao, ocorrencia!.id, responsavel, idGestora],
  );
  return ocorrencia!.id;
}

async function ocorrenciaCompartilhadaCom(pessoaId: string): Promise<string> {
  const [ocorrencia] = await consulta<{ id: string }>(
    `insert into ocorrencias
       (organizacao_id, categoria_id, area_id, area_tipo, titulo, descricao, autor_pessoa_id, status)
     values ($1, $2, $3, 'privativa', 'Infiltração', 'No teto do banheiro.', $4, 'aberta')
     returning id`,
    [idOrganizacao, idCategoria, idArea101, idGestora],
  );
  await consulta(
    `insert into registros_transicao
       (organizacao_id, ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id)
     values ($1, $2, 1, null, 'aberta', $3)`,
    [idOrganizacao, ocorrencia!.id, idGestora],
  );
  await compartilharCom(ocorrencia!.id, pessoaId);
  return ocorrencia!.id;
}

async function compartilharCom(ocorrenciaId: string, pessoaId: string): Promise<void> {
  await consulta(
    `insert into compartilhamentos (organizacao_id, ocorrencia_id, com_pessoa_id, por_pessoa_id)
     values ($1, $2, $3, $4)`,
    [idOrganizacao, ocorrenciaId, pessoaId, idGestora],
  );
}

async function etiquetar(pessoaId: string, nome: string): Promise<void> {
  const [etiqueta] = await consulta<{ id: string }>(
    `insert into etiquetas_participante (organizacao_id, nome) values ($1, $2)
     on conflict do nothing returning id`,
    [idOrganizacao, nome],
  );
  const id =
    etiqueta?.id ??
    (
      await consulta<{ id: string }>(`select id from etiquetas_participante where organizacao_id = $1 and nome = $2`, [
        idOrganizacao,
        nome,
      ])
    )[0]!.id;
  await consulta(
    `insert into vinculos_etiquetas (pessoa_id, organizacao_id, etiqueta_id, atribuido_por_pessoa_id)
     values ($1, $2, $3, $4)`,
    [pessoaId, idOrganizacao, id, idGestora],
  );
}

async function etiquetasDe(pessoaId: string): Promise<string[]> {
  const linhas = await consulta<{ nome: string }>(
    `select e.nome from vinculos_etiquetas ve join etiquetas_participante e on e.id = ve.etiqueta_id
      where ve.pessoa_id = $1 and ve.organizacao_id = $2 order by e.nome`,
    [pessoaId, idOrganizacao],
  );
  return linhas.map((l) => l.nome);
}

async function pedirEntrada(pessoaId: string): Promise<void> {
  await consulta(`insert into pedidos_de_entrada (organizacao_id, pessoa_id) values ($1, $2)`, [
    idOrganizacao,
    pessoaId,
  ]);
}

/** A trilha inteira desta organização, linha a linha: a fusão não pode tocar nenhuma. */
async function trilhaCompleta(): Promise<unknown[]> {
  return consulta(
    `select ocorrencia_id, sequencia, status_anterior, status_novo, autor_pessoa_id, ocorreu_em, observacao
       from registros_transicao where organizacao_id = $1 order by ocorrencia_id, sequencia`,
    [idOrganizacao],
  );
}

/** Os filhos que a fusão reaponta, somados pelas duas pessoas: a cascata silenciosa diminuiria a soma. */
async function contarFilhos(p1: string, p2: string): Promise<Record<string, number>> {
  const [linha] = await consulta<Record<string, number>>(
    `select (select count(*)::int from atribuicoes where responsavel_pessoa_id in ($1, $2)) as atribuicoes,
            (select count(*)::int from compartilhamentos where com_pessoa_id in ($1, $2)) as compartilhamentos,
            (select count(*)::int from vinculos_etiquetas where pessoa_id in ($1, $2)) as etiquetas,
            (select count(*)::int from convites_pessoais where pessoa_id in ($1, $2)) as convites`,
    [p1, p2],
  );
  return linha!;
}

async function statusEResponsavel(ocorrenciaId: string): Promise<{ status: string; responsavel: string | null }> {
  const [linha] = await consulta<{ status: string; responsavel: string | null }>(
    `select o.status::text as status,
            (select a.responsavel_pessoa_id from atribuicoes a where a.ocorrencia_id = o.id
              order by a.atribuido_em desc limit 1) as responsavel
       from ocorrencias o where o.id = $1`,
    [ocorrenciaId],
  );
  return linha!;
}

async function compartilhadaCom(ocorrenciaId: string, pessoaId: string): Promise<boolean> {
  const linhas = await consulta(`select 1 from compartilhamentos where ocorrencia_id = $1 and com_pessoa_id = $2`, [
    ocorrenciaId,
    pessoaId,
  ]);
  return linhas.length === 1;
}

async function donoDoConvite(token: string): Promise<string | undefined> {
  const [linha] = await consulta<{ pessoa_id: string }>(`select pessoa_id from convites_pessoais where token = $1`, [
    token,
  ]);
  return linha?.pessoa_id;
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

describe("a fusão (critérios 3, 4, 5 e 7)", () => {
  it("sem histórico: a P2 nasce com papel e unidade da P1, os contatos passam, a P1 fica sem vínculo", async () => {
    const p1 = await cadastrarSemConta("Maria Fundida", { areaId: idArea101, contatos: ["maria@exemplo.com"] });
    const p2 = await pessoaComConta("Maria da Conta", { contatos: ["+5511999990000"] });
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);

    expect(await globais().aceitar(token, p2)).toStrictEqual({ desfecho: "aceito", organizacaoId: idOrganizacao });

    const [vinculo] = await consulta<{ papel: string; area_id: string | null }>(
      `select papel::text as papel, area_id from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [p2, idOrganizacao],
    );
    expect(vinculo).toStrictEqual({ papel: "solicitante", area_id: idArea101 });
    expect(await contarVinculos(p1)).toBe(0);
    expect(await contatosDe(p2)).toStrictEqual([
      { tipo: "telefone", valor: "+5511999990000", ordem: 1 },
      { tipo: "email", valor: "maria@exemplo.com", ordem: 2 },
    ]);
    expect(await contatosDe(p1)).toStrictEqual([]);
    expect(await leituraGlobal().vivoPorToken(token)).toBeNull();
  });

  it("com histórico: atribuição, compartilhamento, etiqueta e convites antigos passam, e a trilha não muda", async () => {
    const p1 = await cadastrarSemConta("Maria Com Historico");
    const ocorrencia = await ocorrenciaEmAtendimentoCom(p1);
    const compartilhada = await ocorrenciaCompartilhadaCom(p1);
    await etiquetar(p1, "Eletricista");
    const antigo = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    const { token } = await convitesEscopados().renovar(p1, tokenDeTeste(), idGestora);
    const p2 = await pessoaComConta("Maria Com Conta e Historico");
    const trilhaAntes = await trilhaCompleta();
    const filhosAntes = await contarFilhos(p1, p2);

    await globais().aceitar(token, p2);

    expect(await trilhaCompleta()).toStrictEqual(trilhaAntes);
    expect(await statusEResponsavel(ocorrencia)).toStrictEqual({ status: "em_atendimento", responsavel: p2 });
    expect(await compartilhadaCom(compartilhada, p2)).toBe(true);
    expect(await etiquetasDe(p2)).toStrictEqual(["Eletricista"]);
    expect(await donoDoConvite(antigo.token)).toBe(p2);
    expect(await contarFilhos(p1, p2)).toStrictEqual(filhosAntes);
  });

  it("a lista do vínculo mostra uma pessoa só", async () => {
    const p1 = await cadastrarSemConta("Maria Uma Só");
    const p2 = await pessoaComConta("Maria Uma Só da Conta");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    await globais().aceitar(token, p2);
    const ids = (await vinculos().ativos()).map((v) => v.pessoa.pessoaId);
    expect(ids).toContain(p2);
    expect(ids).not.toContain(p1);
  });

  it("e-mail repetido em outra caixa, um contato só", async () => {
    const p1 = await cadastrarSemConta("Caixa Alta", { contatos: ["Maria.Caixa@Exemplo.com"] });
    const p2 = await pessoaComConta("Caixa Baixa", { contatos: ["maria.caixa@exemplo.com"] });
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    await globais().aceitar(token, p2);
    expect(await contatosDe(p2)).toHaveLength(1);
  });

  it("caso 2: a conta já participa, e nada muda", async () => {
    const p1 = await cadastrarSemConta("Duplicata do Caso 2");
    const p2 = await pessoaComContaEVinculo("Já Participa");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    expect(await globais().aceitar(token, p2)).toStrictEqual({ desfecho: "ja-participa" });
    expect(await contarVinculos(p1)).toBe(1);
    expect(await convitesEscopados().vivoDe(p1)).not.toBeNull();
    const ids = (await vinculos().ativos()).map((v) => v.pessoa.pessoaId);
    expect(ids).toContain(p1);
  });

  it("conta com vínculo revogado aqui é readmitida com papel e unidade da P1, e o compartilhamento repetido fica um", async () => {
    const p2 = await pessoaComContaEVinculo("Revogada Que Volta", { papel: "gestor" });
    const ocorrencia = await ocorrenciaCompartilhadaCom(p2);
    expect((await vinculos().revogar(p2)).desfecho).toBe("revogado");
    const p1 = await cadastrarSemConta("Cadastro Novo da Revogada", { areaId: idArea101 });
    await compartilharCom(ocorrencia, p1);
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);

    expect((await globais().aceitar(token, p2)).desfecho).toBe("aceito");

    const [v] = await consulta<{ papel: string; area_id: string | null; revogado_em: Date | null }>(
      `select papel::text as papel, area_id, revogado_em from vinculos where pessoa_id = $1 and organizacao_id = $2`,
      [p2, idOrganizacao],
    );
    expect(v).toStrictEqual({ papel: "solicitante", area_id: idArea101, revogado_em: null });
    const [n] = await consulta<{ n: number }>(`select count(*)::int as n from compartilhamentos where ocorrencia_id = $1`, [
      ocorrencia,
    ]);
    expect(n?.n).toBe(1);
    expect(await compartilhadaCom(ocorrencia, p2)).toBe(true);
  });

  it("o pedido pendente da conta se encerra como aprovado, sem decisor", async () => {
    const p1 = await cadastrarSemConta("Com Pedido Pendente");
    const p2 = await pessoaComConta("Pediu Antes");
    await pedirEntrada(p2);
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    await globais().aceitar(token, p2);
    const [pedido] = await consulta<{ situacao: string; decidido_por_pessoa_id: string | null }>(
      `select situacao::text as situacao, decidido_por_pessoa_id from pedidos_de_entrada where pessoa_id = $1`,
      [p2],
    );
    expect(pedido).toStrictEqual({ situacao: "aprovado", decidido_por_pessoa_id: null });
  });

  it("dois aceites simultâneos: um funde, o outro não vale", async () => {
    const p1 = await cadastrarSemConta("Aceite Em Paralelo");
    const p2 = await pessoaComConta("Conta Em Paralelo");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    const desfechos = (await Promise.all([globais().aceitar(token, p2), globais().aceitar(token, p2)]))
      .map((r) => r.desfecho)
      .sort();
    expect(desfechos).toStrictEqual(["aceito", "nao-vale"]);
  });

  it("o token da própria conta não funde a pessoa nela mesma", async () => {
    const p1 = await cadastrarSemConta("Sem Conta Para Si");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    expect(await globais().aceitar(token, p1)).toStrictEqual({ desfecho: "nao-vale" });
  });

  it("tudo ou nada: uma recusa do banco no meio desfaz tudo", async () => {
    // A P1 com rastro de quem fez (o caso da conta apagada no provedor): o `delete` do vínculo recusa no fim.
    const p1 = await cadastrarSemConta("Agiu Antes de Perder a Conta", { contatos: ["perdeu@exemplo.com"] });
    await consulta(
      `insert into categorias (organizacao_id, nome, icone, ordem, criado_por_pessoa_id) values ($1, $2, 'tag', 9, $3)`,
      [idOrganizacao, "Categoria da Conta Apagada", p1],
    );
    const ocorrencia = await ocorrenciaEmAtendimentoCom(p1);
    const p2 = await pessoaComConta("Tentou Fundir");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);

    await expect(globais().aceitar(token, p2)).rejects.toThrow(/categorias_criado_por_fk/u);

    expect(await contarVinculos(p1)).toBe(1);
    expect(await contarVinculos(p2)).toBe(0);
    expect(await statusEResponsavel(ocorrencia)).toMatchObject({ responsavel: p1 });
    expect(await convitesEscopados().vivoDe(p1)).not.toBeNull();
    expect(await contatosDe(p1)).toHaveLength(1);
    expect(await contatosDe(p2)).toStrictEqual([]);
  });
});

describe("o caminho sem conta (critério 2)", () => {
  it("liga a conta nova à P1, com o nome editado, sem Pessoa nova e sem pedido", async () => {
    const p1 = await cadastrarSemConta("Maria Sem Conta");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    const usuario = await usuarioNovo("maria.nova-121@exemplo.test");

    expect(await globais().ligarConta(token, usuario, "Maria Souza")).toStrictEqual({
      desfecho: "ligada",
      organizacaoId: idOrganizacao,
    });

    const pessoas = await consulta<{ id: string; nome: string }>(`select id, nome from pessoas where usuario_id = $1`, [
      usuario,
    ]);
    expect(pessoas).toStrictEqual([{ id: p1, nome: "Maria Souza" }]);
    expect(await leituraGlobal().vivoPorToken(token)).toBeNull();
    const [pedidos] = await consulta<{ n: number }>(
      `select count(*)::int as n from pedidos_de_entrada where pessoa_id = $1`,
      [p1],
    );
    expect(pedidos?.n).toBe(0);
    const [vinculo] = await consulta<{ papel: string }>(
      `select papel::text as papel from vinculos where pessoa_id = $1 and organizacao_id = $2 and revogado_em is null`,
      [p1, idOrganizacao],
    );
    expect(vinculo?.papel).toBe("solicitante");
  });

  it("ligação recusada devolve nao-vale, e a conta segue sem Pessoa", async () => {
    const p1 = await cadastrarSemConta("Renovada No Meio");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    await convitesEscopados().renovar(p1, tokenDeTeste(), idGestora);
    const usuario = await usuarioNovo("renovada.no.meio-121@exemplo.test");
    expect(await globais().ligarConta(token, usuario, "Renovada")).toStrictEqual({ desfecho: "nao-vale" });
    const [n] = await consulta<{ n: number }>(`select count(*)::int as n from pessoas where usuario_id = $1`, [usuario]);
    expect(n?.n).toBe(0);
  });

  it("a primeira requisição da sessão chegou antes e criou outra Pessoa: nao-vale, sem erro", async () => {
    const p1 = await cadastrarSemConta("Corrida Com a Sessao");
    const { token } = await convitesEscopados().garantir(p1, tokenDeTeste(), idGestora);
    const usuario = await usuarioNovo();
    await consulta(`insert into pessoas (usuario_id, nome) values ($1, 'Pessoa Preguiçosa')`, [usuario]);

    expect(await globais().ligarConta(token, usuario, "Corrida")).toStrictEqual({ desfecho: "nao-vale" });
    expect(await leituraGlobal().vivoPorToken(token)).not.toBeNull();
  });
});
