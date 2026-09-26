import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  baldesDaDemonstracao,
  PERFIL_DA_DEMONSTRACAO,
  PERFIL_DE_TESTE,
  planoDaDemonstracao,
  type OcorrenciaDoPlano,
  type PlanoDaDemonstracao,
} from "./plano";

/**
 * ============================================================================
 *  Os critérios do item 43, como asserção sobre o plano — e SEM banco
 * ============================================================================
 *
 * **O que só a semente pode errar é a forma do plano**, e é o que este arquivo prova. A máquina de
 * estados não é reprovada aqui: ela já tem os testes dos itens 16 a 27, e cada transição do roteiro passa
 * pelos mesmos comandos. Se o roteiro pedir transição ilegal, o programa estoura na execução — que é o
 * comportamento certo para um script.
 *
 * Guarda também o perfil de teste do item 63 e as travas de fonte que impedem os testes de ponta a ponta
 * de voltarem a escrever na demonstração.
 */

const HOJE = new Date("2026-08-29T12:00:00.000Z");

describe("baldesDaDemonstracao", () => {
  it("dá cinco baldes mensais, do mais antigo para o mês corrente", () => {
    expect(baldesDaDemonstracao(HOJE).map((balde) => balde.rotulo)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("o mês corrente vai até ONTEM, nunca até hoje", () => {
    const baldes = baldesDaDemonstracao(HOJE);
    const corrente = baldes.at(-1);

    expect(corrente?.ultimoDia.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(corrente?.dias).toBe(28);
  });

  it("os meses fechados vão até o último dia deles", () => {
    const baldes = baldesDaDemonstracao(HOJE);

    // Abril tem 30 dias; junho, 30; julho, 31.
    expect(baldes.map((balde) => balde.dias)).toEqual([30, 31, 30, 31, 28]);
  });

  it("atravessa a virada do ano", () => {
    expect(baldesDaDemonstracao(new Date("2026-02-10T08:00:00.000Z")).map((b) => b.rotulo)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("no dia 1 o mês corrente some, e sobram quatro baldes — ainda acima do mínimo de três", () => {
    expect(baldesDaDemonstracao(new Date("2026-08-01T09:00:00.000Z")).map((b) => b.rotulo)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
  });
});

const NO_DIA_1 = new Date("2026-08-01T09:00:00.000Z");

function instantesDe(ocorrencia: OcorrenciaDoPlano): readonly string[] {
  return [ocorrencia.registradaEm, ...ocorrencia.roteiro.map((passo) => passo.em)];
}

function mesDe(instante: string): string {
  return instante.slice(0, 7);
}

/**
 * As asserções que valem para **qualquer** `hoje`.
 *
 * **Uma função, chamada duas vezes** (decisão D-8): com a semente rodada no meio do mês e com ela rodada
 * no dia 1, quando o balde do mês corrente não existe. Duas listas de asserção divergiriam, e o caso do
 * dia 1 é justamente o que ninguém lembraria de atualizar.
 */
function conferirOsCincoCriterios(plano: PlanoDaDemonstracao, quandoRodou: Date): void {
  const { ocorrencias } = plano;
  const meses = new Set(ocorrencias.map((o) => o.balde));

  // --- 43.1 · pelo menos três meses, tudo no passado -----------------------
  expect(meses.size).toBeGreaterThanOrEqual(3);
  for (const ocorrencia of ocorrencias) {
    for (const instante of instantesDe(ocorrencia)) {
      expect(Date.parse(instante)).toBeLessThan(quandoRodou.getTime());
    }
  }

  // --- 43.1 (a outra metade) · os instantes de um roteiro são crescentes ---
  for (const ocorrencia of ocorrencias) {
    const instantes = instantesDe(ocorrencia);
    for (let i = 1; i < instantes.length; i += 1) {
      expect(Date.parse(instantes[i] ?? "")).toBeGreaterThan(Date.parse(instantes[i - 1] ?? ""));
    }
  }

  // --- §3.5 · toda ocorrência resolve no mesmo mês em que foi registrada ---
  // Sem esta regra, uma resolução de M-3 cairia em M-2 e encheria o balde vazio — e qual balde recebe a
  // resolução é decisão do item 36, que ainda não existe.
  for (const ocorrencia of ocorrencias) {
    for (const instante of instantesDe(ocorrencia)) {
      expect(mesDe(instante)).toBe(ocorrencia.balde);
    }
  }

  // --- 43.2 · existe um mês com ocorrências e ZERO resoluções --------------
  const resolvidasPorMes = new Map<string, number>();
  for (const mes of meses) resolvidasPorMes.set(mes, 0);
  for (const ocorrencia of ocorrencias) {
    if (ocorrencia.statusFinal === "resolvida") {
      resolvidasPorMes.set(ocorrencia.balde, (resolvidasPorMes.get(ocorrencia.balde) ?? 0) + 1);
    }
  }
  expect([...resolvidasPorMes.values()].filter((quantas) => quantas === 0)).toHaveLength(1);

  // --- 43.3 · resolvidas avaliadas E não avaliadas -------------------------
  const resolvidas = ocorrencias.filter((o) => o.statusFinal === "resolvida");
  const avaliadas = resolvidas.filter((o) => o.roteiro.some((p) => p.comando === "avaliar"));
  expect(avaliadas.length).toBeGreaterThan(0);
  expect(avaliadas.length).toBeLessThan(resolvidas.length);

  // --- 43.4 · os seis status, os quatro motivos de pausa, as duas organizações
  expect(new Set(ocorrencias.map((o) => o.statusFinal))).toEqual(
    new Set(["aberta", "em_analise", "em_atendimento", "pausada", "resolvida", "cancelada"]),
  );

  const motivosDePausaFinal = ocorrencias
    .filter((o) => o.statusFinal === "pausada")
    .flatMap((o) => o.roteiro.filter((p) => p.comando === "pausar").map((p) => p.motivo));
  expect(new Set(motivosDePausaFinal)).toEqual(
    new Set([
      "aguardando_informacao_solicitante",
      "aguardando_peca",
      "aguardando_autorizacao",
      "aguardando_terceiro",
    ]),
  );

  expect(new Set(ocorrencias.map((o) => o.organizacao))).toEqual(new Set(["a", "b"]));

  // A mesma Pessoa nas duas organizações — a Persona 1B, e pelo caminho do produto.
  const organizacoesDeHelena = plano.vinculos.filter((v) => v.pessoa === "helena");
  expect(new Set(organizacoesDeHelena.map((v) => v.organizacao))).toEqual(new Set(["a", "b"]));
  expect(organizacoesDeHelena.find((v) => v.organizacao === "b")?.como).toBe("pedido");

  // --- 43.5 · nada referencia o que o plano não cria -----------------------
  const chavesDeOrganizacao = new Set(plano.organizacoes.map((o) => o.chave));
  const chavesDePessoa = new Set(plano.pessoas.map((p) => p.chave));
  const areasPorOrganizacao = new Set([
    ...plano.areas.map((a) => `${a.organizacao}:${a.nome}`),
    // As duas da POL-01, que toda organização ganha ao nascer.
    ...[...chavesDeOrganizacao].flatMap((org) => [`${org}:Área comum`, `${org}:Unidade`]),
  ]);
  const categoriasSemente = new Set([
    "Problemas de iluminação",
    "Equipamentos quebrados",
    "Falta de acessibilidade",
    "Problemas de limpeza",
    "Vazamentos",
    "Problemas de segurança",
    "Solicitações de manutenção",
  ]);

  for (const ocorrencia of ocorrencias) {
    expect(chavesDeOrganizacao.has(ocorrencia.organizacao)).toBe(true);
    expect(areasPorOrganizacao.has(`${ocorrencia.organizacao}:${ocorrencia.area}`)).toBe(true);
    expect(categoriasSemente.has(ocorrencia.categoria)).toBe(true);
    expect(chavesDePessoa.has(ocorrencia.autor)).toBe(true);
    for (const passo of ocorrencia.roteiro) {
      expect(chavesDePessoa.has(passo.por)).toBe(true);
      if (passo.comando === "atribuir-responsavel") {
        expect(chavesDePessoa.has(passo.responsavel)).toBe(true);
      }
    }
  }

  // Todo vínculo aponta para pessoa, organização e área que o plano cria.
  for (const vinculo of plano.vinculos) {
    expect(chavesDePessoa.has(vinculo.pessoa)).toBe(true);
    expect(chavesDeOrganizacao.has(vinculo.organizacao)).toBe(true);
    if (vinculo.area !== null) {
      expect(areasPorOrganizacao.has(`${vinculo.organizacao}:${vinculo.area}`)).toBe(true);
    }
  }
}

describe("planoDaDemonstracao", () => {
  it("cumpre os cinco critérios com a semente rodada no meio do mês", () => {
    conferirOsCincoCriterios(planoDaDemonstracao(HOJE), HOJE);
  });

  it("cumpre os cinco critérios com a semente rodada no dia 1 — quatro baldes, e nenhum deles é hoje", () => {
    const plano = planoDaDemonstracao(NO_DIA_1);

    expect(plano.baldes).toHaveLength(4);
    conferirOsCincoCriterios(plano, NO_DIA_1);
  });

  it("é estável: duas chamadas com o mesmo hoje dão exatamente o mesmo mundo", () => {
    expect(planoDaDemonstracao(HOJE)).toEqual(planoDaDemonstracao(HOJE));
  });

  it("tem os totais que o resumo impresso vai mostrar", () => {
    const { ocorrencias } = planoDaDemonstracao(HOJE);
    const contar = (status: string): number =>
      ocorrencias.filter((o) => o.statusFinal === status).length;

    expect(ocorrencias).toHaveLength(36);
    expect(ocorrencias.filter((o) => o.organizacao === "a")).toHaveLength(24);
    expect(ocorrencias.filter((o) => o.organizacao === "b")).toHaveLength(12);
    expect(contar("aberta")).toBe(4);
    expect(contar("em_analise")).toBe(4);
    expect(contar("em_atendimento")).toBe(5);
    expect(contar("pausada")).toBe(4);
    expect(contar("resolvida")).toBe(14);
    expect(contar("cancelada")).toBe(5);
  });

  it("as mensagens ficam só no mês corrente, porque enviarComentario não aceita instante", () => {
    const plano = planoDaDemonstracao(HOJE);
    const comMensagem = plano.ocorrencias.filter((o) => o.recebeMensagem);
    const mesCorrente = plano.baldes.at(-1)?.rotulo;

    expect(comMensagem).toHaveLength(6);
    for (const ocorrencia of comMensagem) expect(ocorrencia.balde).toBe(mesCorrente);
  });

  it("exercita os dois escritores da solução aplicada", () => {
    const { ocorrencias } = planoDaDemonstracao(HOJE);
    const porCampo = ocorrencias.filter((o) =>
      o.roteiro.some((p) => p.comando === "registrar-solucao-aplicada"),
    );
    const porResolver = ocorrencias.filter((o) =>
      o.roteiro.some((p) => p.comando === "resolver" && p.solucaoAplicada !== ""),
    );

    expect(porCampo).toHaveLength(2);
    expect(porResolver).toHaveLength(14);
  });

  it("exercita cancelar_propria e cancelar_qualquer", () => {
    const { ocorrencias } = planoDaDemonstracao(HOJE);
    const canceladas = ocorrencias.filter((o) => o.statusFinal === "cancelada");
    const peloAutor = canceladas.filter((o) =>
      o.roteiro.some((p) => p.comando === "cancelar" && p.por === o.autor),
    );

    expect(canceladas).toHaveLength(5);
    expect(peloAutor).toHaveLength(2);
  });
});

describe("o perfil de teste", () => {
  it("sem perfil, o plano é o da demonstração", () => {
    expect(planoDaDemonstracao(HOJE)).toEqual(planoDaDemonstracao(HOJE, PERFIL_DA_DEMONSTRACAO));
  });

  it("o gêmeo troca só os nomes das organizações e os e-mails das duas contas", () => {
    const demo = planoDaDemonstracao(HOJE);
    const gemeo = planoDaDemonstracao(HOJE, PERFIL_DE_TESTE);

    expect(gemeo.ocorrencias).toEqual(demo.ocorrencias);
    expect(gemeo.areas).toEqual(demo.areas);
    expect(gemeo.vinculos).toEqual(demo.vinculos);
    expect(gemeo.pessoas.map((p) => p.nome)).toEqual(demo.pessoas.map((p) => p.nome));
    expect(gemeo.organizacoes.map((o) => o.nome)).toEqual([
      PERFIL_DE_TESTE.organizacoes.a,
      PERFIL_DE_TESTE.organizacoes.b,
    ]);
    expect(gemeo.pessoas.filter((p) => p.email !== null).map((p) => p.email)).toEqual([
      PERFIL_DE_TESTE.contas.helena,
      PERFIL_DE_TESTE.contas.marcos,
    ]);
  });

  it("os dois perfis não compartilham nome de organização nem e-mail", () => {
    const nomes = [PERFIL_DA_DEMONSTRACAO, PERFIL_DE_TESTE].flatMap((p) => Object.values(p.organizacoes));
    const emails = [PERFIL_DA_DEMONSTRACAO, PERFIL_DE_TESTE].flatMap((p) => Object.values(p.contas));
    expect(new Set(nomes).size).toBe(4);
    expect(new Set(emails).size).toBe(4);
  });
});

describe("os testes de ponta a ponta não alcançam a demonstração (item 63)", () => {
  /** Resolvido a partir deste arquivo, como `testes/interface/formulario.test.ts:43` faz com a raiz. */
  const PASTA = fileURLToPath(new URL("../testes/ponta-a-ponta/", import.meta.url));
  const arquivos = readdirSync(PASTA).filter((nome) => nome.endsWith(".ts"));
  const ler = (nome: string): string => readFileSync(PASTA + nome, "utf8");

  /** O nome como literal, entre aspas, crases ou apóstrofos, e nunca por trecho (ver o plano, §0). */
  const comoLiteral = (texto: string, nome: string): boolean =>
    ['"', "'", "`"].some((aspa) => texto.includes(`${aspa}${nome}${aspa}`));

  it("nenhum arquivo cita as contas da demonstração", () => {
    const contas = Object.values(PERFIL_DA_DEMONSTRACAO.contas);
    expect(arquivos.filter((nome) => contas.some((email) => ler(nome).includes(email)))).toStrictEqual([]);
  });

  it("nenhum arquivo nomeia uma organização da demonstração", () => {
    const nomes = Object.values(PERFIL_DA_DEMONSTRACAO.organizacoes);
    expect(arquivos.filter((nome) => nomes.some((org) => comoLiteral(ler(nome), org)))).toStrictEqual([]);
  });

  it("o mundo.ts do Playwright nomeia o mundo de teste da semente, sem cópia divergente", () => {
    const fonte = ler("mundo.ts");
    for (const texto of [...Object.values(PERFIL_DE_TESTE.contas), ...Object.values(PERFIL_DE_TESTE.organizacoes)]) {
      expect(comoLiteral(fonte, texto), texto).toBe(true);
    }
  });
});
