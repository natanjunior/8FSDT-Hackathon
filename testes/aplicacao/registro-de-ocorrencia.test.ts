import { beforeEach, describe, expect, it } from "vitest";

import {
  AnexoJaReivindicado,
  type ArmazenamentoDeAnexos,
} from "@/aplicacao/anexo";
import {
  AreaInvalida,
  CategoriaInvalida,
  OcorrenciaNaoEncontrada,
  registrarOcorrencia,
  verOcorrencia,
  type OcorrenciaLida,
  type RepositorioEscopadoDeOcorrencias,
  type ResultadoDoRegistro,
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
const ID_ORGANIZACAO = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

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
    registrar: async (agregado: Ocorrencia): Promise<ResultadoDoRegistro> => {
      gravadas.push(agregado);
      const primeira = agregado.ultimaTransicao;
      const autor = { pessoaId: agregado.autorPessoaId, nome: "Helena Rocha" };
      // Anotado, e não inferido: é isto que mantém o duplo conferido contra o modelo de leitura de
      // verdade em vez de virar um objeto qualquer que o `as unknown as` do fim engole.
      const ocorrencia: OcorrenciaLida = {
        id: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
        titulo: agregado.titulo,
        descricao: agregado.descricao,
        status: agregado.status,
        prioridade: agregado.prioridade,
        categoria: { id: agregado.categoriaId, nome: "Problemas de iluminação", icone: "lightbulb" },
        compartilhamentos: [],
        area: { id: agregado.areaId, nome: "Garagem", tipo: agregado.areaTipo },
        localizacaoComplemento: agregado.localizacaoComplemento,
        // **`anexos` é campo novo e OBRIGATÓRIO de `OcorrenciaLida`** — sem esta linha o `tsc` recusa
        // este arquivo, e é o mesmo acerto que a Tarefa 9 faz em `testes/interface/ocorrencia.test.ts`.
        anexos: [],
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
        // **As regras da organização** (item 99), no padrão de toda organização nova.
        regrasDaOrganizacao: { exigirSolucaoAoResolver: false, limiteDeCancelamentoDoSolicitante: "em_analise" },
      };
      return { desfecho: "registrada", ocorrencia };
    },
    porId: async () => null,
    trilha: async () => [],
  }) as unknown as RepositorioEscopadoDeOcorrencias;

/**
 * **Nunca chamada pelos casos antigos**: nenhum deles registra com anexo, e a porta só é tocada dentro
 * do laço de `entrada.anexos`. Estourar é o ponto — se algum caso passar a registrar com anexo, ele
 * falha em voz alta em vez de reivindicar contra um duplo silencioso.
 */
const SEM_ANEXO = {
  conferirTicket: () => {
    throw new Error("Este caso não registra com anexo.");
  },
  descrever: () => {
    throw new Error("Este caso não registra com anexo.");
  },
  marcarConfirmado: () => {
    throw new Error("Este caso não registra com anexo.");
  },
  urlDeLeitura: () => {
    throw new Error("Este caso não registra com anexo.");
  },
} as unknown as ArmazenamentoDeAnexos;

