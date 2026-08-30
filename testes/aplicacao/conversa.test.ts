import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  enviarComentario,
  OcorrenciaNaoEncontrada,
  verComentarios,
  type ComentarioLido,
  type OcorrenciaCarregada,
  type OcorrenciaLida,
  type RepositorioEscopadoDeOcorrencias,
} from "@/aplicacao/ocorrencia";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — a conversa (item 30)
 * ============================================================================
 *
 * **O que este arquivo prova, e o repositório não:** que quem não é participante recebe `404` **nas duas
 * operações e ANTES de qualquer leitura de mensagem**; que a página pede uma linha a mais do que devolve
 * e é assim que `temMais` existe sem `count`; e que **`enviarComentario` não pergunta o estado** — ele
 * comenta em `resolvida` e em `cancelada`, porque `comentar` não é comando.
 *
 * O SQL das duas leituras tem teste próprio, contra Postgres, em `testes/integracao/ocorrencia.test.ts`
 * e em `testes/integracao/isolamento-de-organizacao.test.ts`.
 */

const AUTORA = { pessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d", nome: "Marina Rocha" };
const GESTOR = { pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f", nome: "Roberto Salles" };
const ESTRANHA = { pessoaId: "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9", nome: "Helena Rocha" };

const ID = "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";

let ocorrencia: OcorrenciaLida | null;
let paginaDoRepositorio: ComentarioLido[];
let statusCarregado: string;

const comentarios = vi.fn();
const comentar = vi.fn();

function mensagem(id: string, criadoEm: string): ComentarioLido {
  return { id, texto: `texto ${id}`, autor: AUTORA, criadoEm };
}

const repositorio = () =>
  ({
    porId: () => Promise.resolve(ocorrencia),
    carregar: () =>
      Promise.resolve(
        ocorrencia === null
          ? null
          : ({
              ocorrencia: { status: statusCarregado, autorPessoaId: ocorrencia.autor.pessoaId },
              temResponsavel: false,
            } as unknown as OcorrenciaCarregada),
      ),
    comentarios: comentarios.mockImplementation((_id: string, pagina: { limite: number }) =>
      Promise.resolve(paginaDoRepositorio.slice(0, pagina.limite)),
    ),
    comentar: comentar.mockImplementation((_id: string, dados: { texto: string; em: string }) =>
      Promise.resolve({ id: "nova", texto: dados.texto, autor: GESTOR, criadoEm: dados.em }),
    ),
  }) as unknown as RepositorioEscopadoDeOcorrencias;

beforeEach(() => {
  vi.clearAllMocks();
  ocorrencia = { autor: AUTORA } as unknown as OcorrenciaLida;
  paginaDoRepositorio = [];
  statusCarregado = "em_atendimento";
});

describe("quem pode ler a conversa — critério 30.2", () => {
  it("o autor lê, e o Gestor lê", async () => {
    paginaDoRepositorio = [mensagem("a", "2026-08-20T10:00:00.000Z")];

    const doAutor = await verComentarios(repositorio(), ID, {
      pessoaId: AUTORA.pessoaId,
      podeLerTodas: false,
    });
    const doGestor = await verComentarios(repositorio(), ID, {
      pessoaId: GESTOR.pessoaId,
      podeLerTodas: true,
    });

    expect(doAutor.itens.length).toBe(1);
    expect(doGestor.itens.length).toBe(1);
  });

  it("quem não é nenhum dos dois recebe 404 — e ANTES de qualquer leitura de mensagem", async () => {
    await expect(
      verComentarios(repositorio(), ID, { pessoaId: ESTRANHA.pessoaId, podeLerTodas: false }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(comentarios).not.toHaveBeenCalled();
  });

  it("ocorrência inexistente dá o MESMO 404 de quem não pode ler — §6.3", async () => {
    ocorrencia = null;
    await expect(
      verComentarios(repositorio(), ID, { pessoaId: AUTORA.pessoaId, podeLerTodas: false }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });

  it("enviar também recusa quem não é participante, e ANTES de escrever", async () => {
    await expect(
      enviarComentario(
        repositorio(),
        ID,
        { pessoaId: ESTRANHA.pessoaId, podeLerTodas: false },
        { texto: "oi" },
      ),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(comentar).not.toHaveBeenCalled();
  });

  it("enviar em ocorrência de outra organização dá 404, e não escreve", async () => {
    ocorrencia = null;
    await expect(
      enviarComentario(
        repositorio(),
        ID,
        { pessoaId: GESTOR.pessoaId, podeLerTodas: true },
        { texto: "oi" },
      ),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(comentar).not.toHaveBeenCalled();
  });
});

describe("a página pede uma linha a mais do que devolve", () => {
  it("com mais do que o limite, devolve o limite e temMais verdadeiro", async () => {
    paginaDoRepositorio = [
      mensagem("a", "2026-08-20T10:00:00.000Z"),
      mensagem("b", "2026-08-20T10:01:00.000Z"),
      mensagem("c", "2026-08-20T10:02:00.000Z"),
    ];

    const pagina = await verComentarios(
      repositorio(),
      ID,
      { pessoaId: AUTORA.pessoaId, podeLerTodas: false },
      { limite: 2 },
    );

    expect(comentarios).toHaveBeenCalledWith(ID, { limite: 3, cursor: null });
    expect(pagina.itens.map((m) => m.id)).toStrictEqual(["a", "b"]);
    expect(pagina.temMais).toBe(true);
  });

  it("com exatamente o limite, temMais é falso", async () => {
    paginaDoRepositorio = [
      mensagem("a", "2026-08-20T10:00:00.000Z"),
      mensagem("b", "2026-08-20T10:01:00.000Z"),
    ];

    const pagina = await verComentarios(
      repositorio(),
      ID,
      { pessoaId: AUTORA.pessoaId, podeLerTodas: false },
      { limite: 2 },
    );

    expect(pagina.itens.length).toBe(2);
    expect(pagina.temMais).toBe(false);
  });

  it("sem limite pedido, usa o padrão de 20 e pede 21", async () => {
    await verComentarios(repositorio(), ID, { pessoaId: AUTORA.pessoaId, podeLerTodas: false });
    expect(comentarios).toHaveBeenCalledWith(ID, { limite: 21, cursor: null });
  });

  it("o cursor desce como veio", async () => {
    const cursor = { criadoEm: "2026-08-20T10:00:00.000Z", id: "a" };
    await verComentarios(
      repositorio(),
      ID,
      { pessoaId: AUTORA.pessoaId, podeLerTodas: false },
      { limite: 5, cursor },
    );
    expect(comentarios).toHaveBeenCalledWith(ID, { limite: 6, cursor });
  });
});

describe("enviar NÃO pergunta o estado — comentar não é comando", () => {
  it.each(["resolvida", "cancelada"])("comenta em %s, e o repositório é chamado", async (status) => {
    statusCarregado = status;

    const criada = await enviarComentario(
      repositorio(),
      ID,
      { pessoaId: GESTOR.pessoaId, podeLerTodas: true },
      { texto: "a lâmpada nova já foi instalada" },
    );

    expect(criada.texto).toBe("a lâmpada nova já foi instalada");
    expect(comentar).toHaveBeenCalledTimes(1);
  });

  it("o instante gravado é UM só, lido uma vez, e a autoria é de quem pergunta", async () => {
    await enviarComentario(
      repositorio(),
      ID,
      { pessoaId: GESTOR.pessoaId, podeLerTodas: true },
      { texto: "oi" },
    );

    const [, dados] = comentar.mock.calls[0] as [string, { autorPessoaId: string; em: string }];
    expect(dados.autorPessoaId).toBe(GESTOR.pessoaId);
    expect(Number.isNaN(Date.parse(dados.em))).toBe(false);
  });
});
