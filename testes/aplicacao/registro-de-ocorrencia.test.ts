import { beforeEach, describe, expect, it } from "vitest";

import {
  AreaInvalida,
  CategoriaInvalida,
  OcorrenciaNaoEncontrada,
  registrarOcorrencia,
  verOcorrencia,
  type OcorrenciaLida,
  type RepositorioEscopadoDeOcorrencias,
} from "@/aplicacao/ocorrencia";
import type {
  AreaLida,
  CategoriaLida,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
} from "@/aplicacao/organizacao";
import type { Ocorrencia } from "@/dominio/ocorrencia";

const ID_CATEGORIA = "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d";
const ID_AREA = "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e";
const ID_PESSOA = "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d";

let categorias: CategoriaLida[];
let areas: AreaLida[];
/** **Os agregados que chegaram ao repositório.** É o que prova que o comando atravessa o agregado em
 *  vez de montar um DTO por fora dele. */
let gravadas: Ocorrencia[];

/** Duplos, não *mocks* de biblioteca: a porta é pequena o bastante para ser implementada à mão. */
const repoDeCategorias = () =>
  ({
    listar: async () => categorias,
  }) as unknown as RepositorioEscopadoDeCategorias;

const repoDeAreas = () =>
  ({
    listar: async () => areas,
  }) as unknown as RepositorioEscopadoDeAreas;

const repoDeOcorrencias = () =>
  ({
    // O duplo **transcreve o agregado**, exatamente como o repositório de verdade faz — e é isso que o
    // torna uma prova e não uma encenação: se o comando parasse de atravessar o agregado, `status` e
    // `prioridade` sumiriam daqui em vez de continuarem certos por acidente do `default` do banco.
    registrar: async (agregado: Ocorrencia): Promise<OcorrenciaLida> => {
      gravadas.push(agregado);
      const primeira = agregado.ultimaTransicao;
      const autor = { pessoaId: agregado.autorPessoaId, nome: "Helena Rocha" };
      return {
        id: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
        titulo: agregado.titulo,
        descricao: agregado.descricao,
        status: agregado.status,
        prioridade: agregado.prioridade,
        categoria: { id: agregado.categoriaId, nome: "Problemas de iluminação", icone: "lightbulb" },
        area: { id: agregado.areaId, nome: "Garagem", tipo: agregado.areaTipo },
        localizacaoComplemento: agregado.localizacaoComplemento,
        autor,
        responsavel: null,
        solucaoAplicada: null,
        avaliacao: null,
        motivoPausa: null,
        ultimaTransicao: {
          sequencia: primeira.sequencia,
          statusAnterior: primeira.statusAnterior,
          statusNovo: primeira.statusNovo,
          ocorreuEm: primeira.ocorreuEm,
          autor,
          observacao: primeira.observacao,
          motivoPausa: primeira.motivoPausa,
          motivoCancelamento: primeira.motivoCancelamento,
        },
        registradaEm: agregado.registradaEm,
        atualizadaEm: agregado.registradaEm,
      };
    },
    porId: async () => null,
    trilha: async () => [],
  }) as RepositorioEscopadoDeOcorrencias;

/** `agora` fixo: o comando não lê relógio quando quem chama informa o instante. */
const CTX = { pessoaId: ID_PESSOA, agora: "2026-08-25T13:02:11.000Z" };

const ENTRADA = {
  titulo: "Lâmpada queimada na garagem",
  descricao: "Queimada faz três dias, corredor escuro.",
  categoriaId: ID_CATEGORIA,
  areaId: ID_AREA,
  localizacaoComplemento: "ao lado da vaga 34",
};

beforeEach(() => {
  categorias = [
    { id: ID_CATEGORIA, nome: "Problemas de iluminação", icone: "lightbulb", ativa: true, ordem: 0 },
  ];
  areas = [{ id: ID_AREA, nome: "Garagem", tipo: "comum", ativa: true, ordem: 0 }];
  gravadas = [];
});

describe("registrarOcorrencia — o caminho feliz", () => {
  it("grava e devolve a ocorrência com status aberta e prioridade normal", async () => {
    const lida = await registrarOcorrencia(
      { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
      CTX,
      ENTRADA,
    );

    expect(lida.status).toBe("aberta");
    expect(lida.prioridade).toBe("normal");
    expect(lida.ultimaTransicao.statusAnterior).toBeNull();
  });

  /**
   * **O teste que impede o agregado de virar código morto.** Se alguém "simplificar" o comando montando
   * um DTO e deixando `status` para o `default` do banco, o que chega ao repositório deixa de ser uma
   * `Ocorrencia` — e a invariante 1 passa a valer por disciplina em vez de por estrutura.
   */
  it("o que chega ao repositório é o AGREGADO, com a trilha já dentro", async () => {
    await registrarOcorrencia(
      { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
      CTX,
      ENTRADA,
    );

    const agregado = gravadas[0]!;
    expect(agregado.status).toBe("aberta");
    expect(agregado.prioridade).toBe("normal");
    expect(agregado.trilha).toHaveLength(1);
    expect(agregado.ultimaTransicao.statusAnterior).toBeNull();
    expect(agregado.ultimaTransicao.ocorreuEm).toBe("2026-08-25T13:02:11.000Z");
  });

  it("congela o tipo da Área lido no instante do registro", async () => {
    areas = [{ id: ID_AREA, nome: "Apartamento 302", tipo: "privativa", ativa: true, ordem: 0 }];

    await registrarOcorrencia(
      { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
      CTX,
      ENTRADA,
    );

    expect(gravadas[0]?.areaTipo).toBe("privativa");
  });

  it("o autor é quem chamou — nunca vem do corpo", async () => {
    await registrarOcorrencia(
      { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
      CTX,
      ENTRADA,
    );

    expect(gravadas[0]?.autorPessoaId).toBe(ID_PESSOA);
  });

  it("complemento em branco vira null — string vazia não é um complemento", async () => {
    await registrarOcorrencia(
      { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
      CTX,
      { ...ENTRADA, localizacaoComplemento: "   " },
    );

    expect(gravadas[0]?.localizacaoComplemento).toBeNull();
  });
});

describe("registrarOcorrencia — as recusas de domínio", () => {
  it("categoria de outra organização é indistinguível de inexistente", async () => {
    categorias = [];

    await expect(
      registrarOcorrencia(
        { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
        CTX,
        ENTRADA,
      ),
    ).rejects.toBeInstanceOf(CategoriaInvalida);
  });

  it("categoria desativada dá a MESMA recusa que categoria inexistente", async () => {
    categorias = [{ ...categorias[0]!, ativa: false }];

    const recusa = await registrarOcorrencia(
      { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
      CTX,
      ENTRADA,
    ).catch((erro: unknown) => erro);

    expect(recusa).toBeInstanceOf(CategoriaInvalida);
    expect((recusa as CategoriaInvalida).codigo).toBe("CATEGORIA_INVALIDA");
  });

  it("área desativada é recusada, e nada é gravado", async () => {
    areas = [{ ...areas[0]!, ativa: false }];

    await expect(
      registrarOcorrencia(
        { ocorrencias: repoDeOcorrencias(), categorias: repoDeCategorias(), areas: repoDeAreas() },
        CTX,
        ENTRADA,
      ),
    ).rejects.toBeInstanceOf(AreaInvalida);
    expect(gravadas).toStrictEqual([]);
  });
});

describe("verOcorrencia", () => {
  it("ocorrência que o repositório escopado não devolve é 404, nunca 403", async () => {
    await expect(
      verOcorrencia(repoDeOcorrencias(), "9a1f2b3c-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });
});
