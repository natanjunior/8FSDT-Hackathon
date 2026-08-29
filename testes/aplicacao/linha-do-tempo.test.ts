import { beforeEach, describe, expect, it } from "vitest";

import {
  OcorrenciaNaoEncontrada,
  verLinhaDoTempo,
  type AtribuicaoLida,
  type ComentarioLido,
  type OcorrenciaLida,
  type RepositorioEscopadoDeOcorrencias,
  type TransicaoLida,
} from "@/aplicacao/ocorrencia";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — a intercalação da linha do tempo (item 29)
 * ============================================================================
 *
 * **O que este arquivo prova, e o repositório não:** que duas fontes fora de ordem entram e uma lista
 * cronológica sai; que os dois desempates são declarados e não emergentes; e que quem não pode ler a
 * ocorrência recebe o `404` **antes** de qualquer leitura de trilha.
 *
 * O SQL que alimenta as duas fontes tem teste próprio, contra Postgres, em
 * `testes/integracao/ocorrencia.test.ts` e em `testes/integracao/isolamento-de-organizacao.test.ts`.
 */

const AUTORA = { pessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d", nome: "Marina Rocha" };
const GESTOR = { pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f", nome: "Roberto Salles" };
const ENCARREGADO = { pessoaId: "9d3e2f81-0a1b-4c2d-8e3f-4a5b6c7d8e9f", nome: "Antônio Ferreira" };

const ID = "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";

let trilha: TransicaoLida[];
let atribuicoes: AtribuicaoLida[];
/** A terceira fonte, do item 30. Zerada no `beforeEach` como as outras duas. */
let mensagens: ComentarioLido[];
let ocorrencia: OcorrenciaLida | null;

function transicao(sequencia: number, ocorreuEm: string): TransicaoLida {
  return {
    sequencia,
    statusAnterior: sequencia === 1 ? null : "aberta",
    statusNovo: sequencia === 1 ? "aberta" : "em_analise",
    ocorreuEm,
    autor: sequencia === 1 ? AUTORA : GESTOR,
    observacao: null,
    motivoPausa: null,
    motivoCancelamento: null,
  };
}

function atribuicao(atribuidoEm: string, encerradaEm: string | null): AtribuicaoLida {
  return {
    responsavel: ENCARREGADO,
    autor: GESTOR,
    atribuidoEm,
    encerradaEm,
    motivoEncerramento: encerradaEm === null ? null : "reatribuicao",
  };
}

const repositorio = () =>
  ({
    porId: async () => ocorrencia,
    trilha: async () => trilha,
    atribuicoes: async () => atribuicoes,
    mensagens: async () => mensagens,
  }) as unknown as RepositorioEscopadoDeOcorrencias;

beforeEach(() => {
  trilha = [];
  atribuicoes = [];
  mensagens = [];
  ocorrencia = { autor: AUTORA } as unknown as OcorrenciaLida;
});

describe("a intercalação", () => {
  it("duas fontes fora de ordem entram e uma lista cronológica sai", async () => {
    trilha = [
      transicao(1, "2026-08-15T11:12:00.000Z"),
      transicao(2, "2026-08-15T12:40:00.000Z"),
      transicao(3, "2026-08-17T10:55:00.000Z"),
    ];
    atribuicoes = [atribuicao("2026-08-15T12:44:00.000Z", null)];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(eventos.map((e) => `${e.tipo}@${e.ocorridoEm}`)).toStrictEqual([
      "transicao@2026-08-15T11:12:00.000Z",
      "transicao@2026-08-15T12:40:00.000Z",
      "atribuicao@2026-08-15T12:44:00.000Z",
      "transicao@2026-08-17T10:55:00.000Z",
    ]);
  });

  it("empate de instante entre transição e atribuição resolve a TRANSIÇÃO primeiro", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z"), transicao(2, "2026-08-15T12:40:00.000Z")];
    atribuicoes = [atribuicao("2026-08-15T12:40:00.000Z", null)];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(eventos.map((e) => e.tipo)).toStrictEqual(["transicao", "transicao", "atribuicao"]);
  });

  it("empate de instante entre transições resolve por sequencia — o UNIQUE existe para isso", async () => {
    // Duas transições no MESMO instante, entregues fora de ordem: só `sequencia` as separa.
    trilha = [transicao(3, "2026-08-15T12:40:00.000Z"), transicao(2, "2026-08-15T12:40:00.000Z")];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(
      eventos.map((e) => (e.tipo === "transicao" ? e.transicao.sequencia : null)),
    ).toStrictEqual([2, 3]);
  });

  it("a reatribuição vira DOIS eventos, e o antigo fica no instante em que COMEÇOU — critério 29.3", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z")];
    atribuicoes = [
      atribuicao("2026-08-15T12:44:00.000Z", "2026-08-18T09:00:00.000Z"),
      atribuicao("2026-08-18T09:00:00.000Z", null),
    ];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    // **O `map` antes do `filter` é de propósito:** com `noUncheckedIndexedAccess`, ler `[0]` de um
    // arranjo de união exigiria narrowing sobre acesso indexado, que é frágil. Projetar para um objeto
    // simples primeiro deixa as três asserções diretas.
    const daAtribuicao = eventos
      .filter((e) => e.tipo === "atribuicao")
      .map((e) => ({
        ocorridoEm: e.ocorridoEm,
        encerradaEm: e.atribuicao.encerradaEm,
        motivo: e.atribuicao.motivoEncerramento,
      }));

    expect(daAtribuicao).toStrictEqual([
      // O antigo NÃO se move para `encerradaEm`: ele fica onde começou.
      {
        ocorridoEm: "2026-08-15T12:44:00.000Z",
        encerradaEm: "2026-08-18T09:00:00.000Z",
        motivo: "reatribuicao",
      },
      { ocorridoEm: "2026-08-18T09:00:00.000Z", encerradaEm: null, motivo: null },
    ]);
  });
});