/** `agora` fixo: o comando não lê relógio quando quem chama informa o instante. */
const CTX = {
  pessoaId: ID_PESSOA,
  organizacaoId: ID_ORGANIZACAO,
  agora: "2026-08-25T13:02:11.000Z",
};

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
      {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
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
      {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
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
      {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
      CTX,
      ENTRADA,
    );

    expect(gravadas[0]?.areaTipo).toBe("privativa");
  });

  it("o autor é quem chamou — nunca vem do corpo", async () => {
    await registrarOcorrencia(
      {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
      CTX,
      ENTRADA,
    );

    expect(gravadas[0]?.autorPessoaId).toBe(ID_PESSOA);
  });

  it("complemento em branco vira null — string vazia não é um complemento", async () => {
    await registrarOcorrencia(
      {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
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
        {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
        CTX,
        ENTRADA,
      ),
    ).rejects.toBeInstanceOf(CategoriaInvalida);
  });

  it("categoria desativada dá a MESMA recusa que categoria inexistente", async () => {
    categorias = [{ ...categorias[0]!, ativa: false }];

    const recusa = await registrarOcorrencia(
      {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
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
        {
        ocorrencias: repoDeOcorrencias(),
        categorias: repoDeCategorias(),
        areas: repoDeAreas(),
        armazenamento: SEM_ANEXO,
      },
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

describe("o anexo entra pelo agregado, e só depois de a categoria e a área passarem", () => {
  const REFERENCIA = { chave: "anx_01JB8Z6K9T2M4N7Q", ticket: "eyJ.qualquer" };

  /** Conta as chamadas, que é o que prova a ORDEM — a decisão D-P1 do plano. */
  let tentouReivindicar: number;

  const armazenamentoQueAceita = () =>
    ({
      conferirTicket: () => {
        tentouReivindicar += 1;
        return {
          chave: REFERENCIA.chave,
          chaveMiniatura: `${REFERENCIA.chave}_mini`,
          organizacaoId: ID_ORGANIZACAO,
          pessoaId: ID_PESSOA,
          tipoConteudo: "image/jpeg",
          tamanhoMaximo: 400_000,
          expiraEm: "2026-08-27T13:15:00.000Z",
        };
      },
      descrever: async (chave: string) =>
        chave === REFERENCIA.chave
          ? { tipoConteudo: "image/jpeg", tamanhoBytes: 391_244, nomeArquivo: null, estado: "pendente" }
          : null,
      marcarConfirmado: async () => true,
      urlDeLeitura: (chave: string) => `https://storage.invalido/${chave}`,
    }) as unknown as ArmazenamentoDeAnexos;

  beforeEach(() => {
    tentouReivindicar = 0;
  });

  const portas = () => ({
    ocorrencias: repoDeOcorrencias(),
    categorias: repoDeCategorias(),
    areas: repoDeAreas(),
    armazenamento: armazenamentoQueAceita(),
  });

  const ctx = { pessoaId: ID_PESSOA, organizacaoId: ID_ORGANIZACAO, agora: "2026-08-27T13:00:00.000Z" };

  const entrada = {
    titulo: "Lâmpada queimada na garagem",
    descricao: "Está escuro à noite.",
    categoriaId: ID_CATEGORIA,
    areaId: ID_AREA,
  };

  it("o agregado que chega ao repositório carrega o anexo", async () => {
    await registrarOcorrencia(portas(), ctx, { ...entrada, anexos: [REFERENCIA] });

    expect(gravadas[0]!.anexos).toHaveLength(1);
    expect(gravadas[0]!.anexos[0]!.chave).toBe(REFERENCIA.chave);
    // O instante do anexo é o MESMO do registro — o comando lê o relógio uma vez.
    expect(gravadas[0]!.anexos[0]!.anexadoEm).toBe(gravadas[0]!.registradaEm);
  });

  it("sem `anexos`, o agregado nasce com a lista vazia", async () => {
    await registrarOcorrencia(portas(), ctx, entrada);
    expect(gravadas[0]!.anexos).toStrictEqual([]);
  });

  it("categoria inválida recusa ANTES de reivindicar — o objeto não é promovido à toa", async () => {
    // D-P1: reivindicar antes promoveria a etiqueta num pedido que vai levar 422, produzindo de graça o
    // objeto órfão-confirmado que a §10.3 declara irrecuperável.
    await expect(
      registrarOcorrencia(portas(), ctx, {
        ...entrada,
        categoriaId: "00000000-0000-4000-8000-000000000000",
        anexos: [REFERENCIA],
      }),
    ).rejects.toBeInstanceOf(CategoriaInvalida);

    expect(tentouReivindicar).toBe(0);
    expect(gravadas).toHaveLength(0);
  });

  it("área inválida também recusa antes de reivindicar", async () => {
    await expect(
      registrarOcorrencia(portas(), ctx, {
        ...entrada,
        areaId: "00000000-0000-4000-8000-000000000000",
        anexos: [REFERENCIA],
      }),
    ).rejects.toBeInstanceOf(AreaInvalida);

    expect(tentouReivindicar).toBe(0);
  });

  it("o desfecho `anexo-ja-reivindicado` vira 409 com o ocorrenciaId no corpo", async () => {
    const repositorio = {
      ...repoDeOcorrencias(),
      registrar: async () => ({
        desfecho: "anexo-ja-reivindicado" as const,
        ocorrenciaId: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
      }),
    } as unknown as RepositorioEscopadoDeOcorrencias;

    const erro = await registrarOcorrencia(
      { ...portas(), ocorrencias: repositorio },
      ctx,
      { ...entrada, anexos: [REFERENCIA] },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(AnexoJaReivindicado);
    expect((erro as AnexoJaReivindicado).codigo).toBe("ANEXO_JA_REIVINDICADO");
    // O `ocorrenciaId` viaja em `extensoes`, que é onde um erro de domínio carrega dado, e a camada de
    // Interface o copia para o corpo do problema.
    expect((erro as AnexoJaReivindicado).extensoes).toStrictEqual({
      ocorrenciaId: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
    });
  });
});
