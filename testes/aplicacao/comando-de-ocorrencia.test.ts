import { beforeEach, describe, expect, it } from "vitest";

import {
  analisarOcorrencia,
  OcorrenciaNaoEncontrada,
  TransicaoNaoPermitida,
  type OcorrenciaLida,
  type RepositorioEscopadoDeOcorrencias,
  type ResultadoDaTransicao,
} from "@/aplicacao/ocorrencia";
import { Ocorrencia, RegistroDeTransicao, type StatusOcorrencia } from "@/dominio/ocorrencia";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — a família dos comandos de ocorrência
 * ============================================================================
 *
 * **O nome do arquivo é da FAMÍLIA, não do comando.** Os itens 17 a 27 acrescentam casos aqui em vez de
 * um arquivo por comando — é o que o item do DoD conta no diff, e é a forma da ADR-0008.
 *
 * **Duplo, não *mock* de módulo** (ADR-0005): a porta é pequena o bastante para ser implementada à mão, e
 * o duplo **transcreve o agregado**, exatamente como o repositório de verdade faz. É isso que o torna uma
 * prova e não uma encenação: se o comando parasse de atravessar o agregado, o `status` do que chega ao
 * duplo sumiria em vez de continuar certo por acidente.
 */

const ID = "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";
const GESTOR = "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const MORADORA = "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d";

/** As permissões do Gestor que importam aqui — lista, nunca papel (contrato §4.5). */
const DO_GESTOR = [
  "ocorrencia.ler_propria",
  "ocorrencia.ler_todas",
  "ocorrencia.analisar",
  "ocorrencia.atribuir",
  "ocorrencia.alterar_prioridade",
  "ocorrencia.cancelar_qualquer",
];

function agregadoEm(status: StatusOcorrencia): Ocorrencia {
  return Ocorrencia.reconstituir({
    titulo: "Lâmpada queimada na garagem",
    descricao: "Queimada faz três dias.",
    categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
    areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
    areaTipo: "comum",
    localizacaoComplemento: null,
    autorPessoaId: MORADORA,
    registradaEm: "2026-08-25T13:02:11.000Z",
    status,
    prioridade: "normal",
    trilha: [
      RegistroDeTransicao.reconstituir({
        sequencia: 1,
        statusAnterior: null,
        statusNovo: "aberta",
        ocorreuEm: "2026-08-25T13:02:11.000Z",
        autorPessoaId: MORADORA,
        observacao: null,
        motivoPausa: null,
        motivoCancelamento: null,
      }),
    ],
  });
}

/** O modelo de leitura que o duplo devolve. **Anotado, não inferido** — é o que o mantém conferido
 *  contra `OcorrenciaLida` de verdade em vez de virar objeto qualquer. */
function lidaDe(agregado: Ocorrencia): OcorrenciaLida {
  const ultima = agregado.ultimaTransicao;
  const autor = { pessoaId: agregado.autorPessoaId, nome: "Helena Rocha" };

  return {
    id: ID,
    titulo: agregado.titulo,
    descricao: agregado.descricao,
    status: agregado.status,
    prioridade: agregado.prioridade,
    categoria: { id: agregado.categoriaId, nome: "Problemas de iluminação", icone: "lightbulb" },
    area: { id: agregado.areaId, nome: "Garagem", tipo: agregado.areaTipo },
    localizacaoComplemento: agregado.localizacaoComplemento,
    anexos: [],
    autor,
    responsavel: null,
    solucaoAplicada: null,
    avaliacao: null,
    motivoPausa: null,
    ultimaTransicao: {
      sequencia: ultima.sequencia,
      statusAnterior: ultima.statusAnterior,
      statusNovo: ultima.statusNovo,
      ocorreuEm: ultima.ocorreuEm,
      autor: { pessoaId: ultima.autorPessoaId, nome: "Helena Rocha" },
      observacao: ultima.observacao,
      motivoPausa: ultima.motivoPausa,
      motivoCancelamento: ultima.motivoCancelamento,
    },
    registradaEm: agregado.registradaEm,
    atualizadaEm: ultima.ocorreuEm,
  };
}

/** O rastro que o duplo deixa, e é o que o teste inspeciona depois. */
let carregados: (Ocorrencia | null)[];
let aplicados: Ocorrencia[];

function repositorio(opcoes: {
  /** O que cada `carregar` devolve, na ordem; o último valor se repete. */
  cargas: readonly (Ocorrencia | null)[];
  conflito?: boolean;
}): RepositorioEscopadoDeOcorrencias {
  let chamada = 0;

  return {
    carregar: async (): Promise<Ocorrencia | null> => {
      const carga = opcoes.cargas[Math.min(chamada, opcoes.cargas.length - 1)] ?? null;
      chamada += 1;
      carregados.push(carga);
      return carga;
    },
    aplicarTransicao: async (_id: string, ocorrencia: Ocorrencia): Promise<ResultadoDaTransicao> => {
      aplicados.push(ocorrencia);
      return opcoes.conflito === true
        ? { desfecho: "conflito" }
        : { desfecho: "aplicada", ocorrencia: lidaDe(ocorrencia) };
    },
  } as unknown as RepositorioEscopadoDeOcorrencias;
}