describe("quem pode ler", () => {
  it("o autor lê sem ter ocorrencia.ler_todas", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z")];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(eventos).toHaveLength(1);
  });

  it("o Gestor lê a de outra pessoa — critério 29.4", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z")];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: GESTOR.pessoaId,
      podeLerTodas: true,
    });

    expect(eventos).toHaveLength(1);
  });

  it("quem não é autor e não tem ler_todas recebe o MESMO 404 de inexistente", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z")];

    await expect(
      verLinhaDoTempo(repositorio(), ID, { pessoaId: ENCARREGADO.pessoaId, podeLerTodas: false }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });

  it("ocorrência inexistente recebe 404 — e a trilha NUNCA é lida", async () => {
    // Um duplo próprio, porque este caso precisa saber se `trilha` foi CHAMADA — o do módulo não conta.
    let leu = false;
    const repo = {
      porId: async () => null,
      trilha: async () => {
        leu = true;
        return [];
      },
      atribuicoes: async () => [],
    } as unknown as RepositorioEscopadoDeOcorrencias;

    await expect(
      verLinhaDoTempo(repo, ID, { pessoaId: AUTORA.pessoaId, podeLerTodas: true }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
    expect(leu).toBe(false);
  });
});

describe("o terceiro tipo — critério 30.7", () => {
  it("mensagens entram intercaladas com transições e atribuições, por instante", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z"), transicao(2, "2026-08-17T10:55:00.000Z")];
    atribuicoes = [atribuicao("2026-08-15T12:44:00.000Z", null)];
    mensagens = [
      { id: "m1", texto: "Continua pingando.", autor: AUTORA, criadoEm: "2026-08-16T19:02:00.000Z" },
    ];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(eventos.map((e) => `${e.tipo}@${e.ocorridoEm}`)).toStrictEqual([
      "transicao@2026-08-15T11:12:00.000Z",
      "atribuicao@2026-08-15T12:44:00.000Z",
      "mensagem@2026-08-16T19:02:00.000Z",
      "transicao@2026-08-17T10:55:00.000Z",
    ]);
  });

  it("vêm TODAS as mensagens, e não só as do autor da ocorrência", async () => {
    trilha = [transicao(1, "2026-08-15T11:12:00.000Z")];
    mensagens = [
      { id: "m1", texto: "do solicitante", autor: AUTORA, criadoEm: "2026-08-16T19:02:00.000Z" },
      { id: "m2", texto: "do gestor", autor: GESTOR, criadoEm: "2026-08-16T21:15:00.000Z" },
    ];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(eventos.filter((e) => e.tipo === "mensagem").length).toBe(2);
  });

  it("no MESMO instante, o desempate é transição, depois atribuição, depois mensagem", async () => {
    const instante = "2026-08-15T12:00:00.000Z";
    trilha = [transicao(1, instante)];
    atribuicoes = [atribuicao(instante, null)];
    mensagens = [{ id: "m1", texto: "junto", autor: AUTORA, criadoEm: instante }];

    const eventos = await verLinhaDoTempo(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });

    expect(eventos.map((e) => e.tipo)).toStrictEqual(["transicao", "atribuicao", "mensagem"]);
  });

  it("quem não pode ler a ocorrência não chega a ler mensagem nenhuma", async () => {
    await expect(
      verLinhaDoTempo(repositorio(), ID, { pessoaId: ENCARREGADO.pessoaId, podeLerTodas: false }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });
});