beforeEach(() => {
  carregados = [];
  aplicados = [];
});

describe("analisarOcorrencia", () => {
  const ctx = { pessoaId: GESTOR, permissoes: DO_GESTOR, agora: "2026-08-27T09:14:00.000Z" };

  it("caminho feliz: o agregado ATRAVESSADO chega ao repositório em em_analise, com dois registros", async () => {
    const lida = await analisarOcorrencia(repositorio({ cargas: [agregadoEm("aberta")] }), ctx, {
      ocorrenciaId: ID,
      observacao: "Vou ver o estoque.",
    });

    const gravado = aplicados[0]!;
    expect(gravado.status).toBe("em_analise");
    expect(gravado.trilha).toHaveLength(2);
    expect(gravado.ultimaTransicao.statusAnterior).toBe("aberta");
    // **O autor da transição é quem CHAMOU, nunca o autor da ocorrência.**
    expect(gravado.ultimaTransicao.autorPessoaId).toBe(GESTOR);
    expect(gravado.ultimaTransicao.ocorreuEm).toBe("2026-08-27T09:14:00.000Z");
    expect(gravado.ultimaTransicao.observacao).toBe("Vou ver o estoque.");

    expect(lida.status).toBe("em_analise");
    expect(lida.ultimaTransicao.statusNovo).toBe("em_analise");
  });

  it("observação em branco vira null — string vazia não entra numa trilha append-only", async () => {
    await analisarOcorrencia(repositorio({ cargas: [agregadoEm("aberta")] }), ctx, {
      ocorrenciaId: ID,
      observacao: "   ",
    });

    expect(aplicados[0]!.ultimaTransicao.observacao).toBeNull();
  });

  it("ocorrência inexistente nesta organização vira 404, e nada é gravado", async () => {
    await expect(
      analisarOcorrencia(repositorio({ cargas: [null] }), ctx, { ocorrenciaId: ID }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(aplicados).toHaveLength(0);
  });

  it("quem não alcança a ocorrência recebe o MESMO 404 — §6.3", async () => {
    // A conferência é redundante hoje (quem tem `analisar` tem `ler_todas` no mesmo papel) e roda mesmo
    // assim: permissão é lista, não papel, e amarrar a leitura à análise por coincidência de mapa é o
    // acoplamento que some quando o mapa muda.
    const semLerTodas = {
      pessoaId: GESTOR,
      permissoes: ["ocorrencia.analisar", "ocorrencia.ler_propria"],
    };

    await expect(
      analisarOcorrencia(repositorio({ cargas: [agregadoEm("aberta")] }), semLerTodas, {
        ocorrenciaId: ID,
      }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(aplicados).toHaveLength(0);
  });

  it("transição inválida vira 409 COM statusAtual e acoesDisponiveis — critério 16.3", async () => {
    const erro = await analisarOcorrencia(repositorio({ cargas: [agregadoEm("em_analise")] }), ctx, {
      ocorrenciaId: ID,
    }).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    const recusa = erro as TransicaoNaoPermitida;
    expect(recusa.codigo).toBe("TRANSICAO_NAO_PERMITIDA");
    expect(recusa.extensoes["statusAtual"]).toBe("em_analise");
    // **Presente e vazia**: `COMANDOS_IMPLEMENTADOS` ainda filtra os outros nove nesta fatia, e vazia é
    // verdade sobre o produto de hoje. O que o critério pede é o campo existir.
    expect(recusa.extensoes["acoesDisponiveis"]).toStrictEqual([]);

    // **E nada é gravado** — a segunda metade do critério 16.3.
    expect(aplicados).toHaveLength(0);
  });

  it("a corrida entre dois Gestores: conflito vira 409 com o status que de fato está lá agora", async () => {
    const erro = await analisarOcorrencia(
      // A primeira carga é `aberta` — foi o que os dois leram. A releitura devolve `em_analise`, porque
      // o outro chegou primeiro.
      repositorio({ cargas: [agregadoEm("aberta"), agregadoEm("em_analise")], conflito: true }),
      ctx,
      { ocorrenciaId: ID },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    expect((erro as TransicaoNaoPermitida).extensoes["statusAtual"]).toBe("em_analise");
    // Duas leituras: a de entrada e a releitura do conflito.
    expect(carregados).toHaveLength(2);
  });

  it("conflito com a ocorrência sumindo na releitura degrada para 404, não para 500", async () => {
    await expect(
      analisarOcorrencia(repositorio({ cargas: [agregadoEm("aberta"), null], conflito: true }), ctx, {
        ocorrenciaId: ID,
      }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });
});
