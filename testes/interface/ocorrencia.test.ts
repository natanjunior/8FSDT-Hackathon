import { existsSync, globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { COLUNAS_DE_ORDENACAO, OcorrenciaNaoEncontrada } from "@/aplicacao/ocorrencia";
import type {
  AnexoLido,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  PaginaDeOcorrencias,
} from "@/aplicacao/ocorrencia";
import { CategoriaNaoEncontrada } from "@/aplicacao/organizacao";
import { PERMISSOES } from "@/dominio/organizacao";
import { ErroDeDominio } from "@/dominio/erros";
import {
  COMANDOS_IMPLEMENTADOS,
  MOTIVOS_DE_CANCELAMENTO,
  MOTIVOS_DE_PAUSA,
  STATUS,
  type Comando,
  type MotivoCancelamento,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";
import {
  codificarCursor,
  codificarCursorDeConversa,
  decodificarCursor,
  decodificarCursorDeConversa,
  descricaoDoRecorte,
  lenteDeRotulo,
  nomeDaPrioridade,
  nomeDoMotivoCancelamento,
  nomeDoMotivoPausa,
  nomeDoStatus,
  opcoesDeMotivoCancelamento,
  opcoesDeMotivoPausa,
  opcoesDePrioridade,
  projetarAnexo,
  projetarEventoDaLinhaDoTempo,
  projetarOcorrenciaDetalhe,
  projetarOcorrenciaResumo,
  projetarPaginaDeComentarios,
  projetarPaginaDeOcorrencias,
  rotuloDeMotivoPausa,
  rotuloDeStatus,
  segundaLinhaDeMotivo,
} from "@/interface/projecoes";
import {
  algumFiltroAplicado,
  CampoNaoSuportado,
  comOrganizacaoAtiva,
  CorpoNaoSuportado,
  FormatoInvalido,
  lerCorpoOpcional,
  lerBuscaDeCandidatosDaUrl,
  lerFiltroDeOcorrenciasDaUrl,
  lerLimiteDaUrl,
  lerOrdenacaoDeOcorrenciasDaUrl,
  lerPaginacaoDaUrl,
  lerVarianteDaUrl,
  problemaDe,
  recusarEvolucaoPrevista,
  recusarSemDestino,
  registrarFalha,
  type ErroDeCampo,
} from "@/interface/http";
import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";
import { areasUsadas, comAreaUsada } from "@/interface/componentes/areas-usadas";
import {
  comTitulo,
  comValorUnico,
  opcoesDeArea,
  opcoesDeResponsavel,
  PARAMETROS_DE_FILTRO,
  primeirasOpcoes,
  rotuloDoGatilho,
  semFiltros,
  type OpcaoComBusca,
} from "@/interface/componentes/filtros-da-lista";
import {
  ariaSortNaLista,
  COLUNAS_DA_LISTA,
  consultaComOrdenacao,
  lerOrdenacaoDaLista,
  proximaNaLista,
  rotuloNaLista,
  type ColunaDaLista,
} from "@/interface/componentes/ordenacao-das-ocorrencias";
import { SEM_ORDENACAO, type Ordenacao } from "@/interface/componentes/ordenacao-em-tres-estados";
import {
  casaPeloNome,
  filtrarPorNome,
  normalizarParaBusca,
  repartirCandidatos,
  termosDaBusca,
  type Candidato,
} from "@/interface/componentes/busca-de-candidatos";
import { lerOCiclo } from "@/interface/componentes/ciclo";
import { enviarComentario, executarComando } from "@/interface/componentes/comando-de-ocorrencia";
import {
  avisoDoRegistro,
  errosDoRegistro,
  FOTO,
  FRASES_DA_FOTO,
  FRASES_DO_SERVIDOR,
  rotuloDoTipoDeArea,
  temAlgoEscrito,
  TEXTOS_DO_REGISTRO,
  VALORES_VAZIOS,
  vazioDoRegistro,
  type ValoresDoRegistro,
} from "@/interface/componentes/registro-de-ocorrencia";
import { MENSAGEM_GENERICA, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";
import {
  acaoPrimaria,
  acoesDaBarra,
  AVISO_DE_AVALIACAO,
  encurtarParaOCaminho,
  nomeDaNota,
  nomesDeStatus,
  NOTAS_DA_AVALIACAO,
  ocorrenciaNaoEncontradaEm,
  PALAVRAS_DA_ATRIBUICAO,
  palavrasDaAtribuicao,
  RETORNO_DA_MENSAGEM,
  RETORNO_DO_COMANDO,
  retornoDoComando,
  rotuloDeComando,
  rotuloDoCampoDeConversa,
  rotulosDeStatus,
  textoDaNota,
  vazioDaBarra,
  vazioDaConversa,
} from "@/interface/componentes/rotulos";
import { horaDoCorte, tempoCurto, tempoRelativo } from "@/interface/componentes/tempo-relativo";
import { CAMPO_VAZIO, dataHoraComSegundos } from "@/interface/componentes/trilha-de-auditoria";
import {
  consultaDoRecorte,
  opcoesDoRecorte,
  valorDoRecorte,
} from "@/interface/componentes/opcoes-do-recorte";
import { estadoDaLista, TEXTO_DO_VAZIO, vazioDaLista } from "@/interface/componentes/vazio-da-lista";
import {
  alteracaoDePrioridadeSchema,
  atribuicaoDeResponsavelSchema,
  avaliacaoSchema,
  cancelamentoSchema,
  camposDeEvolucaoPrevista,
  camposEscritosPeloServidor,
  camposSemDestino,
  comandoComObservacaoSchema,
  comentarioSchema,
  pausaSchema,
  registroDeOcorrenciaSchema,
  resolucaoSchema,
  solucaoAplicadaSchema,
} from "@/interface/schemas";

/** A raiz do repositório, para as guardas que leem código-fonte (item 76). */
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function lerFonte(relativo: string): string {
  return readFileSync(RAIZ + relativo, "utf8");
}

/**
 * ============================================================================
 *  Unitário de INTERFACE — o corpo de `POST /ocorrencias` (item 11)
 * ============================================================================
 *
 * **Este é o QUARTO arquivo de teste da fatia, e o plano declarou três.** A justificativa que ele pedia
 * por escrito:
 *
 * O plano deixou dois critérios sem cobertura automatizada — o **11.3** (os cinco campos escritos pelo
 * servidor → `422 CAMPO_NAO_SUPORTADO`) e a **metade de forma do 11.4** (`400 FORMATO_INVALIDO` com
 * `erros[]` por campo) — e ofereceu duas saídas: um quarto arquivo, ou conferência à mão registrada no
 * relatório. **Escolhido o arquivo**, por uma razão que a conferência à mão não alcança: o gancho
 * `recusar` de `comContexto` é **plumbing novo compartilhado pelos 33 endpoints escopados** — ele roda
 * dentro de `lerCorpo`, que todo corpo de requisição atravessa. Conferido só à mão, um refactor futuro
 * de `lerCorpo` faz o campo voltar a ser descartado em silêncio, e **o silêncio é exatamente o que o
 * `422` existe para quebrar** — sem nenhum sinal na esteira.
 *
 * **O que este arquivo NÃO prova**, e é de propósito: que o handler devolve `422`. Isso é o de-para de
 * `problema.ts`, que já existe e já é exercido pelo `papel` do `PATCH /vinculos`. Aqui se prova a
 * **decisão** — quais campos são recusados, e que a recusa acontece sobre o corpo cru.
 */

const VALIDO = {
  titulo: "Lâmpada queimada na garagem",
  descricao: "Queimada faz três dias, corredor escuro.",
  categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
  areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
};

describe("o critério 11.3 — os cinco campos que o servidor escreve", () => {
  it.each(["status", "prioridade", "areaTipo", "organizacaoId", "ocorrenciaOrigemId"])(
    "%s é recusado em voz alta, nunca descartado em silêncio",
    (campo) => {
      expect(camposEscritosPeloServidor({ ...VALIDO, [campo]: "qualquer" })).toStrictEqual([campo]);
    },
  );

  it("os cinco juntos saem todos, para o erro apontar cada um", () => {
    expect(
      camposEscritosPeloServidor({
        ...VALIDO,
        status: "resolvida",
        prioridade: "alta",
        areaTipo: "privativa",
        organizacaoId: "9a1f2b3c-0000-0000-0000-000000000000",
        ocorrenciaOrigemId: "9a1f2b3c-1111-1111-1111-111111111111",
      }),
    ).toStrictEqual([
      "status",
      "prioridade",
      "areaTipo",
      "organizacaoId",
      "ocorrenciaOrigemId",
    ]);
  });

  /**
   * **A recusa vale sobre o corpo CRU, e é por isso que ela não pode morar no schema.** `status:
   * undefined` é uma chave presente — `"status" in corpo` é `true` —, e o Zod a descartaria sem deixar
   * rastro. Quem enviou o campo precisa saber que o produto não o aceita, tenha ele valor ou não.
   */
  it("a chave presente basta, mesmo com valor undefined — quem a enviou tem de saber", () => {
    expect(camposEscritosPeloServidor({ ...VALIDO, status: undefined })).toStrictEqual(["status"]);
  });

  it("corpo natural não recusa nada — a lista é fechada, não uma varredura", () => {
    expect(camposEscritosPeloServidor(VALIDO)).toStrictEqual([]);
  });

  /**
   * Campo desconhecido **fora** da lista continua sendo descartado em silêncio pelo schema. É o
   * comportamento que o repositório já tem, e alargá-lo não era decisão desta fatia.
   */
  it("campo desconhecido fora da lista NÃO vira 422 — ele segue descartado pelo schema", () => {
    expect(camposEscritosPeloServidor({ ...VALIDO, corDoPortao: "azul" })).toStrictEqual([]);
  });

  it("corpo que não é objeto não estoura — devolve lista vazia e o schema recusa a forma", () => {
    expect(camposEscritosPeloServidor(null)).toStrictEqual([]);
    expect(camposEscritosPeloServidor("texto solto")).toStrictEqual([]);
    expect(registroDeOcorrenciaSchema.safeParse("texto solto").success).toBe(false);
  });

  it("`status` não aparece no schema de entrada — a primeira verificação mecânica do openapi", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, status: "resolvida" });

    expect(conferido.success).toBe(true);
    expect(conferido.data).not.toHaveProperty("status");
  });
});

describe("o critério 11.4 — a forma, com erros[] por campo", () => {
  it("aceita o corpo natural e resolve o complemento ausente", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse(VALIDO);

    expect(conferido.success).toBe(true);
    expect(conferido.data?.titulo).toBe(VALIDO.titulo);
  });

  it("título vazio é recusado, e o campo culpado é apontado", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, titulo: "   " });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["titulo"]);
  });

  it("título acima de 150 é recusado", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, titulo: "a".repeat(151) });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.code).toBe("too_big");
  });

  it("descrição vazia e acima de 5000 são recusadas", () => {
    expect(registroDeOcorrenciaSchema.safeParse({ ...VALIDO, descricao: "" }).success).toBe(false);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, descricao: "a".repeat(5001) }).success,
    ).toBe(false);
  });

  /** **`erros[]` por campo**, e não a primeira violação: os dois campos errados aparecem juntos. */
  it("dois campos errados produzem duas violações, uma por campo", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      ...VALIDO,
      titulo: "",
      descricao: "",
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues.map((violacao) => violacao.path[0])).toStrictEqual([
      "titulo",
      "descricao",
    ]);
  });

  /** **O critério 12.1: `areaId` é obrigatório.** É dele que a visibilidade deriva (D10). */
  it("areaId ausente é recusado — é obrigatório, não opcional", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      titulo: VALIDO.titulo,
      descricao: VALIDO.descricao,
      categoriaId: VALIDO.categoriaId,
    });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["areaId"]);
  });

  it("categoriaId que não é uuid é recusado como forma, nunca como domínio", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...VALIDO, categoriaId: "iluminacao" });

    expect(conferido.success).toBe(false);
    expect(conferido.error?.issues[0]?.path).toStrictEqual(["categoriaId"]);
  });

  /** **O critério 12.1**, a outra metade: o complemento é opcional, texto livre, até 200. */
  it("localizacaoComplemento é opcional, aceita null, e para em 200", () => {
    expect(registroDeOcorrenciaSchema.safeParse(VALIDO).success).toBe(true);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, localizacaoComplemento: null }).success,
    ).toBe(true);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, localizacaoComplemento: "a".repeat(200) })
        .success,
    ).toBe(true);
    expect(
      registroDeOcorrenciaSchema.safeParse({ ...VALIDO, localizacaoComplemento: "a".repeat(201) })
        .success,
    ).toBe(false);
  });
});

/**
 * ============================================================================
 *  A listagem — o item 14
 * ============================================================================
 *
 * **O que se prova aqui é a forma da resposta**, que é o que o contrato promete e o que a tela consome.
 * O SQL tem teste próprio contra Postgres; a visibilidade tem teste próprio na Aplicação.
 */

/**
 * As nove permissões do Gestor. **Extraída do `it` *"emMenu só contém comandos que TÊM a variante
 * menu"*, sem mudar o conteúdo** (item 27): o caso novo do `vazioDaBarra` precisa da mesma lista, e
 * `ocorrencia.cancelar_qualquer` é a permissão de que a asserção *"a barra do Gestor nunca fica vazia"*
 * depende. Duas cópias divergiriam.
 */
const DO_GESTOR = [
  "ocorrencia.analisar",
  "ocorrencia.atribuir",
  "ocorrencia.iniciar_atendimento",
  "ocorrencia.pausar",
  "ocorrencia.retomar",
  "ocorrencia.registrar_solucao",
  "ocorrencia.resolver",
  "ocorrencia.alterar_prioridade",
  "ocorrencia.cancelar_qualquer",
];

const RESUMO_LIDO: OcorrenciaResumoLida = {
  id: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
  titulo: "Lâmpada queimada na garagem",
  status: "aberta",
  prioridade: "normal",
  categoria: { id: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d", nome: "Problemas de iluminação" },
  area: { id: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e", nome: "Garagem", tipo: "comum" },
  autor: { pessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d", nome: "Helena Rocha" },
  responsavel: null,
  quantidadeDeAnexos: 0,
  avaliada: false,
  motivoPausa: null,
  registradaEm: "2026-08-20T13:02:11.000Z",
  atualizadaEm: "2026-08-20T14:10:00.000Z",
};

describe("o OcorrenciaResumo projetado", () => {
  it("traz os quatorze campos do contrato, e categoria SEM icone (critério 14.6)", () => {
    const resumo = projetarOcorrenciaResumo(RESUMO_LIDO, "solicitante");

    expect(resumo.categoria).toStrictEqual({
      id: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
      nome: "Problemas de iluminação",
    });
    expect(resumo.categoria).not.toHaveProperty("icone");
    expect(resumo).not.toHaveProperty("descricao");
    expect(resumo).not.toHaveProperty("acoesDisponiveis");
    // **O décimo quarto, e é do item 27.** Sem ele o convite de T-03 não é computável — e ele é FATO da
    // ocorrência, como `status` e `motivoPausa`, nunca afazer calculado por leitor (critério 14.5).
    expect(resumo.avaliada).toBe(false);
  });

  it("avaliada é `true` quando a nota existe — e é `avaliacao_nota is not null`, nada mais", () => {
    expect(
      projetarOcorrenciaResumo({ ...RESUMO_LIDO, avaliada: true }, "solicitante").avaliada,
    ).toBe(true);
  });

  it("statusRotulo é o rótulo de gente, nunca o enum cru", () => {
    expect(projetarOcorrenciaResumo(RESUMO_LIDO, "solicitante").statusRotulo).toBe(
      "Recebida — aguardando análise",
    );
  });

  it("motivoPausa é nulo fora de pausada, e é o motivo dentro dela", () => {
    expect(projetarOcorrenciaResumo(RESUMO_LIDO, "solicitante").motivoPausa).toBeNull();

    const pausada = projetarOcorrenciaResumo(
      {
        ...RESUMO_LIDO,
        status: "pausada",
        motivoPausa: "aguardando_peca",
      },
      "solicitante",
    );
    expect(pausada.motivoPausa).toBe("aguardando_peca");
    expect(pausada.statusRotulo).toBe("Parada — esperando material chegar");
  });

  it("quantidadeDeAnexos vem do repositório; responsavel é repassado — item 19", () => {
    const resumo = projetarOcorrenciaResumo(RESUMO_LIDO, "solicitante");
    expect(resumo.quantidadeDeAnexos).toBe(0);
    expect(resumo.responsavel).toBeNull();
    // **A asserção que torna o caso útil.** Com o campo vindo do repositório, provar que ele sai `0`
    // quando entra `0` não prova nada; o que prova é o REPASSE.
    expect(
      projetarOcorrenciaResumo({ ...RESUMO_LIDO, quantidadeDeAnexos: 3 }, "solicitante")
        .quantidadeDeAnexos,
    ).toBe(3);
  });
});

describe("o envelope da página — item 14b", () => {
  const paginaLida = (extra: Partial<PaginaDeOcorrencias> = {}): PaginaDeOcorrencias => ({
    itens: [RESUMO_LIDO],
    total: 137,
    pagina: 1,
    limite: 20,
    ate: "2026-09-09T08:00:00.000Z",
    totalNoCorte: 137,
    saidasDesdeOCorte: 0,
    novasDesdeOCorte: 0,
    contagens: { todas: 9, minhas: 2, emAberto: 7, semResponsavel: 3 },
    visibilidadeAplicada: "todas",
    ...extra,
  });

  it("traz os dez campos, e NENHUM deles é proximoCursor", () => {
    const envelope = projetarPaginaDeOcorrencias(paginaLida(), "gestor");

    expect(Object.keys(envelope).sort()).toStrictEqual(
      [
        "ate",
        "contagens",
        "itens",
        "limite",
        "novasDesdeOCorte",
        "pagina",
        "saidasDesdeOCorte",
        "total",
        "totalNoCorte",
        "visibilidadeAplicada",
      ].sort(),
    );
    expect(envelope).not.toHaveProperty("proximoCursor");
  });

  it("os números atravessam intactos — a projeção não recalcula nada", () => {
    const envelope = projetarPaginaDeOcorrencias(
      paginaLida({
        total: 134,
        pagina: 2,
        totalNoCorte: 137,
        saidasDesdeOCorte: 3,
        novasDesdeOCorte: 5,
      }),
      "gestor",
    );

    expect(envelope.total).toBe(134);
    expect(envelope.totalNoCorte).toBe(137);
    expect(envelope.saidasDesdeOCorte).toBe(3);
    expect(envelope.novasDesdeOCorte).toBe(5);
    expect(envelope.contagens).toStrictEqual({ todas: 9, minhas: 2, emAberto: 7, semResponsavel: 3 });
  });

  it("página vazia continua sendo 200 com [] — a lista existe, a página é que não", () => {
    const envelope = projetarPaginaDeOcorrencias(
      paginaLida({ itens: [], pagina: 9, total: 3 }),
      "gestor",
    );

    expect(envelope.itens).toStrictEqual([]);
    expect(envelope.total).toBe(3);
    expect(envelope.visibilidadeAplicada).toBe("todas");
  });
});

describe("o codec do cursor", () => {
  it("ida e volta preserva o par exato", () => {
    const cursor = { registradaEm: "2026-08-20T13:02:11.000Z", id: RESUMO_LIDO.id };
    expect(decodificarCursor(codificarCursor(cursor))).toStrictEqual(cursor);
  });

  it("é opaco: o valor não é o par legível", () => {
    const codificado = codificarCursor({ registradaEm: "2026-08-20T13:02:11.000Z", id: RESUMO_LIDO.id });
    expect(codificado).not.toContain("2026");
    expect(codificado).not.toContain(RESUMO_LIDO.id);
  });

  it.each([
    ["texto solto", "pagina-2"],
    ["base64 de coisa nenhuma", Buffer.from("nada", "utf8").toString("base64url")],
    ["data inválida", Buffer.from(`ontem|${RESUMO_LIDO.id}`, "utf8").toString("base64url")],
    ["id que não é uuid", Buffer.from("2026-08-20T13:02:11.000Z|42", "utf8").toString("base64url")],
    ["vazio", ""],
  ])("recusa %s devolvendo null — quem traduz em 400 é a camada de transporte", (_nome, bruto) => {
    expect(decodificarCursor(bruto)).toBeNull();
  });
});

/**
 * **Traduzir HTTP é a única coisa que esta camada faz** (arquitetura.md §5), e o padrão — *"20 quando
 * ninguém pede"* — **não** mora aqui: quem sabe o que acontece quando ninguém pede nada é a Aplicação. É
 * a mesma divisão de `?ativa=` e `?situacao=`, logo acima neste arquivo.
 */
const pedido = (consulta: string) => new Request(`https://resolveai.app/api/ocorrencias${consulta}`);

describe("os parâmetros de paginação de GET /ocorrencias — item 14b", () => {
  const consulta = (texto: string) => new URLSearchParams(texto);

  it("limite ausente é undefined — o padrão é da Aplicação, não daqui", () => {
    expect(lerLimiteDaUrl(pedido(""))).toBeUndefined();
    expect(lerLimiteDaUrl(pedido("?limite="))).toBeUndefined();
  });

  it("limite dentro da faixa vira número", () => {
    expect(lerLimiteDaUrl(pedido("?limite=1"))).toBe(1);
    expect(lerLimiteDaUrl(pedido("?limite=100"))).toBe(100);
  });

  it.each(["0", "101", "-3", "20.5", "vinte", "1e2"])(
    "limite=%s é recusado em voz alta, nunca corrigido em silêncio",
    (valor) => {
      expect(() => lerLimiteDaUrl(pedido(`?limite=${valor}`))).toThrowError(
        /FORMATO_INVALIDO|inválid/iu,
      );
    },
  );

  it("todos ausentes: primeira página, corte a decidir pela Aplicação", () => {
    expect(lerPaginacaoDaUrl(consulta(""))).toStrictEqual({});
  });

  it("pagina aceita a faixa 1..1000", () => {
    expect(lerPaginacaoDaUrl(consulta("pagina=1")).pagina).toBe(1);
    expect(lerPaginacaoDaUrl(consulta("pagina=1000")).pagina).toBe(1000);
  });

  it.each(["0", "1001", "-1", "2.5", "1e2", "dois", " "])(
    "pagina=%s é 400 — nunca ajustada em silêncio",
    (valor) => {
      expect(() => lerPaginacaoDaUrl(consulta(`pagina=${valor}`))).toThrowError(
        /FORMATO_INVALIDO|inválid/iu,
      );
    },
  );

  // **O instante do caso é do PASSADO de propósito.** Um `ate` do dia corrente vira futuro assim que o
  // relógio ainda não o alcançou, e a limitação a "agora" — que é o caso logo abaixo — o normalizaria
  // para outra coisa. Teste que depende da hora em que roda é vermelho intermitente, não prova.
  it("ate legível volta em ISO com fuso, normalizado para UTC", () => {
    expect(lerPaginacaoDaUrl(consulta("ate=2026-08-20T08:00:00Z")).ate).toBe(
      "2026-08-20T08:00:00.000Z",
    );
    expect(lerPaginacaoDaUrl(consulta("ate=2026-08-20T05:00:00-03:00")).ate).toBe(
      "2026-08-20T08:00:00.000Z",
    );
  });

  it.each(["ontem", "2026-13-45T00:00:00Z", "2026-09-09"])(
    "ate=%s é 400, nunca 'agora' — responder outra coisa em silêncio é o defeito",
    (valor) => {
      expect(() => lerPaginacaoDaUrl(consulta(`ate=${valor}`))).toThrowError(
        /FORMATO_INVALIDO|inválid/iu,
      );
    },
  );

  it("ate no FUTURO é limitado a agora, e não recusado — relógio adiantado é rotina", () => {
    const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const lido = lerPaginacaoDaUrl(consulta(`ate=${futuro}`)).ate!;
    expect(Date.parse(lido)).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("totalNoCorte aceita inteiro ≥ 0, e recusa o resto", () => {
    expect(lerPaginacaoDaUrl(consulta("totalNoCorte=0")).totalNoCorte).toBe(0);
    expect(lerPaginacaoDaUrl(consulta("totalNoCorte=137")).totalNoCorte).toBe(137);
    for (const valor of ["-1", "1.5", "muitas"]) {
      expect(() => lerPaginacaoDaUrl(consulta(`totalNoCorte=${valor}`))).toThrowError(
        /FORMATO_INVALIDO|inválid/iu,
      );
    }
  });

  it("14b.9 · os três NÃO entram em FiltroDeOcorrencias — paginação não é recorte", () => {
    const filtro = lerFiltroDeOcorrenciasDaUrl(
      consulta("status=aberta&pagina=3&ate=2026-08-20T08:00:00Z&totalNoCorte=137"),
    );

    expect(filtro).toStrictEqual({ status: ["aberta"] });
    expect(Object.keys(filtro)).not.toContain("pagina");
    expect(Object.keys(filtro)).not.toContain("ate");
    expect(Object.keys(filtro)).not.toContain("totalNoCorte");
  });
});

/**
 * **O critério 14.4 é sobre não trocar uma frase pela outra**, e a troca é uma decisão — não uma
 * redação. Por isso a decisão é uma função pura com os ramos cobertos, mesmo com o de filtro só ficando
 * alcançável no item 15. O quarto ramo, da aba *Compartilhadas comigo*, nasceu no item 87 e tem os casos
 * dele no `describe` da aba, mais abaixo.
 */
describe("qual dos vazios a tela mostra", () => {
  it("todas + sem filtro: a organização, com os dois convites", () => {
    expect(vazioDaLista("todas", false)).toBe("organizacao");
  });

  it("apenas_minhas + sem filtro: o Solicitante sem histórico", () => {
    expect(vazioDaLista("apenas_minhas", false)).toBe("solicitante");
  });

  it("com filtro aplicado, o filtro GANHA da visibilidade — nas duas", () => {
    expect(vazioDaLista("todas", true)).toBe("filtro");
    // O caso que a decisão existe para acertar: um Solicitante que chega por URL filtrada e recebe zero
    // não pode ler "você ainda não registrou nenhuma" — seria a mentira que o 14.4 proíbe.
    expect(vazioDaLista("apenas_minhas", true)).toBe("filtro");
  });

  it("as frases são diferentes entre si — são quatro desde o item 87", () => {
    const titulos = Object.values(TEXTO_DO_VAZIO).map((texto) => texto.titulo);
    expect(new Set(titulos).size).toBe(4);
  });
});

describe("qual dos CINCO desfechos a lista mostra — critério 44c.3", () => {
  const todas = { visibilidadeAplicada: "todas", algumFiltroAplicado: false } as const;

  it("havendo item, é a lista, e nada mais é perguntado", () => {
    expect(estadoDaLista({ quantidade: 20, total: 137, ...todas })).toBe("lista");
  });

  it("sem item e com total, é página além do fim", () => {
    expect(estadoDaLista({ quantidade: 0, total: 137, ...todas })).toBe("alem-do-fim");
  });

  /**
   * **O caso que o critério 44c.3 existe para fixar.** Com filtro aplicado e zero itens, a resposta
   * ainda é "alem-do-fim" quando há total: o quarto estado ganha dos três vazios, porque ele responde
   * "a consulta correu e você pediu depois do fim", e não "a consulta correu e não achou nada".
   */
  it("o quarto estado ganha do vazio de filtro", () => {
    expect(
      estadoDaLista({
        quantidade: 0,
        total: 12,
        visibilidadeAplicada: "todas",
        algumFiltroAplicado: true,
      }),
    ).toBe("alem-do-fim");
  });

  it("sem item e sem total, delega aos três vazios já decididos", () => {
    expect(estadoDaLista({ quantidade: 0, total: 0, ...todas })).toBe("organizacao");
    expect(
      estadoDaLista({
        quantidade: 0,
        total: 0,
        visibilidadeAplicada: "apenas_minhas",
        algumFiltroAplicado: false,
      }),
    ).toBe("solicitante");
    expect(
      estadoDaLista({
        quantidade: 0,
        total: 0,
        visibilidadeAplicada: "todas",
        algumFiltroAplicado: true,
      }),
    ).toBe("filtro");
  });
});

describe("a hora do corte — critério 44c.6", () => {
  it("nomeia o instante no fuso escrito, nunca no do contêiner", () => {
    // 12:14 UTC é 09h14 em São Paulo, o ano inteiro: o país não tem horário de verão desde 2019.
    expect(horaDoCorte("2026-09-13T12:14:02.000Z")).toBe("09h14");
  });

  it("meia-noite é 00h00, e não 24h00", () => {
    expect(horaDoCorte("2026-09-13T03:00:00.000Z")).toBe("00h00");
  });

  it("instante ilegível degrada no mesmo travessão do resto do módulo", () => {
    expect(horaDoCorte("ontem")).toBe("—");
  });
});

describe("o tempo relativo", () => {
  const AGORA = Date.parse("2026-08-26T12:00:00.000Z");

  it.each([
    ["2026-08-26T11:59:00.000Z", "agora há pouco", "1 min"],
    ["2026-08-26T08:00:00.000Z", "há 4 horas", "4 h"],
    ["2026-08-25T12:00:00.000Z", "há 1 dia", "1 d"],
    ["2026-08-20T12:00:00.000Z", "há 6 dias", "6 d"],
  ])("%s vira %s (e %s na forma curta)", (iso, longo, curto) => {
    expect(tempoRelativo(iso, AGORA)).toBe(longo);
    expect(tempoCurto(iso, AGORA)).toBe(curto);
  });

  it("data ilegível não estoura a lista inteira — vira travessão", () => {
    expect(tempoRelativo("ontem", AGORA)).toBe("—");
    expect(tempoCurto("ontem", AGORA)).toBe("—");
  });
});

/**
 * ============================================================================
 *  O anexo na Interface — o item 13b
 * ============================================================================
 */

describe("o critério 13b.4 — `anexos` é lista de no máximo um", () => {
  const base = {
    titulo: "Lâmpada queimada na garagem",
    descricao: "Está escuro à noite.",
    categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
    areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
  };
  const referencia = { chave: "anx_01JB8Z6K9T2M4N7Q", ticket: "eyJ.qualquer" };

  it("aceita a lista com um item", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({ ...base, anexos: [referencia] });
    expect(conferido.success).toBe(true);
  });

  it("aceita ausente e aceita `null` — o anexo é opcional em todo o contrato", () => {
    expect(registroDeOcorrenciaSchema.safeParse(base).success).toBe(true);
    expect(registroDeOcorrenciaSchema.safeParse({ ...base, anexos: null }).success).toBe(true);
  });

  it("recusa DOIS itens, e a recusa é de forma — 400, não 422", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      ...base,
      anexos: [referencia, { chave: "anx_outra", ticket: "eyJ.outra" }],
    });
    expect(conferido.success).toBe(false);
    // `maxItems: 1` é ESCOPO e mora no schema (contrato §8.3): é forma, não domínio.
    expect(conferido.error!.issues[0]!.code).toBe("too_big");
  });

  it("recusa item sem `ticket`", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      ...base,
      anexos: [{ chave: "anx_01JB8Z6K9T2M4N7Q" }],
    });
    expect(conferido.success).toBe(false);
  });

  it("aceita `titulo` no item — o campo é aceito e gravado, mesmo sem tela que o escreva", () => {
    const conferido = registroDeOcorrenciaSchema.safeParse({
      ...base,
      anexos: [{ ...referencia, titulo: "Lâmpada da vaga 34" }],
    });
    expect(conferido.success).toBe(true);
  });
});

/** Um anexo lido, do jeito que o repositório o devolve. **Sem `chave` — ela não existe neste tipo.** */
const ANEXO_LIDO: AnexoLido = {
  id: "c3d4e5f6-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
  tipo: "imagem",
  titulo: null,
  nomeArquivo: null,
  tipoConteudo: "image/jpeg",
  tamanhoBytes: 391_244,
  temMiniatura: true,
  anexadoEm: "2026-08-27T13:02:11.000Z",
};

describe("o anexo projetado — as duas URLs saem daqui, nunca do storage", () => {
  const OCORRENCIA = "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8";

  it("monta o caminho estável desta API", () => {
    expect(projetarAnexo(OCORRENCIA, ANEXO_LIDO)).toMatchObject({
      url: `/api/ocorrencias/${OCORRENCIA}/anexos/${ANEXO_LIDO.id}`,
      miniaturaUrl: `/api/ocorrencias/${OCORRENCIA}/anexos/${ANEXO_LIDO.id}?variante=miniatura`,
    });
  });

  it("sem miniatura, `miniaturaUrl` é null — e o campo continua existindo", () => {
    expect(projetarAnexo(OCORRENCIA, { ...ANEXO_LIDO, temMiniatura: false }).miniaturaUrl).toBeNull();
  });

  it("nenhuma URL de storage aparece", () => {
    expect(JSON.stringify(projetarAnexo(OCORRENCIA, ANEXO_LIDO))).not.toContain(
      "blob.core.windows.net",
    );
  });
});

/** Quem lê, para o detalhe. Sem permissão de comando: `acoesDisponiveis` sai vazia, que é a verdade. */
const QUEM_LE = { pessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d", permissoes: [] };

/** Um `OcorrenciaLida` com a lista de anexos que o caso pedir. */
function umaOcorrenciaLidaCom(anexos: readonly AnexoLido[]): OcorrenciaLida {
  return {
    id: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
    titulo: RESUMO_LIDO.titulo,
    descricao: "Queimada faz três dias, corredor escuro.",
    status: "aberta",
    prioridade: "normal",
    categoria: { ...RESUMO_LIDO.categoria, icone: "lightbulb" },
    compartilhamentos: [],
    area: RESUMO_LIDO.area,
    localizacaoComplemento: null,
    anexos,
    autor: RESUMO_LIDO.autor,
    responsavel: null,
    solucaoAplicada: null,
    avaliacao: null,
    motivoPausa: null,
    ultimaTransicao: {
      sequencia: 1,
      statusAnterior: null,
      statusNovo: "aberta",
      ocorreuEm: RESUMO_LIDO.registradaEm,
      autor: RESUMO_LIDO.autor,
      observacao: null,
      motivoPausa: null,
      motivoCancelamento: null,
    },
    registradaEm: RESUMO_LIDO.registradaEm,
    atualizadaEm: RESUMO_LIDO.atualizadaEm,
  };
}

describe("os dois zeros forçados viram contagem de verdade", () => {
  it("o detalhe conta os anexos que tem", () => {
    const projetado = projetarOcorrenciaDetalhe(umaOcorrenciaLidaCom([ANEXO_LIDO]), QUEM_LE);
    expect(projetado.quantidadeDeAnexos).toBe(1);
    expect(projetado.anexos).toHaveLength(1);
  });

  it("o resumo devolve a contagem que o repositório apurou", () => {
    expect(
      projetarOcorrenciaResumo({ ...RESUMO_LIDO, quantidadeDeAnexos: 1 }, "solicitante")
        .quantidadeDeAnexos,
    ).toBe(1);
  });

  it("sem anexo, o detalhe traz `[]` e `0` — nunca `null`", () => {
    const projetado = projetarOcorrenciaDetalhe(umaOcorrenciaLidaCom([]), QUEM_LE);
    expect(projetado.anexos).toStrictEqual([]);
    expect(projetado.quantidadeDeAnexos).toBe(0);
  });

  it("o DETALHE também emite avaliada, e ela é coerente com avaliacao — o allOf provado", () => {
    /**
     * **`OcorrenciaDetalhe` é `allOf: [OcorrenciaResumo, …]`** (`openapi.yaml:2890-2892`), então o campo
     * entra no detalhe junto, ao lado do `avaliacao` que já mora lá.
     *
     * **Isso não é redundância acidental: é a relação `quantidadeDeAnexos` ↔ `anexos`**, que o detalhe
     * carrega as duas desde o item 13b — *"a contagem é o comprimento da lista"*. Aqui o booleano é
     * `avaliacao !== null`, e **provar a coerência é o que impede as duas de divergirem em silêncio.**
     */
    const semAvaliacao = projetarOcorrenciaDetalhe(umaOcorrenciaLidaCom([]), QUEM_LE);
    expect(semAvaliacao.avaliada).toBe(false);
    expect(semAvaliacao.avaliacao).toBeNull();

    const comAvaliacao = projetarOcorrenciaDetalhe(
      {
        ...umaOcorrenciaLidaCom([]),
        status: "resolvida",
        avaliacao: { nota: 5, comentario: null, avaliadaEm: "2026-08-29T10:00:00.000Z" },
      },
      QUEM_LE,
    );
    expect(comAvaliacao.avaliada).toBe(true);
    expect(comAvaliacao.avaliacao?.nota).toBe(5);
  });
});

describe("acoesDisponiveis conhece o responsável — a invariante 9 na projeção", () => {
  /** Um Gestor com as permissões dos três comandos construídos. */
  const GESTOR_LE = {
    pessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f",
    permissoes: ["ocorrencia.ler_todas", "ocorrencia.atribuir", "ocorrencia.iniciar_atendimento"],
  };

  const RESPONSAVEL = { pessoaId: "3d7c1e92-8a4b-4f5c-9d6e-1a2b3c4d5e6f", nome: "Zelador" };

  function emAnaliseCom(responsavel: { pessoaId: string; nome: string } | null) {
    return { ...umaOcorrenciaLidaCom([]), status: "em_analise" as const, responsavel };
  }

  it("sem responsável, iniciar-atendimento NÃO é anunciado — critério 22.3", () => {
    // A projeção não pergunta a `atribuicoes`: ela lê `responsavel`, que o `lateral` do item 19 preenche.
    expect(projetarOcorrenciaDetalhe(emAnaliseCom(null), GESTOR_LE).acoesDisponiveis).not.toContain(
      "iniciar-atendimento",
    );
  });

  it("com responsável, ele é anunciado — e o campo do payload continua sendo o mesmo", () => {
    const projetado = projetarOcorrenciaDetalhe(emAnaliseCom(RESPONSAVEL), GESTOR_LE);
    expect(projetado.acoesDisponiveis).toContain("iniciar-atendimento");
    expect(projetado.responsavel).toStrictEqual(RESPONSAVEL);
  });

  it("em resolvida a projeção devolve lista VAZIA — o critério 26.4, e é derivação", () => {
    // **Nem para o Gestor com todas as permissões.** `TRANSICOES.resolvida` é vazia; `avaliar` é o único
    // admitido ali e está fora de `COMANDOS_IMPLEMENTADOS` até o item 27.
    const projetado = projetarOcorrenciaDetalhe(
      { ...umaOcorrenciaLidaCom([]), status: "resolvida" as const, responsavel: RESPONSAVEL },
      { ...GESTOR_LE, permissoes: [...GESTOR_LE.permissoes, "ocorrencia.resolver"] },
    );

    expect(projetado.acoesDisponiveis).toStrictEqual([]);
  });

  it.each(["em_atendimento", "pausada"] as const)(
    "em %s a projeção anuncia registrar-solucao-aplicada — o critério 25.1 no payload",
    (status) => {
      // **É a §8.5 lida ao contrário:** comando presente é comando cujo endpoint existe. É o que faz T-05
      // desenhar o campo sem precisar de uma segunda regra sobre estados.
      const projetado = projetarOcorrenciaDetalhe(
        { ...umaOcorrenciaLidaCom([]), status, responsavel: RESPONSAVEL },
        { ...GESTOR_LE, permissoes: [...GESTOR_LE.permissoes, "ocorrencia.registrar_solucao"] },
      );

      expect(projetado.acoesDisponiveis).toContain("registrar-solucao-aplicada");
    },
  );

  it("em aberta a projeção NÃO o anuncia — solução aplicada descreve trabalho feito", () => {
    const projetado = projetarOcorrenciaDetalhe(
      { ...umaOcorrenciaLidaCom([]), responsavel: RESPONSAVEL },
      { ...GESTOR_LE, permissoes: [...GESTOR_LE.permissoes, "ocorrencia.registrar_solucao"] },
    );

    expect(projetado.acoesDisponiveis).not.toContain("registrar-solucao-aplicada");
  });

  it.each(["aberta", "em_analise", "em_atendimento", "pausada"] as const)(
    "em %s a projeção anuncia alterar-prioridade — o critério 17.1 no payload",
    (status) => {
      const projetado = projetarOcorrenciaDetalhe(
        { ...umaOcorrenciaLidaCom([]), status, responsavel: RESPONSAVEL },
        { ...GESTOR_LE, permissoes: [...GESTOR_LE.permissoes, "ocorrencia.alterar_prioridade"] },
      );

      expect(projetado.acoesDisponiveis).toContain("alterar-prioridade");
    },
  );

  it.each(["resolvida", "cancelada"] as const)(
    "em %s a projeção NÃO o anuncia — a invariante 7, e é a segunda metade do critério 17.2",
    (status) => {
      // **É o que faz T-05 mostrar TEXTO em vez de seletor**, sem uma segunda regra sobre estados: a tela
      // pergunta a `acoesDisponiveis`, e a resposta já carrega a D6.
      const projetado = projetarOcorrenciaDetalhe(
        { ...umaOcorrenciaLidaCom([]), status, responsavel: RESPONSAVEL },
        { ...GESTOR_LE, permissoes: [...GESTOR_LE.permissoes, "ocorrencia.alterar_prioridade"] },
      );

      expect(projetado.acoesDisponiveis).not.toContain("alterar-prioridade");
    },
  );
});

describe("`?variante=`", () => {
  const url = (consulta: string) => new Request(`http://local/api/x${consulta}`);

  it("ausente é o objeto principal", () => {
    expect(lerVarianteDaUrl(url(""))).toBe("original");
  });

  it("`miniatura` é a prévia", () => {
    expect(lerVarianteDaUrl(url("?variante=miniatura"))).toBe("miniatura");
  });

  it("valor fora da lista é 400, e NÃO o objeto principal em silêncio", () => {
    // A mesma doutrina de `?ativa=` e `?situacao=`: o cliente pedindo uma coisa e recebendo outra é o
    // que a recusa existe para impedir.
    expect(() => lerVarianteDaUrl(url("?variante=xpto"))).toThrow(FormatoInvalido);
  });
});

/**
 *  Os quatro parâmetros de `GET /ocorrencias` — o item 15
 * ============================================================================
 *
 * **O que este bloco prova é a REGRA, não o `400`.** O de-para de `FormatoInvalido` para resposta HTTP já
 * existe e já é exercido; aqui se prova quais valores a URL aceita, quais recusa **em voz alta**, e que
 * "ausente" e "vazio" são a mesma coisa.
 */
const CATEGORIA = "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d";
const OUTRA_CATEGORIA = "6b1c8f2e-2222-4a2b-8c3d-4e5f6a7b8c9d";

const ler = (consulta: string) => lerFiltroDeOcorrenciasDaUrl(new URLSearchParams(consulta));

describe("o critério 15.1 — a leitura dos quatro filtros", () => {
  it("sem parâmetro nenhum, o filtro é vazio", () => {
    expect(ler("")).toStrictEqual({});
  });

  it("lista separada por vírgula vira lista de valores", () => {
    expect(ler("status=aberta,em_analise")).toStrictEqual({ status: ["aberta", "em_analise"] });
  });

  it("espaço em volta da vírgula não é valor", () => {
    expect(ler("prioridade=alta, baixa")).toStrictEqual({ prioridade: ["alta", "baixa"] });
  });

  it("as três dimensões combinam entre si, e o autor com elas", () => {
    expect(
      ler(`status=pausada&categoriaId=${CATEGORIA},${OUTRA_CATEGORIA}&prioridade=alta&autor=eu`),
    ).toStrictEqual({
      status: ["pausada"],
      categoriaId: [CATEGORIA, OUTRA_CATEGORIA],
      prioridade: ["alta"],
      apenasDoAutor: true,
    });
  });

  it("parâmetro presente e vazio é ausente, não erro", () => {
    expect(ler("status=&categoriaId=&prioridade=&autor=")).toStrictEqual({});
  });
});

describe("o critério 15.1 — o que a URL recusa em voz alta", () => {
  it.each([
    ["status=arquivada", "status"],
    ["status=aberta,arquivada", "status"],
    ["prioridade=urgentissima", "prioridade"],
    ["autor=todos", "autor"],
    ["categoriaId=nao-e-uuid", "categoriaId"],
    [`categoriaId=${CATEGORIA},nao-e-uuid`, "categoriaId"],
  ])("%s é recusado, e o erro nomeia o campo", (consulta, campo) => {
    try {
      ler(consulta);
      expect.unreachable("devia ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(FormatoInvalido);
      // **`extensoes.erros`, e não `erros`.** `FormatoInvalido` passa a lista para o quarto argumento de
      // `ErroDeDominio`, que é `extensoes` — é de lá que `problema.ts` monta o `erros[]` do corpo.
      const erros = (erro as FormatoInvalido).extensoes.erros as readonly ErroDeCampo[];
      expect(erros[0]).toMatchObject({ campo, codigo: "VALOR_INVALIDO" });
    }
  });

  it("parâmetro repetido é recusado — o contrato descreve UMA gramática", () => {
    expect(() => ler("status=aberta&status=pausada")).toThrow(FormatoInvalido);
  });
});

/**
 * ============================================================================
 *  Os três recortes novos e a ordem — os critérios 67.1, 67.4 e 67.5
 * ============================================================================
 */
const AREA = "7c2d9a3f-1111-4b3c-9d4e-5f6a7b8c9d0e";
const OUTRA_AREA = "7c2d9a3f-2222-4b3c-9d4e-5f6a7b8c9d0e";
const PESSOA = "8d3e0b40-1111-4c4d-ae5f-6a7b8c9d0e1f";

describe("os critérios 67.1 e 67.4 — título, área e responsável na URL", () => {
  it("os três entram, e combinam com os quatro de hoje", () => {
    expect(
      ler(
        `status=aberta&categoriaId=${CATEGORIA}&prioridade=alta&autor=eu` +
          `&titulo=vazamento&areaId=${AREA},${OUTRA_AREA}&responsavelPessoaId=${PESSOA}`,
      ),
    ).toStrictEqual({
      status: ["aberta"],
      categoriaId: [CATEGORIA],
      prioridade: ["alta"],
      apenasDoAutor: true,
      titulo: "vazamento",
      areaId: [AREA, OUTRA_AREA],
      responsavelPessoaId: [PESSOA],
    });
  });

  it("o título vem aparado, e só espaço é o mesmo que ausente", () => {
    expect(ler("titulo=%20%20vaz%20gar%20%20")).toStrictEqual({ titulo: "vaz gar" });
    expect(ler("titulo=%20%20%20")).toStrictEqual({});
    expect(ler("titulo=")).toStrictEqual({});
  });

  it("título de 120 caracteres passa, e o de 121 é recusado", () => {
    expect(ler(`titulo=${"a".repeat(120)}`)).toStrictEqual({ titulo: "a".repeat(120) });
    expect(() => ler(`titulo=${"a".repeat(121)}`)).toThrow(FormatoInvalido);
  });

  it.each([
    ["areaId=nao-e-uuid", "areaId"],
    [`areaId=${AREA},nao-e-uuid`, "areaId"],
    ["responsavelPessoaId=nao-e-uuid", "responsavelPessoaId"],
    [`titulo=${"a".repeat(121)}`, "titulo"],
  ])("%s é recusado, e o erro nomeia o campo", (consulta, campo) => {
    try {
      ler(consulta);
      expect.unreachable("devia ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(FormatoInvalido);
      const erros = (erro as FormatoInvalido).extensoes.erros as readonly ErroDeCampo[];
      expect(erros[0]).toMatchObject({ campo, codigo: "VALOR_INVALIDO" });
    }
  });

  it.each([
    ["status=aberta"],
    [`categoriaId=${CATEGORIA}`],
    ["prioridade=alta"],
    ["autor=eu"],
    ["titulo=vaz"],
    [`areaId=${AREA}`],
    [`responsavelPessoaId=${PESSOA}`],
  ])("%s conta como filtro aplicado", (consulta) => {
    expect(algumFiltroAplicado(ler(consulta))).toBe(true);
  });

  it("sem parâmetro nenhum, nenhum filtro está aplicado", () => {
    expect(algumFiltroAplicado(ler(""))).toBe(false);
  });

  /**
   * **A ordem não é filtro, e o teste existe porque a consequência é visível:** se ela contasse, o
   * terceiro vazio diria *"Nenhuma ocorrência com estes filtros."* para quem só trocou a coluna, e
   * *"Limpar filtros"* prometeria desfazer algo que não desfaz.
   */
  it("ordem e sentido não contam como filtro", () => {
    expect(algumFiltroAplicado(ler("ordem=titulo&sentido=decrescente"))).toBe(false);
  });
});

const lerOrdem = (consulta: string) =>
  lerOrdenacaoDeOcorrenciasDaUrl(new URLSearchParams(consulta));

describe("a ordenação de GET /ocorrencias — critério 67.5", () => {
  it.each([
    ["status"],
    ["titulo"],
    ["area"],
    ["prioridade"],
    ["responsavel"],
  ])("ordem=%s sem sentido é crescente", (ordem) => {
    expect(lerOrdem(`ordem=${ordem}`)).toStrictEqual({ ordem, sentido: "crescente" });
  });

  it("sentido=decrescente vale para qualquer coluna que não seja a do padrão", () => {
    expect(lerOrdem("ordem=titulo&sentido=decrescente")).toStrictEqual({
      ordem: "titulo",
      sentido: "decrescente",
    });
  });

  it("ordem=atualizacao sem sentido é a mais parada primeiro", () => {
    expect(lerOrdem("ordem=atualizacao")).toStrictEqual({
      ordem: "atualizacao",
      sentido: "crescente",
    });
  });

  /**
   * **Um estado, um endereço.** `ordem=atualizacao&sentido=decrescente` é o padrão escrito por extenso, e
   * volta como ausente: dois endereços para o mesmo resultado obrigariam a tela a escolher qual deles
   * desenha a seta.
   */
  it("o padrão escrito por extenso volta como ausente", () => {
    expect(lerOrdem("ordem=atualizacao&sentido=decrescente")).toBeUndefined();
  });

  it("sem ordem, não há ordenação — e o sentido sozinho é ignorado", () => {
    expect(lerOrdem("")).toBeUndefined();
    expect(lerOrdem("sentido=decrescente")).toBeUndefined();
    expect(lerOrdem("sentido=xpto")).toBeUndefined();
  });

  it.each([
    ["ordem=registro", "ordem"],
    ["ordem=titulo&sentido=crescente", "sentido"],
    ["ordem=titulo&sentido=asc", "sentido"],
  ])("%s é recusado, e o erro nomeia o campo", (consulta, campo) => {
    try {
      lerOrdem(consulta);
      expect.unreachable("devia ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(FormatoInvalido);
      const erros = (erro as FormatoInvalido).extensoes.erros as readonly ErroDeCampo[];
      expect(erros[0]).toMatchObject({ campo, codigo: "VALOR_INVALIDO" });
    }
  });

  it("ordem repetida é recusada, como todo parâmetro deste endpoint", () => {
    expect(() => lerOrdem("ordem=titulo&ordem=status")).toThrow(FormatoInvalido);
  });
});

/**
 * ============================================================================
 *  A ordenação de T-03 — critério 67.5
 * ============================================================================
 *
 * **O que este bloco prova é o que a lista acrescenta ao ciclo do 68a**: que o padrão aparece marcado em
 * Tempo, que Tempo tem ciclo de dois passos, e que as outras colunas voltam ao padrão no terceiro clique.
 * O ciclo em si tem teste próprio, no arquivo de vínculo.
 */
const ordenacaoDe = (consulta: string) => lerOrdenacaoDaLista(new URLSearchParams(consulta));

describe("a ordenação de T-03 — critério 67.5", () => {
  /**
   * **As duas listas são a mesma, e o teste é o que as prende.** A da tela é copiada da Aplicação de
   * propósito — importá-la arrastaria a camada para o pacote do navegador —, e sem este caso a cópia
   * envelheceria em silêncio: a tela ofereceria uma coluna que o endpoint recusa com `400`.
   */
  it("as colunas da tela são as mesmas da Aplicação", () => {
    expect([...COLUNAS_DA_LISTA]).toStrictEqual([...COLUNAS_DE_ORDENACAO]);
  });

  it("sem nada na URL, Tempo está ordenada para baixo e as outras não estão ordenadas", () => {
    const atual = ordenacaoDe("");

    expect(atual).toStrictEqual(SEM_ORDENACAO);
    expect(ariaSortNaLista(atual, "atualizacao")).toBe("descending");
    for (const coluna of ["status", "titulo", "area", "prioridade", "responsavel"] as const) {
      expect(ariaSortNaLista(atual, coluna)).toBe("none");
    }
  });

  it("o padrão escrito por extenso na URL é lido como o padrão", () => {
    expect(ordenacaoDe("ordem=atualizacao&sentido=decrescente")).toStrictEqual(SEM_ORDENACAO);
  });

  /** **Dois passos, e não três.** Do padrão, um clique inverte; o segundo devolve o padrão. */
  it("em Tempo o ciclo é de dois passos", () => {
    const doPadrao = proximaNaLista(SEM_ORDENACAO, "atualizacao");
    expect(doPadrao).toStrictEqual({ ordem: "atualizacao", sentido: "crescente" });
    expect(ariaSortNaLista(doPadrao, "atualizacao")).toBe("ascending");

    expect(proximaNaLista(doPadrao, "atualizacao")).toStrictEqual(SEM_ORDENACAO);
  });

  it("nas outras colunas o terceiro clique devolve o padrão", () => {
    const um = proximaNaLista(SEM_ORDENACAO, "titulo");
    expect(um).toStrictEqual({ ordem: "titulo", sentido: "crescente" });

    const dois = proximaNaLista(um, "titulo");
    expect(dois).toStrictEqual({ ordem: "titulo", sentido: "decrescente" });

    expect(proximaNaLista(dois, "titulo")).toStrictEqual(SEM_ORDENACAO);
  });

  it("clicar em outra coluna começa nela, crescente, venha de onde vier", () => {
    const tituloDecrescente: Ordenacao<ColunaDaLista> = { ordem: "titulo", sentido: "decrescente" };

    expect(proximaNaLista(tituloDecrescente, "status")).toStrictEqual({
      ordem: "status",
      sentido: "crescente",
    });
    expect(proximaNaLista(tituloDecrescente, "atualizacao")).toStrictEqual({
      ordem: "atualizacao",
      sentido: "crescente",
    });
  });

  it("com outra coluna ordenando, Tempo não está ordenada e o clique começa nela", () => {
    const tituloCrescente: Ordenacao<ColunaDaLista> = { ordem: "titulo", sentido: "crescente" };

    expect(ariaSortNaLista(tituloCrescente, "atualizacao")).toBe("none");
    expect(rotuloNaLista(tituloCrescente, "atualizacao", "Tempo")).toBe("Ordenar por Tempo");
  });

  /**
   * **O nome acessível diz o que o próximo clique faz**, e em Tempo ele diz *inverter* nos dois estados
   * em que Tempo é a ordem. *"Tirar a ordenação"* seria falso ali: não há como tirar o padrão.
   */
  it("o nome acessível de Tempo diz inverter nos dois estados em que ele ordena", () => {
    expect(rotuloNaLista(SEM_ORDENACAO, "atualizacao", "Tempo")).toBe("Inverter a ordem de Tempo");
    expect(
      rotuloNaLista({ ordem: "atualizacao", sentido: "crescente" }, "atualizacao", "Tempo"),
    ).toBe("Inverter a ordem de Tempo");
  });

  it("o nome acessível de Título percorre os três", () => {
    expect(rotuloNaLista(SEM_ORDENACAO, "titulo", "Título")).toBe("Ordenar por Título");
    expect(rotuloNaLista({ ordem: "titulo", sentido: "crescente" }, "titulo", "Título")).toBe(
      "Inverter a ordem de Título",
    );
    expect(rotuloNaLista({ ordem: "titulo", sentido: "decrescente" }, "titulo", "Título")).toBe(
      "Tirar a ordenação de Título",
    );
  });

  it("a URL da ordem mantém os filtros e descarta a paginação", () => {
    const consulta = consultaComOrdenacao(
      "status=aberta&titulo=vaz&pagina=3&ate=2026-09-01T00%3A00%3A00.000Z&totalNoCorte=40&ordem=titulo&sentido=decrescente",
      { ordem: "status", sentido: "crescente" },
    );

    expect(consulta.get("status")).toBe("aberta");
    expect(consulta.get("titulo")).toBe("vaz");
    expect(consulta.get("pagina")).toBeNull();
    expect(consulta.get("ate")).toBeNull();
    expect(consulta.get("totalNoCorte")).toBeNull();
    expect(consulta.get("ordem")).toBe("status");
    expect(consulta.get("sentido")).toBeNull();
  });

  it("voltar ao padrão apaga ordem e sentido da URL", () => {
    const consulta = consultaComOrdenacao("status=aberta&ordem=titulo&sentido=decrescente", SEM_ORDENACAO);

    expect(consulta.get("ordem")).toBeNull();
    expect(consulta.get("sentido")).toBeNull();
    expect(consulta.get("status")).toBe("aberta");
  });

  /**
   * **A ida e volta entre a tela e o endpoint.** O que a tabela escreve na URL é o que
   * `lerOrdenacaoDeOcorrenciasDaUrl` lê do outro lado — se as duas divergissem, clicar numa coluna daria
   * `400` na própria tela.
   */
  it.each([...COLUNAS_DA_LISTA])("o que a tela escreve para %s, o endpoint lê", (coluna) => {
    for (const sentido of ["crescente", "decrescente"] as const) {
      const consulta = consultaComOrdenacao("", { ordem: coluna, sentido });
      const doEndpoint = lerOrdenacaoDeOcorrenciasDaUrl(consulta);

      const esperado = coluna === "atualizacao" && sentido === "decrescente" ? undefined : { ordem: coluna, sentido };
      expect(doEndpoint).toStrictEqual(esperado);
    }
  });
});

/**
 * ============================================================================
 *  Os puros da barra de T-03 — critérios 67.1 e 67.4
 * ============================================================================
 */
describe("os puros da barra — o que Limpar filtros limpa, e o que ele mantém", () => {
  it("semFiltros apaga os sete recortes e a paginação, e MANTÉM a ordem", () => {
    const consulta = semFiltros(
      "status=aberta&categoriaId=c-1&prioridade=alta&autor=eu&titulo=vaz&areaId=a-1" +
        "&responsavelPessoaId=p-1&pagina=3&ate=2026-09-01T00%3A00%3A00.000Z&totalNoCorte=40" +
        "&ordem=titulo&sentido=decrescente",
    );

    for (const parametro of PARAMETROS_DE_FILTRO) expect(consulta.get(parametro)).toBeNull();
    for (const parametro of ["pagina", "ate", "totalNoCorte"]) {
      expect(consulta.get(parametro)).toBeNull();
    }
    expect(consulta.get("ordem")).toBe("titulo");
    expect(consulta.get("sentido")).toBe("decrescente");
  });

  /**
   * **A lista da tela e a do servidor têm de concordar.** `PARAMETROS_DE_FILTRO` decide o que *Limpar
   * filtros* apaga; `algumFiltroAplicado` decide se o botão aparece e qual frase o vazio mostra. Um
   * parâmetro em só uma das duas produziria um botão que não limpa o que promete — ou um recorte ligado
   * sem botão para desligá-lo.
   */
  it.each([
    ["status", "aberta"],
    ["categoriaId", CATEGORIA],
    ["prioridade", "alta"],
    ["autor", "eu"],
    ["titulo", "vaz"],
    ["areaId", AREA],
    ["responsavelPessoaId", PESSOA],
  ])("%s está nos dois lados: liga o filtro e é apagado por Limpar", (parametro, valor) => {
    expect([...PARAMETROS_DE_FILTRO]).toContain(parametro);
    expect(algumFiltroAplicado(ler(`${parametro}=${valor}`))).toBe(true);
    expect(semFiltros(`${parametro}=${valor}`).get(parametro)).toBeNull();
  });

  it("comValorUnico troca o valor, apaga com null, e descarta a paginação", () => {
    expect(comValorUnico("areaId=a-1&pagina=2", "areaId", "a-2").toString()).toBe("areaId=a-2");
    expect(comValorUnico("areaId=a-1&status=aberta", "areaId", null).toString()).toBe("status=aberta");
  });

  it("comTitulo apara, e texto em branco apaga o parâmetro", () => {
    expect(comTitulo("", "  vaz gar  ").get("titulo")).toBe("vaz gar");
    expect(comTitulo("titulo=vaz", "   ").get("titulo")).toBeNull();
    expect(comTitulo("titulo=vaz&pagina=4", "luz").toString()).toBe("titulo=luz");
  });

  it("antes de digitar, as dez primeiras por nome — e a ordem é a de pt-BR", () => {
    const opcoes: OpcaoComBusca[] = [
      { valor: "z", rotulo: "Zeladoria" },
      { valor: "a", rotulo: "Área de lazer" },
      { valor: "g", rotulo: "Garagem" },
    ];

    expect(primeirasOpcoes(opcoes, 2).map((uma) => uma.rotulo)).toStrictEqual([
      "Área de lazer",
      "Garagem",
    ]);
  });

  /** Sem valor, o nome; com um, o nome do valor; com mais de um, a contagem. Nunca só cor. */
  it("o rótulo do gatilho carrega a palavra", () => {
    const opcoes: OpcaoComBusca[] = [{ valor: "g", rotulo: "Garagem" }];

    expect(rotuloDoGatilho("Área", opcoes, [])).toBe("Área");
    expect(rotuloDoGatilho("Área", opcoes, ["g"])).toBe("Área: Garagem");
    expect(rotuloDoGatilho("Área", opcoes, ["g", "h"])).toBe("Área: 2 selecionados");
  });

  /** Valor fora da lista — área desativada que veio por link — conta, e não inventa nome. */
  it("valor que não está na lista conta em vez de inventar nome", () => {
    expect(rotuloDoGatilho("Área", [], ["a-1"])).toBe("Área: 1 selecionado");
  });
});

/**
 * ============================================================================
 *  As opções dos dois campos com busca — critério 67.2
 * ============================================================================
 *
 * **A entrada vem das leituras escopadas** — `repos.areas` e `repos.vinculos`, que a página passa —, e é
 * a suíte de isolamento que prova que elas não atravessam organização. O que estes casos provam é o outro
 * lado: **o que desce ao navegador**.
 */
describe("as opções dos campos com busca — critério 67.2", () => {
  it("a área traz o tipo em palavra, pela frase que T-04 já usa", () => {
    expect(
      opcoesDeArea(
        [
          { id: "a-1", nome: "Garagem", tipo: "comum" },
          { id: "a-2", nome: "Apartamento 302", tipo: "privativa" },
        ],
        rotuloDoTipoDeArea,
      ),
    ).toStrictEqual([
      { valor: "a-1", rotulo: "Garagem", complemento: "área comum" },
      { valor: "a-2", rotulo: "Apartamento 302", complemento: "unidade privativa" },
    ]);
  });

  /**
   * **`contatos[]` não desce, e o caso é a garantia.** É dado pessoal sob o RNF10, e é a razão de
   * `GET /vinculos` exigir `vinculo.gerir`: um filtro de responsável que carregasse telefone e e-mail no
   * pacote do navegador publicaria a lista de contatos da organização inteira em cada carga de T-03.
   */
  it("o responsável desce com duas chaves e nada mais — sem contato, sem papel", () => {
    // Um `VinculoLido` inteiro, com contato preenchido — é o que a leitura escopada devolve.
    const lidos = [
      {
        pessoa: {
          pessoaId: "p-1",
          nome: "Marcos Ribeiro",
          contatos: [{ tipo: "telefone", valor: "11999990000" }],
        },
        papel: "encarregado",
        area: { id: "a-1", nome: "Garagem", tipo: "comum" },
      },
    ];
    const opcoes = opcoesDeResponsavel(lidos);

    expect(opcoes).toStrictEqual([{ valor: "p-1", rotulo: "Marcos Ribeiro" }]);
    expect(Object.keys(opcoes[0] ?? {})).toStrictEqual(["valor", "rotulo"]);
  });
});

describe("a lente de rótulo — o critério 31.2, e ela segue PERMISSÃO", () => {
  it("quem tem ocorrencia.ler_todas lê pela coluna do Gestor", () => {
    expect(lenteDeRotulo(["ocorrencia.ler_todas"])).toBe("gestor");
  });

  it("quem NÃO a tem lê pela coluna do Solicitante — inclusive com todas as outras dele", () => {
    expect(lenteDeRotulo([])).toBe("solicitante");
    expect(
      lenteDeRotulo([
        "ocorrencia.registrar",
        "ocorrencia.ler_propria",
        "ocorrencia.comentar",
        "ocorrencia.cancelar_propria",
        "ocorrencia.avaliar",
      ]),
    ).toBe("solicitante");
  });

  /**
   * **O Encarregado é o achado A-5 da spec, virado caso.** O `glossario.md:114` lhe dá a coluna do
   * Gestor — *"porque operam a máquina"* —, e `Permissao.ts:70-74` lhe dá `[]`. Nenhum predicado de
   * permissão pode colocá-lo lá, e `arquitetura.md:479` proíbe checar `vinculo.papel`.
   *
   * **A população é vazia hoje** — ele leva `403` em todo endpoint de ocorrência —, então não há defeito
   * observável. O caso existe para que o dia em que ele ganhar permissões seja uma decisão, e não uma
   * descoberta.
   */
  it("o Encarregado, com lista vazia, cai na coluna do Solicitante — achado A-5, declarado", () => {
    expect(lenteDeRotulo([])).toBe("solicitante");
  });

  /**
   * **É `ler_todas` e mais nenhuma.** O produto já usa esse predicado como *"a lente do Gestor"* em três
   * lugares independentes — `visibilidadeAplicada`, `podeLerTodas` nas funções de aplicação, e a barra de
   * filtros. Escolher uma quarta criaria um segundo desenho de *quem é Gestor* (spec §3.1).
   */
  it("nenhuma outra permissão do Gestor liga a lente sozinha", () => {
    for (const permissao of [
      "ocorrencia.analisar",
      "ocorrencia.resolver",
      "ocorrencia.pausar",
      "ocorrencia.atribuir",
      "dashboard.ler",
      "vinculo.gerir",
      "organizacao.configurar",
    ]) {
      expect(lenteDeRotulo([permissao])).toBe("solicitante");
    }
  });
});

/**
 * ============================================================================
 *  O critério 31.2 — a tabela do `glossario.md:114-124`, linha a linha
 * ============================================================================
 *
 * **É uma tabela e não seis casos**, e a razão é a mesma de `ACAO_PRIMARIA`: assim o teste falha quando
 * um status **novo** nascer sem rótulo em uma das colunas, que é o modo pelo qual esta garantia se perde.
 */
describe("o critério 31.2 — as duas colunas do glossário, para os seis status", () => {
  const GLOSSARIO: Readonly<Record<StatusOcorrencia, { solicitante: string; gestor: string }>> = {
    aberta: { solicitante: "Recebida — aguardando análise", gestor: "Aberta" },
    em_analise: { solicitante: "Em análise", gestor: "Em análise" },
    em_atendimento: { solicitante: "Em execução", gestor: "Em atendimento" },
    pausada: { solicitante: "Parada", gestor: "Pausada" },
    resolvida: { solicitante: "Resolvida", gestor: "Resolvida" },
    cancelada: { solicitante: "Cancelada", gestor: "Cancelada" },
  };

  it.each(STATUS)("%s tem as duas colunas, e elas são as do glossário", (status) => {
    expect(rotuloDeStatus(status, null, "solicitante")).toBe(GLOSSARIO[status].solicitante);
    expect(rotuloDeStatus(status, null, "gestor")).toBe(GLOSSARIO[status].gestor);
  });

  it("a MESMA ocorrência em em_atendimento é 'Em execução' e 'Em atendimento' — a frase do critério", () => {
    expect(rotuloDeStatus("em_atendimento", null, "solicitante")).toBe("Em execução");
    expect(rotuloDeStatus("em_atendimento", null, "gestor")).toBe("Em atendimento");
  });

  /**
   * **A colapsagem, e é ela que faz o 31.6 acontecer.** Do lado do Solicitante `pausada` tem quatro
   * rótulos, um por motivo; do lado do Gestor tem **um**, e o motivo viaja no campo `motivoPausa` —
   * `glossario.md:137-139`: *"como campo próprio ao lado do rótulo, não embutido nele"*.
   */
  it.each(MOTIVOS_DE_PAUSA)(
    "em pausada · %s, o Solicitante lê o motivo e o Gestor lê 'Pausada' seca",
    (motivo) => {
      expect(rotuloDeStatus("pausada", motivo, "solicitante")).toBe(rotuloDeMotivoPausa(motivo));
      expect(rotuloDeStatus("pausada", motivo, "gestor")).toBe("Pausada");
    },
  );

  it("o resumo lê pela lente que recebeu, e o motivo continua no payload nas duas", () => {
    const pausada = {
      ...RESUMO_LIDO,
      status: "pausada" as const,
      motivoPausa: "aguardando_peca" as const,
    };

    expect(projetarOcorrenciaResumo(pausada, "solicitante").statusRotulo).toBe(
      "Parada — esperando material chegar",
    );
    expect(projetarOcorrenciaResumo(pausada, "gestor").statusRotulo).toBe("Pausada");
    // **O motivo continua no payload nas DUAS lentes** — é ele que carrega a diferença que o rótulo do
    // Gestor colapsa (`openapi.yaml:2845-2851`), e é o que faz a segunda linha de T-03 ser possível.
    expect(projetarOcorrenciaResumo(pausada, "gestor").motivoPausa).toBe("aguardando_peca");
    expect(projetarOcorrenciaResumo(pausada, "solicitante").motivoPausa).toBe("aguardando_peca");
  });

  /**
   * **O detalhe DERIVA a lente, e é a assimetria deliberada da §3.4 da spec:** onde `QuemLe` já chega, um
   * terceiro argumento que é função pura do segundo convidaria os dois a discordarem — e são onze rotas
   * de comando em que isso poderia acontecer. **É por isso que nenhuma delas muda de assinatura.**
   */
  it("projetarOcorrenciaDetalhe deriva a lente de quemLe.permissoes — as onze rotas não mudam", () => {
    const pausada = {
      ...umaOcorrenciaLidaCom([]),
      status: "pausada" as const,
      motivoPausa: "aguardando_peca" as const,
    };

    expect(projetarOcorrenciaDetalhe(pausada, QUEM_LE).statusRotulo).toBe(
      "Parada — esperando material chegar",
    );
    expect(
      projetarOcorrenciaDetalhe(pausada, {
        pessoaId: QUEM_LE.pessoaId,
        permissoes: ["ocorrencia.ler_todas"],
      }).statusRotulo,
    ).toBe("Pausada");
  });
});

/**
 * ============================================================================
 *  Os quatro critérios de OBSERVAÇÃO do item 31 — 31.1, 31.3, 31.4 e 31.5
 * ============================================================================
 *
 * **Os quatro já eram verdade antes deste item, e é isso que os torna necessários.** Eles são regras que
 * valem *"para qualquer rótulo novo"* (`glossario.md:126`): o que o item entrega é transformá-los em
 * teste, e é assim que o dia em que alguém escrever *"Resolvida — conte como foi"* ou *"o síndico está
 * avaliando"* deixa de passar em silêncio.
 *
 * **Percorrem as TABELAS INTEIRAS, e não um valor cada.** É a única forma de o teste falhar quando um
 * status **novo** nascer sem rótulo — a mesma disciplina de `ACAO_PRIMARIA`.
 */
describe("os critérios de observação do item 31 — as regras do glossário §4, viradas rede", () => {
  /** Toda string que este produto pode mostrar como rótulo de status ou de espera. */
  function todosOsRotulos(): readonly string[] {
    const rotulos: string[] = [];
    for (const status of STATUS) {
      rotulos.push(rotuloDeStatus(status, null, "solicitante"));
      rotulos.push(rotuloDeStatus(status, null, "gestor"));
      rotulos.push(nomeDoStatus(status));
    }
    for (const motivo of MOTIVOS_DE_PAUSA) {
      rotulos.push(rotuloDeStatus("pausada", motivo, "solicitante"));
      rotulos.push(rotuloDeStatus("pausada", motivo, "gestor"));
      rotulos.push(rotuloDeMotivoPausa(motivo));
    }
    return rotulos;
  }

  /**
   * **31.5 — e a razão é a D3, não polidez.** A D19 nasceu de uma entrevista com um síndico, e a redação
   * original dizia *"o síndico está avaliando"*. Isso trava o produto em condomínio, enquanto a **D3**
   * admite empresa e bairro como Organização — e o multi-tenant é a adição `NOSSO` mais cara do projeto
   * para ser desmentida por uma palavra de interface.
   */
  it("nenhum rótulo contém a palavra 'síndico', em nenhuma caixa — critério 31.5", () => {
    for (const rotulo of todosOsRotulos()) {
      expect(rotulo.toLowerCase()).not.toContain("síndico");
      expect(rotulo.toLowerCase()).not.toContain("sindico");
    }
  });

  it("nenhum rótulo trava o produto numa das três formas de Organização — regra 1 do glossário", () => {
    for (const rotulo of todosOsRotulos()) {
      const minusculo = rotulo.toLowerCase();
      expect(minusculo).not.toContain("zelador");
      expect(minusculo).not.toContain("porteiro");
      expect(minusculo).not.toContain("condomínio");
    }
  });

  /**
   * **31.3 — quatro rótulos, não um molde.** *"Frase montada em tempo de execução produz «Parada,
   * esperando aguardando peça»"* (regra 2 do glossário). A forma literal disso é o identificador do enum
   * aparecendo dentro de um texto em português.
   */
  it("os quatro rótulos de pausa são DISTINTOS entre si — critério 31.3", () => {
    const rotulos = MOTIVOS_DE_PAUSA.map((motivo) =>
      rotuloDeStatus("pausada", motivo, "solicitante"),
    );
    expect(rotulos).toHaveLength(4);
    expect(new Set(rotulos).size).toBe(4);
  });

  it("nenhum rótulo interpola o identificador do enum numa frase — critério 31.3", () => {
    for (const rotulo of todosOsRotulos()) {
      expect(rotulo).not.toContain("_");
      // E nenhum rótulo É o valor cru do enum.
      expect(STATUS as readonly string[]).not.toContain(rotulo);
      expect(MOTIVOS_DE_PAUSA as readonly string[]).not.toContain(rotulo);
    }
  });

  /**
   * **31.4 — rótulo é estado, não convite.** *"Resolvida — conte como foi"* mistura o que a ocorrência é
   * com o que se pede de quem lê. **O convite pertence à tela** — é o `CONVITE_A_AVALIAR` do item 27, que
   * vive em `rotulos.ts` e é renderizado ao LADO do rótulo, nunca dentro dele.
   */
  it("resolvida é 'Resolvida' e nada mais, nas DUAS lentes — critério 31.4", () => {
    expect(rotuloDeStatus("resolvida", null, "solicitante")).toBe("Resolvida");
    expect(rotuloDeStatus("resolvida", null, "gestor")).toBe("Resolvida");
  });

  it("nenhum rótulo carrega convite — nem verbo no imperativo do 27.5", () => {
    for (const rotulo of todosOsRotulos()) {
      const minusculo = rotulo.toLowerCase();
      expect(minusculo).not.toContain("conte");
      expect(minusculo).not.toContain("avalie");
      expect(minusculo).not.toContain("clique");
    }
  });

  /**
   * **31.1 — nenhum cliente monta a frase.** As duas projeções que a tela consome emitem `statusRotulo`
   * como `string` **pronta**, e o que desce ao navegador é texto. É a versão executável do *"calculado no
   * servidor, nunca no cliente"* do `glossario.md:102`.
   */
  it("resumo e detalhe emitem statusRotulo como string pronta — critério 31.1", () => {
    const resumo = projetarOcorrenciaResumo(RESUMO_LIDO, "gestor");
    expect(typeof resumo.statusRotulo).toBe("string");
    expect(resumo.statusRotulo).toBe("Aberta");

    const detalhe = projetarOcorrenciaDetalhe(umaOcorrenciaLidaCom([]), {
      pessoaId: QUEM_LE.pessoaId,
      permissoes: ["ocorrencia.ler_todas"],
    });
    expect(typeof detalhe.statusRotulo).toBe("string");
    expect(detalhe.statusRotulo).toBe("Aberta");
  });
});

describe("o critério 15.5 — os nomes das opções de filtro", () => {
  it("os seis status têm nome, e nenhum é o enum cru", () => {
    for (const status of STATUS) {
      const nome = nomeDoStatus(status);
      expect(nome).not.toBe(status);
      expect(nome.length).toBeGreaterThan(0);
    }
  });

  it("pausada tem UM nome de opção, sem motivo — que é o que a coluna do Solicitante não tem", () => {
    expect(nomeDoStatus("pausada")).toBe("Pausada");
  });

  it("as três prioridades também", () => {
    expect(nomeDaPrioridade("baixa")).toBe("Baixa");
    expect(nomeDaPrioridade("normal")).toBe("Normal");
    expect(nomeDaPrioridade("alta")).toBe("Alta");
  });

  it("opcoesDePrioridade devolve os TRÊS pares, na ordem de PRIORIDADES e com a palavra", () => {
    // **A ordem é a do Domínio**, e ela é significativa no seletor: `baixa · normal · alta` é a escala,
    // e reordenar aqui produziria um controle que lê ao contrário do resto do produto.
    //
    // **A palavra sempre** — compromisso A-5. Marcador colorido sem texto é defeito, em qualquer tela.
    expect(opcoesDePrioridade()).toStrictEqual([
      { valor: "baixa", rotulo: "Baixa" },
      { valor: "normal", rotulo: "Normal" },
      { valor: "alta", rotulo: "Alta" },
    ]);
  });
});

describe("o critério 15.6 — a descrição do recorte, para o subtítulo do vazio", () => {
  /** Os três mapas de nome, como a página os monta (item 67). */
  const nomes = {
    categoria: (id: string) => (id === "c-1" ? "Iluminação" : undefined),
    area: (id: string) => (id === "a-1" ? "Garagem" : undefined),
    pessoa: (id: string) => (id === "p-1" ? "Marcos Ribeiro" : undefined),
  };

  it("sem filtro nenhum, não há o que descrever", () => {
    expect(descricaoDoRecorte({}, nomes)).toStrictEqual([]);
  });

  it("cada dimensão vira uma cláusula com o MESMO rótulo do chip", () => {
    expect(descricaoDoRecorte({ status: ["pausada"], prioridade: ["alta"] }, nomes)).toStrictEqual([
      "Status: Pausada",
      "Prioridade: Alta",
    ]);
  });

  it("dois valores na mesma dimensão viram uma cláusula só, com os dois", () => {
    expect(descricaoDoRecorte({ status: ["aberta", "em_analise"] }, nomes)).toStrictEqual([
      "Status: Aberta, Em análise",
    ]);
  });

  it("categoria desconhecida não vira texto inventado", () => {
    expect(descricaoDoRecorte({ categoriaId: ["c-9"] }, nomes)).toStrictEqual([
      "Categoria: 1 selecionado",
    ]);
  });

  it("só as minhas é uma cláusula como as outras", () => {
    expect(descricaoDoRecorte({ apenasDoAutor: true }, nomes)).toStrictEqual(["Só as minhas"]);
  });

  /** Os três do item 67, com os mesmos rótulos dos gatilhos da barra. */
  it("o título com aspas vem primeiro, e área e responsável depois das três de hoje", () => {
    expect(
      descricaoDoRecorte(
        {
          titulo: "vaz gar",
          status: ["aberta"],
          areaId: ["a-1"],
          responsavelPessoaId: ["p-1"],
        },
        nomes,
      ),
    ).toStrictEqual([
      'Título com "vaz gar"',
      "Status: Aberta",
      "Área: Garagem",
      "Responsável: Marcos Ribeiro",
    ]);
  });

  it("área e responsável desconhecidos contam, como a categoria", () => {
    expect(
      descricaoDoRecorte({ areaId: ["a-9"], responsavelPessoaId: ["p-8", "p-9"] }, nomes),
    ).toStrictEqual(["Área: 1 selecionado", "Responsável: 2 selecionados"]);
  });
});

/**
 * ============================================================================
 *  `corpoOpcional` — o critério 16.7, e por que ele é sobre BYTES
 * ============================================================================
 *
 * Cinco endpoints do `openapi.yaml` declaram `requestBody: required: false` — os quatro comandos de
 * avanço rotineiro e o `/recusar` do item 8 —, e até aqui todos respondiam `415` a quem não mandasse
 * corpo. O portão do DoD *"a especificação versionada corresponde ao código"* estava aberto.
 *
 * **"Corpo ausente" é ZERO BYTE, e não "sem `content-type`"**, e é isso que impede `corpoOpcional` de
 * virar máquina de descarte silencioso: um cliente que mande `{"observacao": "…"}` esquecendo o
 * cabeçalho teria a observação aceita e jogada fora sem resposta.
 */
describe("lerCorpoOpcional", () => {
  const URL_QUALQUER = "http://localhost/api/ocorrencias/x/analisar";

  it("requisição SEM corpo chega com zero byte, e vira objeto vazio", async () => {
    // A afirmação que o plano precisava provar: `Request` sem `body` devolve string vazia em `.text()`.
    const requisicao = new Request(URL_QUALQUER, { method: "POST" });
    expect(await requisicao.clone().text()).toBe("");

    expect(await lerCorpoOpcional(requisicao)).toStrictEqual({});
  });

  it("corpo PRESENTE com content-type que não é JSON continua 415 — nada é descartado em silêncio", async () => {
    const requisicao = new Request(URL_QUALQUER, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ observacao: "Vou ver o estoque." }),
    });

    await expect(lerCorpoOpcional(requisicao)).rejects.toBeInstanceOf(CorpoNaoSuportado);
  });

  it("corpo presente com JSON inválido continua 400 FORMATO_INVALIDO", async () => {
    const requisicao = new Request(URL_QUALQUER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    await expect(lerCorpoOpcional(requisicao)).rejects.toBeInstanceOf(FormatoInvalido);
  });

  it("corpo presente e válido chega inteiro", async () => {
    const requisicao = new Request(URL_QUALQUER, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ observacao: "Vou ver o estoque." }),
    });

    expect(await lerCorpoOpcional(requisicao)).toStrictEqual({ observacao: "Vou ver o estoque." });
  });
});

describe("o corpo dos comandos de avanço rotineiro", () => {
  it("aceita objeto vazio — o corpo inteiro é opcional (ComandoComObservacaoOpcional)", () => {
    const conferido = comandoComObservacaoSchema.safeParse({});
    expect(conferido.success).toBe(true);
  });

  it("aceita observação até 1000, e recusa acima — o limite é o do openapi.yaml", () => {
    expect(comandoComObservacaoSchema.safeParse({ observacao: "x".repeat(1000) }).success).toBe(true);
    expect(comandoComObservacaoSchema.safeParse({ observacao: "x".repeat(1001) }).success).toBe(false);
  });

  it("NÃO tem minLength — o contrato declara maxLength e mais nada", () => {
    // Um `.min(1)` aqui recusaria mais do que a especificação versionada declara, e é o portão do DoD
    // olhando na direção contrária: o código não pode ser mais estrito que o contrato.
    expect(comandoComObservacaoSchema.safeParse({ observacao: "" }).success).toBe(true);
  });

  it("campo que não é observacao é DESCARTADO — é o critério 24.2 no schema", () => {
    // **O cliente não escolhe o destino de `retomar`.** O corpo declara um campo só, e `z.object` sem
    // `.passthrough()` descarta o resto: mandar `statusDestino` não muda nada, e não vira `400` — o que
    // seria contar ao cliente que existe uma porta. O destino sai da trilha, dentro do agregado.
    const analisado = comandoComObservacaoSchema.parse({
      observacao: "Peça chegou.",
      statusDestino: "resolvida",
    });

    expect(analisado).toStrictEqual({ observacao: "Peça chegou." });
    expect("statusDestino" in analisado).toBe(false);
  });
});

describe("os rótulos que descem para a barra de ações", () => {
  /** Os dois cuja FORMA não é botão — `rotulos.ts` os declara desde antes do item 25. */
  const NAO_SAO_BOTAO: readonly Comando[] = ["alterar-prioridade", "registrar-solucao-aplicada"];

  it("todo comando implementado que é BOTÃO tem rótulo — senão a barra some sem dizer nada", () => {
    // **É o alarme dos itens 17, 18 e 27:** quem acrescentar um comando de botão a
    // `COMANDOS_IMPLEMENTADOS` e esquecer o rótulo faria a barra renderizar nada, em silêncio.
    //
    // **A exceção é asserção, e não filtro silencioso** — ver o caso logo abaixo. O item 25 é o primeiro
    // em que a premissa *"implementado ⇒ botão"* deixa de valer.
    for (const comando of COMANDOS_IMPLEMENTADOS) {
      if (NAO_SAO_BOTAO.includes(comando)) continue;
      expect(rotuloDeComando(comando)).not.toBeNull();
    }
  });

  it("registrar-solucao-aplicada NÃO tem rótulo, e é a FORMA dele — não esquecimento", () => {
    // **A exceção, escrita.** Ele é campo no corpo de T-05 (`inventario-de-telas.md`), e um rótulo
    // aqui produziria um botão que compete com *Resolver* na mesma barra.
    expect(rotuloDeComando("registrar-solucao-aplicada")).toBeNull();
  });

  it("alterar-prioridade NÃO tem rótulo, e é a FORMA dele — não esquecimento", () => {
    // **A exceção, escrita.** Ele é **seletor no bloco de identidade** (`inventario-de-telas.md:811-812`),
    // e um rótulo aqui produziria um botão na barra para um comando que a tela já oferece em outro lugar.
    //
    // **Sem este caso a ausência ficaria silenciosa** a partir desta fatia: `NAO_SAO_BOTAO` faz o laço
    // pular os dois, e a regra do arquivo é que exceção é asserção, nunca filtro silencioso.
    expect(rotuloDeComando("alterar-prioridade")).toBeNull();
  });

  it("avaliar é palavra, e é o verbo do glossário — compromisso A-5", () => {
    // **O último rótulo do produto.** Até o item 27 este comando não tinha rótulo, e o caso que guardava
    // a ausência foi apagado nesta fatia — como o próprio comentário dele mandava.
    expect(rotuloDeComando("avaliar")).toBe("Avaliar");
  });

  it("cancelar é palavra, e é o verbo do glossário — compromisso A-5", () => {
    expect(rotuloDeComando("cancelar")).toBe("Cancelar");
  });

  it("retomar é palavra, e é o verbo do glossário — compromisso A-5", () => {
    expect(rotuloDeComando("retomar")).toBe("Retomar");
  });

  it("pausar é palavra, e é o verbo do glossário — compromisso A-5", () => {
    expect(rotuloDeComando("pausar")).toBe("Pausar");
  });

  it("resolver é palavra, e é o verbo do glossário — compromisso A-5", () => {
    expect(rotuloDeComando("resolver")).toBe("Resolver");
  });

  it("analisar é palavra, não ícone — compromisso A-5", () => {
    expect(rotuloDeComando("analisar")).toBe("Analisar");
  });

  it("atribuir é palavra, e cabe ao lado de Analisar em 390 px — compromisso A-5", () => {
    expect(rotuloDeComando("atribuir-responsavel")).toBe("Atribuir");
  });

  it("iniciar-atendimento é palavra, e o rótulo fica INTEIRO — compromisso A-5", () => {
    // **Encurtar para *Atender* trocaria o VERBO** que o glossário §4, o contrato §8.4 e o inventário
    // usam. Não é o caso de *Atribuir*, que é a cabeça de *Atribuir responsável*: mesmo verbo, objeto
    // encurtado.
    expect(rotuloDeComando("iniciar-atendimento")).toBe("Iniciar atendimento");
  });

  it("os seis status têm rótulo nas DUAS lentes e nome de Gestor — nenhum buraco", () => {
    const doSolicitante = rotulosDeStatus("solicitante");
    const doGestor = rotulosDeStatus("gestor");
    const nomes = nomesDeStatus();

    for (const status of STATUS) {
      expect(typeof doSolicitante[status]).toBe("string");
      expect(typeof doGestor[status]).toBe("string");
      expect(typeof nomes[status]).toBe("string");
    }

    // A frase do `409` usa a coluna de quem lê — "agora ela está …". Do lado do Solicitante `pausada`
    // degrada para a palavra sozinha, porque um erro não carrega motivo de pausa.
    expect(doSolicitante.pausada).toBe("Parada");
    expect(doSolicitante.em_analise).toBe("Em análise");

    // **Do lado do Gestor não há degradação a fazer:** a coluna dele JÁ é uma palavra por status, e
    // `pausada` é "Pausada" com ou sem motivo. É o que faz o `409` dele ler "agora ela está Pausada."
    expect(doGestor.pausada).toBe("Pausada");
    expect(doGestor.aberta).toBe("Aberta");
    expect(doGestor.em_atendimento).toBe("Em atendimento");

    // O bloco de transição usa a coluna do Gestor: ela é SUBSTANTIVO, e sobrevive dentro de "De X para Y".
    expect(nomes.aberta).toBe("Aberta");
    expect(nomes.em_analise).toBe("Em análise");
  });
});

/**
 * ============================================================================
 *  O corpo de `POST …/atribuir-responsavel` — o critério 19.6
 * ============================================================================
 *
 * **`observacao` é recusada EM VOZ ALTA**, e é a diferença que a §6.2 do contrato fixa: `400` é *"você
 * escreveu errado"*, `422 CAMPO_NAO_SUPORTADO` é *"o produto não faz isso"*. Um schema Zod comum descarta
 * o campo desconhecido de graça — e quem chamou fica convencido de ter gravado uma observação que não
 * existe em lugar nenhum do esquema.
 */
describe("o corpo da atribuição", () => {
  it("aceita { responsavelPessoaId } e nada mais é exigido — critério 19.1", () => {
    const conferido = atribuicaoDeResponsavelSchema.safeParse({
      responsavelPessoaId: "9d3e2f81-0a1b-4c2d-8e3f-4a5b6c7d8e9f",
    });
    expect(conferido.success).toBe(true);
  });

  it("recusa responsavelPessoaId ausente", () => {
    expect(atribuicaoDeResponsavelSchema.safeParse({}).success).toBe(false);
  });

  it("recusa responsavelPessoaId que não é UUID — é identificador, não texto", () => {
    expect(atribuicaoDeResponsavelSchema.safeParse({ responsavelPessoaId: "o zelador" }).success).toBe(
      false,
    );
  });

  it("camposSemDestino aponta observacao — e o corpo sem ela passa limpo", () => {
    expect(
      camposSemDestino({ responsavelPessoaId: "x", observacao: "combinei com o zelador" }),
    ).toStrictEqual(["observacao"]);
    expect(camposSemDestino({ responsavelPessoaId: "x" })).toStrictEqual([]);
  });

  it("camposSemDestino não estoura com corpo que não é objeto", () => {
    // O `recusar` roda sobre o corpo CRU: `null`, `[]` e `"texto"` chegam aqui antes de o schema opinar.
    expect(camposSemDestino(null)).toStrictEqual([]);
    expect(camposSemDestino("observacao")).toStrictEqual([]);
  });

  it("observacao NULA também é recusada — o campo presente é o que importa", () => {
    // `"observacao" in corpo` e não `corpo.observacao !== undefined`: quem mandou `{ observacao: null }`
    // mandou o campo, e precisa saber que ele não é aceito. É a mesma leitura de
    // `camposEscritosPeloServidor`.
    expect(camposSemDestino({ observacao: null })).toStrictEqual(["observacao"]);
  });

  it("recusarSemDestino estoura com observacao, e passa limpo sem ela — o critério 17.6", () => {
    // **O envelope que os DOIS endpoints chamam.** Ele era função local do `route.ts` do item 19, e o
    // comentário de lá já anunciava este dia: *"o item 17 chama esta mesma `camposSemDestino`"*. Uma cópia
    // do `if` no segundo `route.ts` seria a segunda construção do mesmo `throw`.
    expect(() => recusarSemDestino({ prioridade: "alta", observacao: "combinei com o zelador" })).toThrow(
      CampoNaoSuportado,
    );
    expect(() => recusarSemDestino({ prioridade: "alta" })).not.toThrow();
  });

  it("recusarSemDestino nomeia o campo em erros[], que é o que o cliente lê", () => {
    // O corpo do `422` é `erros: [{ campo: "observacao", codigo: "CAMPO_NAO_SUPORTADO" }]` — critério 17.6.
    const erro = (() => {
      try {
        recusarSemDestino({ observacao: "x" });
        return null;
      } catch (causa) {
        return causa as CampoNaoSuportado;
      }
    })();

    expect(erro?.extensoes["erros"]).toStrictEqual([
      { campo: "observacao", codigo: "CAMPO_NAO_SUPORTADO" },
    ]);
  });
});

/**
 * ============================================================================
 *  As palavras da atribuição — o item 21, e a única superfície testável dele
 * ============================================================================
 *
 * **O produto não tem biblioteca de teste de componente React** — `jsdom` está instalado, não há
 * `@testing-library`, e os quatro projetos de camada rodam em `environment: "node"`. Cinco ternários
 * dentro do JSX seriam cinco decisões de texto de produto sem um teste, e a §3.12 da spec do item 20 já
 * fechou essa porta: *"uma decisão … mora numa função com teste, e não num `?:` dentro do JSX"*.
 *
 * **Os dois títulos são os nomes dos comandos no `contrato-de-api.md:218-219`, literais** — o endpoint
 * *"realiza dois (`Atribuir responsável` e `Reatribuir`)"*. A assimetria (um com objeto, outro sem) é do
 * contrato, não nossa, e copiá-la é mais defensável que inventar *"Reatribuir responsável"*, que
 * documento nenhum tem.
 */
describe("as palavras da atribuição — o par do item 21", () => {
  const PARES = [PALAVRAS_DA_ATRIBUICAO.primeira, PALAVRAS_DA_ATRIBUICAO.nova];

  it("sem responsável é o par que começa por Atribuir — e é o texto de hoje, intacto", () => {
    const palavras = palavrasDaAtribuicao(false);
    expect(palavras).toStrictEqual({
      gatilho: "Atribuir",
      titulo: "Atribuir responsável",
      descricao: "Quem vai cuidar desta ocorrência.",
      confirmar: "Atribuir",
      enviando: "Atribuindo…",
      sucesso: "Responsável atribuído",
      falha: "Não foi possível atribuir o responsável",
    });
  });

  it("com responsável é o par que começa por Reatribuir — o critério 21.1 em palavra", () => {
    const palavras = palavrasDaAtribuicao(true);
    expect(palavras).toStrictEqual({
      gatilho: "Reatribuir",
      titulo: "Reatribuir",
      descricao: "Quem passa a cuidar desta ocorrência. A atribuição atual será encerrada.",
      confirmar: "Reatribuir",
      enviando: "Reatribuindo…",
      sucesso: "Ocorrência reatribuída",
      falha: "Não foi possível reatribuir a ocorrência",
    });
  });

  it("o verbo do título atravessa as OUTRAS QUATRO superfícies, nos dois pares", () => {
    // **É a asserção que impede um dos cinco textos ficar para trás numa edição futura.** O gatilho e o
    // botão que grava carregam o verbo nu; o verbo de envio é o mesmo verbo no gerúndio.
    for (const par of PARES) {
      const verbo = par.titulo.split(" ")[0]!;
      expect(par.gatilho).toBe(verbo);
      expect(par.confirmar).toBe(verbo);
      expect(par.enviando).toBe(`${verbo.replace(/ir$/, "indo")}…`);
    }
  });

  it("a descrição do par de reatribuição diz que a atual será ENCERRADA — o 21.3 virando texto", () => {
    // **O critério 21.3 é `[M]`** — garantia de índice único parcial, invisível na tela. Sem esta oração,
    // nada em T-05 diz que escolher outra pessoa SUBSTITUI em vez de acrescentar uma segunda, que é a
    // única leitura errada que o modal permite.
    expect(PALAVRAS_DA_ATRIBUICAO.nova.descricao).toContain("A atribuição atual será encerrada.");
    expect(PALAVRAS_DA_ATRIBUICAO.primeira.descricao).not.toContain("encerrada");
  });

  it("nenhum dos CATORZE textos é vazio", () => {
    for (const par of PARES) {
      for (const texto of Object.values(par)) {
        expect(texto.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("a função escolhe pelo BOOLEANO, e devolve exatamente um dos dois pares declarados", () => {
    // **O predicado é `responsavelAtualPessoaId !== null`, não "o responsável está na lista"** (§3.5 da
    // spec): vínculo revogado continua sendo `detalhe.responsavel` e SOME dos candidatos. Derivar da
    // lista faria o modal dizer *Atribuir* sobre uma ocorrência que tem responsável.
    expect(palavrasDaAtribuicao(false)).toBe(PALAVRAS_DA_ATRIBUICAO.primeira);
    expect(palavrasDaAtribuicao(true)).toBe(PALAVRAS_DA_ATRIBUICAO.nova);
  });
});

/**
 * ============================================================================
 *  O retorno dos comandos de T-05 — item 44g, critério 6
 * ============================================================================
 *
 * **Os títulos do aviso moram em `rotulos.ts`**, ao lado das palavras da atribuição, porque é lá que
 * moram os textos de T-05 que dependem do comando. **E nenhum título pode conter o que o teste de ponta
 * a ponta procura sem escopo** (spec do 44g, §4.13): o aviso desenha uma `<section>` em toda página, e um
 * título com *Situação*, *Nota* ou *Sua avaliação* faria uma asserção passar pela razão errada.
 */
describe("o retorno dos comandos — item 44g", () => {
  const TITULOS = [
    ...Object.values(RETORNO_DO_COMANDO),
    RETORNO_DA_MENSAGEM,
    PALAVRAS_DA_ATRIBUICAO.primeira,
    PALAVRAS_DA_ATRIBUICAO.nova,
  ].flatMap((textos) => [textos.sucesso, textos.falha]);

  it("todo comando que a tela envia tem o par, e as duas exceções são asseridas", () => {
    // `atribuir-responsavel` tem o par em `palavrasDaAtribuicao`, porque a palavra muda com o estado;
    // `alterar-prioridade` responde pela linha de desfazer do bloco (critério 17.7, achado A-04).
    const semPar = COMANDOS_IMPLEMENTADOS.filter((comando) => retornoDoComando(comando) === null);
    expect(semPar).toStrictEqual(["atribuir-responsavel", "alterar-prioridade"]);
  });

  it("a falha diz o verbo da ação, e nunca é a frase genérica", () => {
    const falhas = TITULOS.filter((_, indice) => indice % 2 === 1);
    for (const falha of falhas) {
      expect(falha.startsWith("Não foi possível ")).toBe(true);
      expect(falha).not.toBe(MENSAGEM_GENERICA);
      expect(falha).not.toContain("agora");
    }
  });

  it("nenhum título contém o que o teste de ponta a ponta procura sem escopo", () => {
    for (const titulo of TITULOS) {
      for (const proibida of ["Situação", "Nota", "Sua avaliação", "Avaliar", "Atribuir"]) {
        expect(titulo).not.toContain(proibida);
      }
    }
  });
});

describe("o corpo de POST …/alterar-prioridade — item 17", () => {
  it("aceita os TRÊS valores, e são os do Domínio", () => {
    for (const prioridade of ["baixa", "normal", "alta"] as const) {
      expect(alteracaoDePrioridadeSchema.safeParse({ prioridade }).success).toBe(true);
    }
  });

  it("recusa valor fora da lista, vazio e ausente — critério 17.1", () => {
    // **A lista dos três é importada do Domínio** (`PRIORIDADES`), como `pausaSchema` faz com
    // `MOTIVOS_DE_PAUSA`. Uma segunda cópia divergiria no dia em que a D6 mudar.
    expect(alteracaoDePrioridadeSchema.safeParse({ prioridade: "urgente" }).success).toBe(false);
    expect(alteracaoDePrioridadeSchema.safeParse({ prioridade: "" }).success).toBe(false);
    expect(alteracaoDePrioridadeSchema.safeParse({}).success).toBe(false);
  });

  it("campo desconhecido FORA da lista sem destino é descartado, não vira 400", () => {
    // O recorte estreito de sempre: tornar o schema estrito trocaria *"o produto não faz isso"* por
    // *"você escreveu errado"* em todo o resto. Quem é recusado em voz alta é `observacao`, e é o
    // `recusarSemDestino` que faz isso — **antes** deste schema rodar.
    const analisado = alteracaoDePrioridadeSchema.parse({ prioridade: "alta", corDoPortao: "azul" });

    expect(analisado).toStrictEqual({ prioridade: "alta" });
  });
});

/**
 * ============================================================================
 *  `executarComando` — a chamada e as três frases, num lugar só
 * ============================================================================
 *
 * **A barra montava a frase do `409` dentro dela; o modal precisa da mesma.** Duas construções do mesmo
 * texto é a segunda cópia de sempre — e esta seria a que aparece quando o Gestor está com pressa.
 *
 * **`rotulosDeStatus` entra por parâmetro, e não por `import`.** Se a função importasse
 * `@/interface/projecoes`, arrastaria `comandosDisponiveis` — a máquina de estados inteira — para dentro
 * do pacote do navegador, que é literalmente a *segunda cópia* que `acoesDisponiveis` existe para impedir.
 */
describe("executarComando", () => {
  const ROTULOS = { em_analise: "Em análise", cancelada: "Cancelada" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function responderCom(estado: { ok: boolean; corpo?: unknown }) {
    const chamadas: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return Promise.resolve({
        ok: estado.ok,
        json: () => Promise.resolve(estado.corpo ?? {}),
      });
    });
    return chamadas;
  }

  it("sucesso: POSTa no caminho do comando, com o corpo em JSON, e devolve ok", async () => {
    const chamadas = responderCom({ ok: true });

    const resultado = await executarComando(
      "abc",
      "atribuir-responsavel",
      { responsavelPessoaId: "z" },
      ROTULOS,
      "organizacao-a",
    );

    expect(resultado).toStrictEqual({ ok: true });
    expect(chamadas[0]!.url).toBe("/api/ocorrencias/abc/atribuir-responsavel");
    expect(chamadas[0]!.init.body).toBe(JSON.stringify({ responsavelPessoaId: "z" }));

    // **A afirmação da §4.3 chega ao `fetch`** (item 7b, critério 7b.6), e é aqui que os dez comandos
    // ficam cobertos de uma vez. O valor é o que a página passou — nunca o cookie na hora do clique,
    // porque a outra aba já o reescreveu e a afirmação bateria consigo mesma.
    expect(chamadas[0]!.init.headers).toStrictEqual({
      "content-type": "application/json",
      "x-organizacao-id": "organizacao-a",
    });
  });

  it("409 com statusAtual vira a frase do inventário, COM o rótulo e não com o enum", async () => {
    responderCom({
      ok: false,
      corpo: { codigo: "TRANSICAO_NAO_PERMITIDA", statusAtual: "cancelada", detail: "não importa" },
    });

    const resultado = await executarComando(
      "abc",
      "atribuir-responsavel",
      {},
      ROTULOS,
      "organizacao-a",
    );

    expect(resultado).toStrictEqual({
      ok: false,
      aviso: "Esta ocorrência mudou enquanto você estava olhando: agora ela está Cancelada.",
    });
  });

  it("422 usa o detail do problema — é o texto que o contrato publica", async () => {
    responderCom({
      ok: false,
      corpo: {
        codigo: "RESPONSAVEL_SEM_VINCULO_ATIVO",
        detail: "Só é possível atribuir a quem tem vínculo ativo nesta organização.",
      },
    });

    const resultado = await executarComando(
      "abc",
      "atribuir-responsavel",
      {},
      ROTULOS,
      "organizacao-a",
    );

    expect(resultado).toStrictEqual({
      ok: false,
      aviso: "Só é possível atribuir a quem tem vínculo ativo nesta organização.",
    });
  });

  it("problema sem detail cai na frase genérica — nunca em 'undefined'", async () => {
    responderCom({ ok: false, corpo: { codigo: "ERRO_INTERNO" } });
    expect(await executarComando("abc", "analisar", {}, ROTULOS, "organizacao-a")).toStrictEqual({
      ok: false,
      aviso: MENSAGEM_GENERICA,
    });
  });

  it("rede caída não estoura — nuvem sem SLA é o caso esperado, não a borda", async () => {
    // Sem este caminho, a rejeição do `fetch` aciona o Error Boundary em vez de mostrar a linha de aviso.
    vi.stubGlobal("fetch", () => Promise.reject(new Error("rede")));
    expect(await executarComando("abc", "analisar", {}, ROTULOS, "organizacao-a")).toStrictEqual({
      ok: false,
      aviso: MENSAGEM_GENERICA,
    });
  });

  it("status desconhecido no 409 degrada para o próprio valor, sem quebrar a frase", async () => {
    responderCom({ ok: false, corpo: { codigo: "TRANSICAO_NAO_PERMITIDA", statusAtual: "hibernada" } });
    const resultado = await executarComando("abc", "analisar", {}, ROTULOS, "organizacao-a");
    expect(resultado).toStrictEqual({
      ok: false,
      aviso: "Esta ocorrência mudou enquanto você estava olhando: agora ela está hibernada.",
    });
  });
});

/**
 * ============================================================================
 *  A ação primária de T-05 — o achado R-08, e ele chega em `em_analise`
 * ============================================================================
 *
 * **A regra de hoje é *"o primeiro renderizável, na ordem do enum"***, e a ordem do enum põe
 * `atribuir-responsavel` **antes** de `iniciar-atendimento`. Resultado, a partir do item 22: o botão em
 * destaque seria *Atribuir* — numa tela onde o responsável **acabou de ser atribuído**, porque é
 * exatamente isso que fez o outro botão aparecer.
 *
 * **A regra é uma TABELA por status, e não uma derivação por `transicaoPermitida`** (spec §3.9): a
 * derivação erra em dois estados futuros — em `em_atendimento` daria *Pausar* em vez de *Resolver*, e em
 * `em_analise` sem responsável daria *Pausar* em vez de *Atribuir*, porque `atribuir-responsavel` está em
 * `SEM_TRANSICAO` e a derivação o pula.
 */
describe("acaoPrimaria — a regra do destaque de T-05", () => {
  it("em em_analise COM responsável, o destaque é iniciar-atendimento, não o primeiro da lista", () => {
    // É o R-08 acontecendo: a ordem do enum daria `atribuir-responsavel`.
    expect(acaoPrimaria("em_analise", ["atribuir-responsavel", "iniciar-atendimento"])).toBe(
      "iniciar-atendimento",
    );
  });

  it("em aberta o destaque é analisar — a ação de volume da triagem", () => {
    expect(acaoPrimaria("aberta", ["analisar", "atribuir-responsavel"])).toBe("analisar");
  });

  it("o desempate: comando nomeado que não está renderizável cede ao primeiro que está", () => {
    // `em_analise` sem responsável — `iniciar-atendimento` não é renderizável, e sobra um só.
    expect(acaoPrimaria("em_analise", ["atribuir-responsavel"])).toBe("atribuir-responsavel");
    // `pausada` com `retomar` ainda fora da lista de renderizáveis: o desempate continua valendo.
    expect(acaoPrimaria("pausada", ["atribuir-responsavel"])).toBe("atribuir-responsavel");
  });

  it("em pausada o destaque é retomar, e a tabela estava escrita desde o item 22 esperando este dia", () => {
    // **A ordem de `COMANDOS` põe `atribuir-responsavel` na frente**, e uma regra por índice daria
    // *Atribuir* como ação em destaque de uma ocorrência que está parada esperando. A tabela dá
    // *Retomar* — e `ACAO_PRIMARIA` não precisou de uma linha nova para isso.
    expect(acaoPrimaria("pausada", ["atribuir-responsavel", "retomar"])).toBe("retomar");
  });

  it("em em_atendimento o destaque é resolver, e NÃO o primeiro da lista — a decisão do item 22", () => {
    // **É a primeira vez que a tabela `ACAO_PRIMARIA` é conferível neste estado.** A ordem do enum põe
    // `atribuir-responsavel` na frente; a derivação por `transicaoPermitida` daria *Pausar*. A tabela
    // acerta os dois — e é por isso que ela é tabela, e por isso os itens 23 a 27 não a editam.
    expect(acaoPrimaria("em_atendimento", ["atribuir-responsavel", "resolver"])).toBe("resolver");
  });

  it("sem nenhuma ação renderizável, não há primário", () => {
    expect(acaoPrimaria("resolvida", [])).toBeNull();
    expect(acaoPrimaria("cancelada", [])).toBeNull();
  });

  it("a tabela responde para os SEIS status, e nunca estoura", () => {
    // **Entrada cujo comando ainda não existe é inerte:** a tabela não anuncia botão, ela só diz qual das
    // ações já renderizadas ganha ênfase. Por isso os itens 23 a 27 não a editam.
    for (const status of STATUS) {
      expect(() => acaoPrimaria(status, [])).not.toThrow();
      expect(acaoPrimaria(status, ["cancelar"])).toBe("cancelar");
    }
  });

  it("em_analise SEM responsável dá Atribuir, e não Pausar — o caso que a derivação erraria", () => {
    // `pausar` é permitido pela máquina de estados aqui. A derivação por `transicaoPermitida`, que o
    // item 22 recusou, daria **Pausar** como ação em destaque numa ocorrência que ninguém pegou ainda.
    expect(acaoPrimaria("em_analise", ["atribuir-responsavel", "pausar"])).toBe(
      "atribuir-responsavel",
    );
  });
});

describe("o corpo de POST …/resolver — o primeiro comando com DOIS campos", () => {
  it("aceita o corpo vazio: os dois campos são opcionais (requestBody: required: false)", () => {
    expect(resolucaoSchema.safeParse({}).success).toBe(true);
  });

  it("aceita os dois, e aceita cada um sozinho", () => {
    expect(resolucaoSchema.safeParse({ solucaoAplicada: "Trocada a lâmpada." }).success).toBe(true);
    expect(resolucaoSchema.safeParse({ observacao: "Conferido." }).success).toBe(true);
    expect(
      resolucaoSchema.safeParse({ solucaoAplicada: "Trocada.", observacao: "Conferido." }).success,
    ).toBe(true);
  });

  it("aceita null nos dois — `nullish`, como o resto dos comandos", () => {
    expect(resolucaoSchema.safeParse({ solucaoAplicada: null, observacao: null }).success).toBe(true);
  });

  it("recusa solucaoAplicada acima de 4000 — o maxLength do openapi.yaml", () => {
    expect(resolucaoSchema.safeParse({ solucaoAplicada: "a".repeat(4001) }).success).toBe(false);
    expect(resolucaoSchema.safeParse({ solucaoAplicada: "a".repeat(4000) }).success).toBe(true);
  });

  it("recusa observacao acima de 1000 — o MESMO teto do comandoComObservacaoSchema", () => {
    // **Um número só, num lugar só** (D-P5): o campo é reusado, não redigitado. Dois `.max()` para o
    // mesmo campo divergiriam no dia em que o contrato mudasse um deles.
    expect(resolucaoSchema.safeParse({ observacao: "a".repeat(1001) }).success).toBe(false);
    expect(resolucaoSchema.safeParse({ observacao: "a".repeat(1000) }).success).toBe(true);
  });

  it("aceita string VAZIA nos dois — não há minLength no contrato, e quem apara é a Aplicação", () => {
    // **É o critério 16.7 do avesso, aplicado ao quarto endpoint:** schema mais estrito que a
    // especificação versionada é a mesma divergência, do outro lado. `/registrar-solucao-aplicada`
    // declara `minLength: 1`; `/resolver` **não** declara, e o produto obedece ao que está publicado.
    expect(resolucaoSchema.safeParse({ solucaoAplicada: "", observacao: "" }).success).toBe(true);
  });

  it("apara os dois — o `.trim()` do schema, como em todo campo de texto do produto", () => {
    const conferido = resolucaoSchema.safeParse({
      solucaoAplicada: "  Trocada a lâmpada.  ",
      observacao: "  Conferido.  ",
    });
    expect(conferido.success).toBe(true);
    expect(conferido.data!.solucaoAplicada).toBe("Trocada a lâmpada.");
    expect(conferido.data!.observacao).toBe("Conferido.");
  });
});

describe("o corpo de POST …/registrar-solucao-aplicada — o segundo com corpo OBRIGATÓRIO", () => {
  it("exige o campo: corpo vazio é recusado (required: [solucaoAplicada])", () => {
    expect(solucaoAplicadaSchema.safeParse({}).success).toBe(false);
  });

  it("recusa string vazia — o minLength: 1 do openapi.yaml", () => {
    // **É a assimetria com `/resolver`, e ela é do contrato.** Lá não há `minLength`, aqui há
    // (`openapi.yaml`). Um comando cujo corpo é obrigatório não tem o caso "não mandou nada".
    expect(solucaoAplicadaSchema.safeParse({ solucaoAplicada: "" }).success).toBe(false);
    expect(solucaoAplicadaSchema.safeParse({ solucaoAplicada: "   " }).success).toBe(false);
  });

  it("recusa acima de 4000 e aceita 4000 — o mesmo teto do resolver, num lugar só", () => {
    expect(solucaoAplicadaSchema.safeParse({ solucaoAplicada: "a".repeat(4001) }).success).toBe(
      false,
    );
    expect(solucaoAplicadaSchema.safeParse({ solucaoAplicada: "a".repeat(4000) }).success).toBe(
      true,
    );
  });

  it("apara, e o que sai é o texto aparado — quem apara é o schema, e o comando não apara de novo", () => {
    const conferido = solucaoAplicadaSchema.safeParse({ solucaoAplicada: "  Trocada a lâmpada.  " });
    expect(conferido.success).toBe(true);
    expect(conferido.data!.solucaoAplicada).toBe("Trocada a lâmpada.");
  });

  it("descarta campo desconhecido, e NÃO responde 422 — a especificação não declara observacao aqui", () => {
    // **Sem `recusar:` no `route.ts`, e a razão é do contrato.** `camposSemDestino` é dos comandos que
    // DECLARAM `observacao` no `openapi.yaml` sem ter onde guardá-la. Este endpoint não a declara
    // (um campo só) e **não declara `422`** (sete respostas). Responder um status que a especificação
    // versionada não lista é a divergência do critério 16.7 do avesso.
    const conferido = solucaoAplicadaSchema.parse({
      solucaoAplicada: "Feito.",
      observacao: "não declarada aqui",
    });

    expect(conferido).toStrictEqual({ solucaoAplicada: "Feito." });
  });

  it("o resolucaoSchema continua aceitando '' e ausente — a assimetria, lado a lado", () => {
    // **Os dois schemas do mesmo campo, no mesmo caso**, porque é assim que a assimetria fica conferível
    // em vez de virar comentário. O teto é o mesmo; o piso, não.
    expect(resolucaoSchema.safeParse({ solucaoAplicada: "" }).success).toBe(true);
    expect(resolucaoSchema.safeParse({}).success).toBe(true);
    expect(solucaoAplicadaSchema.safeParse({ solucaoAplicada: "" }).success).toBe(false);
    expect(resolucaoSchema.safeParse({ solucaoAplicada: "a".repeat(4001) }).success).toBe(false);
  });
});

/**
 * ============================================================================
 *  Qual frase o vazio da barra mostra — o critério 26.6
 * ============================================================================
 *
 * **São dois vazios diferentes, e o erro clássico é usar um no lugar do outro** — que é uma decisão, e
 * por isso mora numa função com teste, e não num `?:` dentro do JSX. É a mesma forma do `vazioDaLista`
 * do item 14.
 *
 * **A função devolve o PAR** (D-P2 do plano): a moldura é metade da decisão. Tracejada marca **andaime
 * declarado**; sólida é **UI de produto**. Devolver só a frase deixaria a segunda metade no JSX, e a
 * página passaria a importar `ehTerminal` do Domínio.
 */
describe("vazioDaBarra — as DUAS frases do vazio de T-05", () => {
  it("nos dois terminais, a frase de produto — os critérios 26.6 e 27.6", () => {
    for (const terminal of ["resolvida", "cancelada"] as const) {
      expect(vazioDaBarra(terminal)).toBe("Esta ocorrência está encerrada.");
    }
  });

  it("nos quatro não-terminais, a frase do critério 18.6", () => {
    // **Ela vale para todo mundo agora**, e não só para quem não gestiona: o ramo que dependia de
    // `ehGestor` não tinha população, e o caso seguinte prova isso.
    for (const emAndamento of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
      expect(vazioDaBarra(emAndamento)).toBe(
        "Só os Gestores podem cancelar a partir daqui. Peça o cancelamento pelo comentário.",
      );
    }
  });

  it("fora de estado terminal, a frase convida ao comentário — critério 30.6", () => {
    for (const emAndamento of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
      expect(vazioDaBarra(emAndamento)).toBe(
        "Só os Gestores podem cancelar a partir daqui. Peça o cancelamento pelo comentário.",
      );
    }
  });

  it("a segunda oração é a do `detail` publicado, palavra por palavra — e o `detail` NÃO muda", () => {
    // `openapi.yaml`: o detail do 403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO termina com esta frase.
    expect(vazioDaBarra("em_atendimento")).toContain("Peça o cancelamento pelo comentário.");
    // A primeira oração daquele detail — "O atendimento já começou" — continua FORA, e a razão está no
    // critério 18.6: ela é falsa numa ocorrência que chegou a `pausada` vinda de `em_analise`.
    expect(vazioDaBarra("pausada")).not.toContain("atendimento já começou");
  });

  it("responde para os SEIS status, e as DUAS frases são mutuamente exclusivas", () => {
    const textos = new Set(STATUS.map((status) => vazioDaBarra(status)));
    expect(textos.size).toBe(2);
    for (const status of STATUS) {
      expect(vazioDaBarra(status).length).toBeGreaterThan(0);
    }
  });

  it("a frase terminal NÃO é derivada aqui — ela chama ehTerminal, que é do Domínio", () => {
    expect(vazioDaBarra("cancelada")).toBe("Esta ocorrência está encerrada.");
    expect(vazioDaBarra("em_atendimento")).toBe(
      "Só os Gestores podem cancelar a partir daqui. Peça o cancelamento pelo comentário.",
    );
  });

  it("a BARRA DO GESTOR nunca fica vazia fora de estado terminal — o que torna a remoção do ehGestor segura", () => {
    /**
     * **A tautologia do critério 27.6, virada asserção.** `vazioDaBarra` perdeu o parâmetro `ehGestor`
     * porque o ramo que ele selecionava não tinha população: quem tem `ocorrencia.cancelar_qualquer` tem
     * `cancelar` em `acoesDisponiveis` nos quatro estados não terminais, e `cancelar` tem rótulo.
     *
     * **No dia em que alguém tirar `cancelar` de um estado ou partir a permissão, este caso cai — antes
     * de a frase errada aparecer em tela.** É exatamente o alarme que a nota do backlog de 28/08 pede.
     */
    for (const status of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
      const renderizaveis = projetarOcorrenciaDetalhe(
        { ...umaOcorrenciaLidaCom([]), status },
        { pessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f", permissoes: DO_GESTOR },
      ).acoesDisponiveis.filter((comando) => rotuloDeComando(comando as Comando) !== null);

      expect(renderizaveis.length).toBeGreaterThan(0);
    }
  });
});

describe("o corpo de POST …/pausar — o primeiro comando com campo OBRIGATÓRIO", () => {
  it("aceita o par válido, e apara a observação", () => {
    const analisado = pausaSchema.safeParse({
      motivo: "aguardando_peca",
      observacao: "  Sem lâmpada no estoque.  ",
    });

    expect(analisado.success).toBe(true);
    expect(analisado.data?.observacao).toBe("Sem lâmpada no estoque.");
    expect(analisado.data?.motivo).toBe("aguardando_peca");
  });

  it("recusa corpo VAZIO com os DOIS campos em erros[] — requestBody é required: true", () => {
    const analisado = pausaSchema.safeParse({});

    expect(analisado.success).toBe(false);
    const campos = analisado.error?.issues.map((problema) => problema.path.join("."));
    expect(campos).toContain("motivo");
    expect(campos).toContain("observacao");
  });

  it("recusa motivo fora da lista — o enum vem do Domínio, e não é redigitado aqui", () => {
    expect(pausaSchema.safeParse({ motivo: "aguardando_chuva", observacao: "ok" }).success).toBe(
      false,
    );
  });

  it("aceita os QUATRO motivos, e nenhum a mais", () => {
    for (const motivo of MOTIVOS_DE_PAUSA) {
      expect(pausaSchema.safeParse({ motivo, observacao: "Esperando." }).success).toBe(true);
    }
  });

  it("recusa observação em branco — e aqui o minLength ESTÁ no contrato publicado", () => {
    // O oposto de /analisar e /resolver, onde `minLength` NÃO existe no openapi.yaml e o schema não
    // pode inventá-lo (critério 16.7). Aqui a especificação versionada manda o mesmo que o critério.
    expect(pausaSchema.safeParse({ motivo: "aguardando_peca", observacao: "" }).success).toBe(false);
    expect(pausaSchema.safeParse({ motivo: "aguardando_peca", observacao: "   " }).success).toBe(
      false,
    );
  });

  it("recusa observação acima de 1000 caracteres", () => {
    expect(
      pausaSchema.safeParse({ motivo: "aguardando_peca", observacao: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("nomeDoMotivoPausa — o motivo como OPÇÃO DE ESCOLHA, e não como o que aconteceu", () => {
  it("dá os quatro textos do protótipo, e nenhum deles é o rótulo de status", () => {
    expect(nomeDoMotivoPausa("aguardando_informacao_solicitante")).toBe(
      "Aguardando informação do solicitante",
    );
    expect(nomeDoMotivoPausa("aguardando_peca")).toBe("Aguardando peça");
    expect(nomeDoMotivoPausa("aguardando_autorizacao")).toBe("Aguardando autorização");
    expect(nomeDoMotivoPausa("aguardando_terceiro")).toBe("Aguardando um terceiro");
  });

  it("responde outra pergunta que rotuloDeMotivoPausa — os quatro pares diferem", () => {
    for (const motivo of MOTIVOS_DE_PAUSA) {
      expect(nomeDoMotivoPausa(motivo)).not.toBe(rotuloDeMotivoPausa(motivo));
    }
  });
});

describe("opcoesDeMotivoPausa — os quatro pares PRONTOS, para a página não importar o Domínio", () => {
  it("dá os quatro, na ordem de MOTIVOS_DE_PAUSA, com valor e rótulo", () => {
    expect(opcoesDeMotivoPausa()).toStrictEqual([
      {
        valor: "aguardando_informacao_solicitante",
        rotulo: "Aguardando informação do solicitante",
      },
      { valor: "aguardando_peca", rotulo: "Aguardando peça" },
      { valor: "aguardando_autorizacao", rotulo: "Aguardando autorização" },
      { valor: "aguardando_terceiro", rotulo: "Aguardando um terceiro" },
    ]);
  });
});

describe("a guarda da segunda linha de T-03 — os critérios 23.6 e 31.6", () => {
  it("devolve null nos QUATRO motivos quando o statusRotulo JÁ é o rótulo do motivo — o mundo de hoje", () => {
    for (const motivo of MOTIVOS_DE_PAUSA) {
      expect(segundaLinhaDeMotivo(motivo, rotuloDeMotivoPausa(motivo))).toBeNull();
    }
  });

  it("devolve o rótulo quando os dois textos DIVERGEM — e é o que prova que a guarda se apaga sozinha no item 31", () => {
    // No item 31 o rótulo do Gestor vira "Pausada", os textos divergem, e a segunda linha volta
    // sozinha — que é o que o critério 14.3 pede. Sem este caso, "volta sozinha" seria prosa.
    expect(segundaLinhaDeMotivo("aguardando_peca", "Pausada")).toBe(
      "Parada — esperando material chegar",
    );
  });

  it("devolve null quando não há motivo — fora de pausada não há segunda linha", () => {
    expect(segundaLinhaDeMotivo(null, "Em análise")).toBeNull();
  });

  /**
   * **O critério 31.6 virado asserção, e ele fecha nos QUATRO motivos.** Antes do item 31 os dois textos
   * coincidiam do lado do Gestor e a guarda devolvia `null`; com o rótulo dele colapsando em *"Pausada"*,
   * eles divergem e a linha volta — em **todos** os motivos, não só no que o caso acima ilustra.
   */
  it.each(MOTIVOS_DE_PAUSA)(
    "no rótulo do GESTOR, a segunda linha volta em %s — e é o motivo em palavras",
    (motivo) => {
      const doGestor = rotuloDeStatus("pausada", motivo, "gestor");
      expect(doGestor).toBe("Pausada");
      expect(segundaLinhaDeMotivo(motivo, doGestor)).toBe(rotuloDeMotivoPausa(motivo));
    },
  );

  /**
   * **E ela continua muda para o Solicitante, nos quatro** — que é o que faz a mesma chamada servir os
   * três recortes de T-03 e o bloco 1a de T-05 **sem argumento novo**. O cartão dele fica byte a byte
   * igual.
   */
  it.each(MOTIVOS_DE_PAUSA)(
    "no rótulo do SOLICITANTE, %s não produz segunda linha — a função se auto-silencia",
    (motivo) => {
      const doSolicitante = rotuloDeStatus("pausada", motivo, "solicitante");
      expect(segundaLinhaDeMotivo(motivo, doSolicitante)).toBeNull();
    },
  );

  it("fora de pausada não há segunda linha, em nenhuma das duas lentes", () => {
    for (const lente of ["solicitante", "gestor"] as const) {
      expect(segundaLinhaDeMotivo(null, rotuloDeStatus("resolvida", null, lente))).toBeNull();
      expect(segundaLinhaDeMotivo(null, rotuloDeStatus("em_atendimento", null, lente))).toBeNull();
    }
  });
});

describe("acoesDaBarra — o menu nasce no terceiro renderizável, e a conta é de largura", () => {
  it("com UM, ele é o destaque e o menu fica vazio", () => {
    expect(acoesDaBarra("pausada", ["atribuir-responsavel"])).toStrictEqual({
      destaque: "atribuir-responsavel",
      emMenu: [],
    });
  });

  it("com DOIS, os dois viram botão e o menu continua vazio — a decisão dos itens 19 e 22, intacta", () => {
    expect(acoesDaBarra("em_analise", ["atribuir-responsavel", "pausar"])).toStrictEqual({
      destaque: "atribuir-responsavel",
      emMenu: [],
    });
  });

  it("pausada com DOIS renderizáveis não tem menu — a conta que fecha o P-1 do item 23", () => {
    // **A lista de dois é passada à mão, e continua sendo o caso de dois.** Ela não descreve mais a
    // barra que a produção desenha: com o item 18 `cancelar` virou renderizável e `pausada` passou a
    // ter três. O caso segue guardando a regra `≤ 2 → sem menu`, e o caso de três está logo abaixo.
    expect(acoesDaBarra("pausada", ["atribuir-responsavel", "retomar"])).toStrictEqual({
      destaque: "retomar",
      emMenu: [],
    });
  });

  it("pausada com TRÊS converge para o protótipo — Retomar em destaque, os outros dois no menu", () => {
    // **É a barra que o item 18 produz**, e é a conferência da §3.13 contra o protótipo
    // (`telas.html:2236-2237` e `:2639-2641`): *Retomar* + *Mais ações ▾* no celular, e
    // *Retomar · Reatribuir · Cancelar* na tela grande.
    expect(
      acoesDaBarra("pausada", ["atribuir-responsavel", "retomar", "cancelar"]),
    ).toStrictEqual({
      destaque: "retomar",
      emMenu: ["atribuir-responsavel", "cancelar"],
    });
  });

  /**
   * ==========================================================================
   *  O alarme que o comentário de `barra-de-acoes.tsx` queria ser — item 18
   * ==========================================================================
   *
   * **Comando que vai para `emMenu` PRECISA ter a variante `"menu"`**, senão a barra renderiza um
   * `<button>` com `DialogTrigger` como filho direto de `role="menu"` — ARIA inválida, e o menu perde a
   * navegação por setas (A-2 e A-4). Nada quebra em vermelho; a acessibilidade quebra em silêncio.
   *
   * **Hoje isso é verdade por construção**, e a prova é de duas linhas: `emMenu` exclui o destaque, e
   * cada um dos quatro comandos sem a variante — `analisar`, `iniciar-atendimento`, `resolver` e
   * `retomar` — é o `ACAO_PRIMARIA` do único estado em que é renderizável. **Este caso é o que torna a
   * coincidência uma invariante guardada:** no dia em que alguém mexer em `ACAO_PRIMARIA`, ele cai.
   */
  it("emMenu só contém comandos que TÊM a variante menu — os seis status, as duas combinações", () => {
    const COM_VARIANTE_DE_MENU = ["atribuir-responsavel", "pausar", "cancelar"];

    const RESPONSAVEL = { pessoaId: "3d7c1e92-8a4b-4f5c-9d6e-1a2b3c4d5e6f", nome: "Zelador" };

    for (const status of STATUS) {
      for (const temResponsavel of [false, true]) {
        // **Os renderizáveis são os que TÊM rótulo de botão** — é o mesmo recorte que `page.tsx` faz
        // antes de chamar `acoesDaBarra`, e é o que exclui `alterar-prioridade` (seletor) e
        // `registrar-solucao-aplicada` (campo).
        const renderizaveis = projetarOcorrenciaDetalhe(
          {
            ...umaOcorrenciaLidaCom([]),
            status,
            responsavel: temResponsavel ? RESPONSAVEL : null,
          },
          { pessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f", permissoes: DO_GESTOR },
        ).acoesDisponiveis.filter((comando) => rotuloDeComando(comando as Comando) !== null);

        for (const comando of acoesDaBarra(status, renderizaveis).emMenu) {
          expect(COM_VARIANTE_DE_MENU).toContain(comando);
        }
      }
    }
  });

  it("com TRÊS, o destaque sai da tabela e os outros DOIS vão para o menu, na ordem recebida", () => {
    expect(
      acoesDaBarra("em_analise", ["atribuir-responsavel", "iniciar-atendimento", "pausar"]),
    ).toStrictEqual({
      destaque: "iniciar-atendimento",
      emMenu: ["atribuir-responsavel", "pausar"],
    });
  });

  it("em em_atendimento com três, o destaque é resolver — e pausar vai para o menu", () => {
    expect(
      acoesDaBarra("em_atendimento", ["atribuir-responsavel", "pausar", "resolver"]),
    ).toStrictEqual({
      destaque: "resolver",
      emMenu: ["atribuir-responsavel", "pausar"],
    });
  });

  it("com NENHUM, não há destaque nem menu", () => {
    expect(acoesDaBarra("resolvida", [])).toStrictEqual({ destaque: null, emMenu: [] });
  });

  it("o destaque é sempre o de acaoPrimaria — acoesDaBarra não tem tabela própria", () => {
    const renderizaveis = ["atribuir-responsavel", "iniciar-atendimento", "pausar"];
    expect(acoesDaBarra("em_analise", renderizaveis).destaque).toBe(
      acaoPrimaria("em_analise", renderizaveis),
    );
  });
});

describe("o corpo de POST …/cancelar — o segundo com DOIS campos obrigatórios", () => {
  it("aceita o par válido, e apara a observação", () => {
    const analisado = cancelamentoSchema.safeParse({
      motivo: "improcedente",
      observacao: "  Vistoriado no local: não há vazamento.  ",
    });

    expect(analisado.success).toBe(true);
    expect(analisado.data?.observacao).toBe("Vistoriado no local: não há vazamento.");
    expect(analisado.data?.motivo).toBe("improcedente");
  });

  it("recusa corpo VAZIO com os DOIS campos em erros[] — o critério 18.1", () => {
    const analisado = cancelamentoSchema.safeParse({});

    expect(analisado.success).toBe(false);
    const campos = analisado.error?.issues.map((problema) => problema.path.join("."));
    expect(campos).toContain("motivo");
    expect(campos).toContain("observacao");
  });

  it("aceita os SETE motivos — o enum é o conjunto inteiro, e a filtragem por papel NÃO é aqui", () => {
    // **É a §3.8 em asserção, e ela decide qual ERRO a pessoa recebe.** Um enum estreito devolveria
    // `400 FORMATO_INVALIDO` — *"você escreveu errado"* — onde a verdade é *"isso não é seu"*, e o
    // `422 MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL` do critério 18.4 se perderia.
    for (const motivo of MOTIVOS_DE_CANCELAMENTO) {
      expect(cancelamentoSchema.safeParse({ motivo, observacao: "Encerrando." }).success).toBe(true);
    }
  });

  it("aceita improcedente — o motivo que o Solicitante NÃO alcança passa pelo schema", () => {
    // O par do caso acima, escrito sozinho porque é a diferença que importa: quem recusa `improcedente`
    // para o Solicitante é o comando de aplicação, com `422`, e não este schema com `400`.
    expect(
      cancelamentoSchema.safeParse({ motivo: "improcedente", observacao: "Sem procedência." })
        .success,
    ).toBe(true);
  });

  it("recusa motivo fora da lista — o enum vem do Domínio, e não é redigitado aqui", () => {
    expect(
      cancelamentoSchema.safeParse({ motivo: "mudei_de_ideia", observacao: "ok" }).success,
    ).toBe(false);
  });

  it("recusa observação em branco — e aqui o minLength ESTÁ no contrato publicado", () => {
    expect(cancelamentoSchema.safeParse({ motivo: "duplicada", observacao: "" }).success).toBe(
      false,
    );
    expect(cancelamentoSchema.safeParse({ motivo: "duplicada", observacao: "   " }).success).toBe(
      false,
    );
  });

  it("recusa observação acima de 1000 caracteres", () => {
    expect(
      cancelamentoSchema.safeParse({ motivo: "duplicada", observacao: "a".repeat(1001) }).success,
    ).toBe(false);
  });
});

describe("o corpo de POST …/avaliar — o primeiro com campo NUMÉRICO", () => {
  it("aceita o par válido, e apara o comentário", () => {
    const analisado = avaliacaoSchema.safeParse({
      nota: 5,
      comentario: "  Resolveram no mesmo dia.  ",
    });

    expect(analisado.success).toBe(true);
    expect(analisado.data?.nota).toBe(5);
    expect(analisado.data?.comentario).toBe("Resolveram no mesmo dia.");
  });

  it("aceita SEM comentário — ele é opcional, e é o critério 27.1", () => {
    // **O `openapi.yaml:2054` declara `required: [nota]` e mais nada.** Um corpo com a nota só é o caso
    // dominante: dar nota tem de custar um toque.
    expect(avaliacaoSchema.safeParse({ nota: 3 }).success).toBe(true);
    expect(avaliacaoSchema.safeParse({ nota: 3, comentario: null }).success).toBe(true);
  });

  it("aceita as cinco notas da escala", () => {
    for (const nota of [1, 2, 3, 4, 5]) {
      expect(avaliacaoSchema.safeParse({ nota }).success).toBe(true);
    }
  });

  it("recusa 0 e 6 — as bordas de fora da escala", () => {
    expect(avaliacaoSchema.safeParse({ nota: 0 }).success).toBe(false);
    expect(avaliacaoSchema.safeParse({ nota: 6 }).success).toBe(false);
  });

  it("recusa 4.5 — `z.int()` e não `z.number()`, e é o que impede o arredondamento silencioso", () => {
    // **O `openapi.yaml:2058` declara `type: integer`.** Com `z.number()`, `4.5` chegaria ao `smallint` do
    // banco e seria truncado — o produto inventaria a nota de alguém.
    expect(avaliacaoSchema.safeParse({ nota: 4.5 }).success).toBe(false);
  });

  it("recusa a nota como texto — '5' não é 5", () => {
    expect(avaliacaoSchema.safeParse({ nota: "5" }).success).toBe(false);
  });

  it("corpo vazio é 400 com `nota` em erros[] — o critério 27.1", () => {
    const analisado = avaliacaoSchema.safeParse({});

    expect(analisado.success).toBe(false);
    expect(analisado.error?.issues.map((questao) => questao.path[0])).toContain("nota");
  });

  it("comentário de 1001 caracteres é recusado; 1000 passa", () => {
    expect(avaliacaoSchema.safeParse({ nota: 5, comentario: "x".repeat(1000) }).success).toBe(true);
    expect(avaliacaoSchema.safeParse({ nota: 5, comentario: "x".repeat(1001) }).success).toBe(false);
  });

  it("comentário de espaços passa, e vira string vazia — quem o transforma em null é o COMANDO", () => {
    /**
     * **Sem `.min(1)`, e é o portão do DoD olhando na direção contrária:** o `openapi.yaml:2060` declara
     * `maxLength: 1000` e **nenhum** `minLength`. Schema mais estrito que a especificação versionada é a
     * divergência do critério 16.7, do outro lado.
     *
     * **A normalização mora no comando de aplicação, num lugar só** — é onde o produto a pôs desde o
     * `analisar` (item 16).
     */
    const analisado = avaliacaoSchema.safeParse({ nota: 5, comentario: "   " });

    expect(analisado.success).toBe(true);
    expect(analisado.data?.comentario).toBe("");
  });

  it("campo desconhecido é DESCARTADO, sem erro — este endpoint não tem `recusar:`", () => {
    // **Não há `422` publicado para esta operação** (`openapi.yaml:2065-2087` lista 200/400/401/403/404/
    // 409/500). Recusar um campo aqui responderia um status que a especificação versionada não lista.
    const analisado = avaliacaoSchema.safeParse({ nota: 5, observacao: "não vai a lugar nenhum" });

    expect(analisado.success).toBe(true);
    expect(analisado.data).not.toHaveProperty("observacao");
  });
});

describe("camposDeEvolucaoPrevista — a SEGUNDA lista de recusa, e por que não é a primeira", () => {
  it("aponta ocorrenciaOrigemId, e o corpo sem ele passa limpo — o critério 18.5", () => {
    expect(
      camposDeEvolucaoPrevista({
        motivo: "duplicada",
        observacao: "É a mesma da vaga 34.",
        ocorrenciaOrigemId: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
      }),
    ).toStrictEqual(["ocorrenciaOrigemId"]);

    expect(
      camposDeEvolucaoPrevista({ motivo: "duplicada", observacao: "É a mesma da vaga 34." }),
    ).toStrictEqual([]);
  });

  it("ocorrenciaOrigemId NULO também é recusado — o campo presente é o que importa", () => {
    // `"campo" in corpo`, e não `corpo.campo !== undefined`: quem mandou o campo tentou usar a
    // capacidade, e o silêncio o faria acreditar que o vínculo entre as duas ocorrências foi gravado.
    expect(camposDeEvolucaoPrevista({ ocorrenciaOrigemId: null })).toStrictEqual([
      "ocorrenciaOrigemId",
    ]);
  });

  it("não estoura com corpo que não é objeto", () => {
    expect(camposDeEvolucaoPrevista(null)).toStrictEqual([]);
    expect(camposDeEvolucaoPrevista(undefined)).toStrictEqual([]);
    expect(camposDeEvolucaoPrevista("ocorrenciaOrigemId")).toStrictEqual([]);
  });

  it("as DUAS listas são por endpoint, e este par é o que impede alguém de fundi-las", () => {
    // **Se elas fossem uma só, `/cancelar` recusaria com `422` o próprio campo obrigatório dele.** É a
    // razão fatal da §3.9, virada asserção — e do outro lado, `/atribuir-responsavel` e
    // `/alterar-prioridade` passariam a recusar um campo que o `openapi.yaml` nem declara para eles.
    expect(camposDeEvolucaoPrevista({ observacao: "Conte por quê." })).toStrictEqual([]);
    expect(camposSemDestino({ ocorrenciaOrigemId: "x" })).toStrictEqual([]);
  });

  it("recusarEvolucaoPrevista estoura com o campo, e passa limpo sem ele", () => {
    expect(() =>
      recusarEvolucaoPrevista({ motivo: "duplicada", observacao: "x", ocorrenciaOrigemId: "y" }),
    ).toThrow(CampoNaoSuportado);

    expect(() => recusarEvolucaoPrevista({ motivo: "duplicada", observacao: "x" })).not.toThrow();
  });

  it("recusarEvolucaoPrevista nomeia o campo em erros[], que é o que o cliente lê", () => {
    const erro = (() => {
      try {
        recusarEvolucaoPrevista({ ocorrenciaOrigemId: "x" });
        return null;
      } catch (causa) {
        return causa as CampoNaoSuportado;
      }
    })();

    expect(erro?.extensoes["erros"]).toStrictEqual([
      { campo: "ocorrenciaOrigemId", codigo: "CAMPO_NAO_SUPORTADO" },
    ]);
  });
});

describe("nomeDoMotivoCancelamento — os sete textos, e o do meio foi trocado de propósito", () => {
  it("dá os QUATRO do protótipo, literais", () => {
    expect(nomeDoMotivoCancelamento("desistencia")).toBe("Desistência");
    expect(nomeDoMotivoCancelamento("resolvido_por_conta_propria")).toBe(
      "Resolvido por conta própria",
    );
    expect(nomeDoMotivoCancelamento("aberta_por_engano")).toBe("Aberta por engano");
    expect(nomeDoMotivoCancelamento("duplicada")).toBe("Duplicada");
  });

  it("dá os TRÊS do Gestor, e nenhum deles diz 'condomínio'", () => {
    // **O rótulo de `fora_de_escopo` foi trocado na resposta do hub:** *"Fora do escopo **da
    // organização**"*, e não *"do condomínio"*. A palavra travaria o produto numa das três formas de
    // Organização, que é o que o `glossario.md:127-130` proíbe em rótulo novo.
    expect(nomeDoMotivoCancelamento("improcedente")).toBe("Improcedente");
    expect(nomeDoMotivoCancelamento("fora_de_escopo")).toBe("Fora do escopo da organização");
    expect(nomeDoMotivoCancelamento("sem_informacao_suficiente")).toBe("Sem informação suficiente");

    for (const motivo of MOTIVOS_DE_CANCELAMENTO) {
      expect(nomeDoMotivoCancelamento(motivo).toLowerCase()).not.toContain("condomínio");
    }
  });
});

describe("opcoesDeMotivoCancelamento — a MESMA fonte que o 422 do servidor consulta", () => {
  const DO_AUTOR = ["ocorrencia.registrar", "ocorrencia.cancelar_propria"];
  const DO_GESTOR = ["ocorrencia.cancelar_propria", "ocorrencia.cancelar_qualquer"];

  it("sem cancelar_qualquer dá QUATRO, na ordem do enum — o critério 18.4 na tela", () => {
    expect(opcoesDeMotivoCancelamento(DO_AUTOR).map((opcao) => opcao.valor)).toStrictEqual([
      "desistencia",
      "resolvido_por_conta_propria",
      "aberta_por_engano",
      "duplicada",
    ]);
  });

  it("com cancelar_qualquer dá SETE, na ordem do enum", () => {
    expect(opcoesDeMotivoCancelamento(DO_GESTOR).map((opcao) => opcao.valor)).toStrictEqual([
      ...MOTIVOS_DE_CANCELAMENTO,
    ]);
  });

  it("os rótulos batem com nomeDoMotivoCancelamento — uma fonte, não duas", () => {
    for (const opcao of opcoesDeMotivoCancelamento(DO_GESTOR)) {
      expect(opcao.rotulo).toBe(nomeDoMotivoCancelamento(opcao.valor as MotivoCancelamento));
    }
  });

  it("só Duplicada tem descrição, e ela pede a outra ocorrência na observação", () => {
    // **A condição é POR OPÇÃO, não por modal** — é o que faz a tela do item 23 não mudar um pixel.
    const comDescricao = opcoesDeMotivoCancelamento(DO_GESTOR).filter(
      (opcao) => opcao.descricao !== undefined,
    );

    expect(comDescricao).toHaveLength(1);
    expect(comDescricao[0]?.valor).toBe("duplicada");
    expect(comDescricao[0]?.descricao).toBe("Diga na observação qual é a outra ocorrência.");
  });

  it("a opção Duplicada do SOLICITANTE também traz a descrição — ela é dele antes de ser do Gestor", () => {
    const duplicada = opcoesDeMotivoCancelamento(DO_AUTOR).find(
      (opcao) => opcao.valor === "duplicada",
    );

    expect(duplicada?.descricao).toBeDefined();
  });

  it("opcoesDeMotivoPausa continua SEM descrição em nenhuma das quatro — a prova de que o 23 não mudou", () => {
    for (const opcao of opcoesDeMotivoPausa()) {
      expect("descricao" in opcao).toBe(false);
    }
  });
});

/**
 * ============================================================================
 *  O `404` que diz em qual organização você está — critério 28.3
 * ============================================================================
 */
describe("o critério 28.3 — o corpo do 404 diz em qual organização você está", () => {
  const RECANTO = { id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", nome: "Condomínio Recanto Azul" };

  it("OCORRENCIA_NAO_ENCONTRADA sai com organizacaoAtiva, ao lado de codigo e traceId", () => {
    const { status, corpo } = problemaDe(
      comOrganizacaoAtiva(new OcorrenciaNaoEncontrada(), RECANTO),
      "/api/ocorrencias/abc",
      "01JB8Z6K9T2M4N7Q",
    );

    expect(status).toBe(404);
    expect(corpo.codigo).toBe("OCORRENCIA_NAO_ENCONTRADA");
    expect(corpo.traceId).toBe("01JB8Z6K9T2M4N7Q");
    // O par exato do `example` do openapi.yaml:2341 — id e nome, e nada de `codigoPublico`.
    expect(corpo.organizacaoAtiva).toStrictEqual(RECANTO);
  });

  it("CATEGORIA_NAO_ENCONTRADA NÃO ganha a extensão — a lista de códigos é fechada", () => {
    const { corpo } = problemaDe(
      comOrganizacaoAtiva(new CategoriaNaoEncontrada(), RECANTO),
      "/api/categorias/abc",
      "01JB8Z6K9T2M4N7Q",
    );

    // O `openapi.yaml` publica o exemplo em UM responsável só. Emitir nos outros cinco seria o código
    // publicando um contrato diferente do versionado — que é o portão do DoD, não um detalhe.
    expect("organizacaoAtiva" in corpo).toBe(false);
  });

  it("sem organização resolvida, nada muda — e é o caso de NaoAutenticado", () => {
    const erro = new OcorrenciaNaoEncontrada();

    expect(comOrganizacaoAtiva(erro, null)).toBe(erro);
  });

  it("o erro original NÃO é mutado: é uma cópia, e ela preserva as extensões que já existiam", () => {
    const original = new OcorrenciaNaoEncontrada();
    const enriquecido = comOrganizacaoAtiva(original, RECANTO);

    expect(original.extensoes).toStrictEqual({});
    expect(enriquecido).not.toBe(original);

    // **O espalhamento `...erro.extensoes`, exercitado de verdade.** `OcorrenciaNaoEncontrada` nasce sem
    // extensão nenhuma e é o único código da lista — então o único jeito de provar que a cópia preserva
    // o que já havia é construir o erro com uma.
    const comErros = comOrganizacaoAtiva(
      new ErroDeDominio("OCORRENCIA_NAO_ENCONTRADA", "Ocorrência não encontrada", "…", {
        erros: [{ campo: "observacao" }],
      }),
      RECANTO,
    ) as ErroDeDominio;

    expect(comErros.extensoes.erros).toBeDefined();
    expect(comErros.extensoes.organizacaoAtiva).toStrictEqual(RECANTO);

    // E o outro lado, de graça: `CampoNaoSuportado` é `422`, está fora da lista, e volta o MESMO objeto.
    const foraDaLista = new CampoNaoSuportado(["observacao"]);
    expect(comOrganizacaoAtiva(foraDaLista, RECANTO)).toBe(foraDaLista);
  });
});

/**
 * ============================================================================
 *  Os dois insumos da estrada direta — a frase e a linha de log
 * ============================================================================
 */
describe("o 404 da estrada direta — a frase e a linha de log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("com nome, a frase é a do inventário, literal", () => {
    expect(ocorrenciaNaoEncontradaEm("Condomínio Recanto Azul")).toBe(
      "Esta ocorrência não existe em Condomínio Recanto Azul.",
    );
  });

  it("sem nome, a frase degrada em vez de mentir — e continua verdadeira", () => {
    // Mesma disciplina do vazio de filtro do item 15: `nomeDaOrganizacao` pode ser nulo, e inventá-lo
    // seria pior. Na prática a página já redirecionou antes; a função não conta com isso.
    expect(ocorrenciaNaoEncontradaEm(null)).toBe("Esta ocorrência não existe nesta organização.");
  });

  it("registrarFalha escreve UMA linha JSON com os quatro campos, e o nome da subclasse", () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => undefined);

    registrarFalha(new OcorrenciaNaoEncontrada(), "/ocorrencias/abc", "GET", "01JB8Z6K9T2M4N7Q");

    expect(espia).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(espia.mock.calls[0]?.[0]))).toStrictEqual({
      traceId: "01JB8Z6K9T2M4N7Q",
      caminho: "/ocorrencias/abc",
      metodo: "GET",
      // **O nome da subclasse sobrevive** — é o que a ordem decidida na tarefa 1 preserva.
      erro: "OcorrenciaNaoEncontrada: OCORRENCIA_NAO_ENCONTRADA: Não há ocorrência com este identificador nesta organização.",
    });
  });
});

describe("projetarEventoDaLinhaDoTempo — os schemas EventoTransicao e EventoAtribuicao", () => {
  const AUTORA = { pessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d", nome: "Marina Rocha" };
  const GESTOR = { pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f", nome: "Roberto Salles" };
  const ENCARREGADO = { pessoaId: "9d3e2f81-0a1b-4c2d-8e3f-4a5b6c7d8e9f", nome: "Antônio Ferreira" };

  it("a transição traz rotulo, e o rotulo é o do glossário — critério 29.2", () => {
    const projetado = projetarEventoDaLinhaDoTempo(
      {
        tipo: "transicao",
        ocorridoEm: "2026-08-15T11:12:00.000Z",
        transicao: {
          sequencia: 1,
          statusAnterior: null,
          statusNovo: "aberta",
          ocorreuEm: "2026-08-15T11:12:00.000Z",
          autor: AUTORA,
          observacao: null,
          motivoPausa: null,
          motivoCancelamento: null,
        },
      },
      "solicitante",
    );

    expect(projetado).toStrictEqual({
      tipo: "transicao",
      ocorridoEm: "2026-08-15T11:12:00.000Z",
      autor: AUTORA,
      rotulo: "Recebida — aguardando análise",
      statusAnterior: null,
      statusNovo: "aberta",
      observacao: null,
      motivoPausa: null,
      motivoCancelamento: null,
    });
    // **`sequencia` NÃO sai** — é ordem interna da trilha, e o `EventoTransicao` do contrato não a tem.
    expect(projetado).not.toHaveProperty("sequencia");
    // E o nome do campo é `ocorridoEm`, nunca `ocorreuEm`: são dois vocabulários de propósito (§8.5).
    expect(projetado).not.toHaveProperty("ocorreuEm");
  });

  it("a pausa traz o motivo DENTRO do rotulo, e os três campos sensíveis saem — critério 29.2", () => {
    const projetado = projetarEventoDaLinhaDoTempo(
      {
        tipo: "transicao",
        ocorridoEm: "2026-08-20T19:40:00.000Z",
        transicao: {
          sequencia: 4,
          statusAnterior: "em_atendimento",
          statusNovo: "pausada",
          ocorreuEm: "2026-08-20T19:40:00.000Z",
          autor: GESTOR,
          observacao: "O material só chega na terça.",
          motivoPausa: "aguardando_peca",
          motivoCancelamento: null,
        },
      },
      "solicitante",
    );

    expect(projetado.tipo === "transicao" && projetado.rotulo).toBe(
      "Parada — esperando material chegar",
    );
    expect(projetado.tipo === "transicao" && projetado.observacao).toBe(
      "O material só chega na terça.",
    );
    expect(projetado.tipo === "transicao" && projetado.motivoPausa).toBe("aguardando_peca");
  });

  /**
   * **O critério 31.7, e ele não é decisão nova — é a descrição do campo.**
   * `docs/api/openapi.yaml:2994-3006`, schema `EventoTransicao`, campo `rotulo`: *"O status em linguagem
   * de gente, conforme quem lê. Em `pausada` ele depende também do motivo: o Solicitante lê 'Parada —
   * esperando material chegar', o Gestor lê 'Pausada'."*
   *
   * **E o motivo NÃO entra no rótulo**: ele viaja no campo `motivoPausa` do próprio evento, que esta
   * projeção já emite. `fraseDaTransicao` continua recebendo o rótulo pronto — nenhuma composição nova.
   */
  it("a pausa lida pelo GESTOR é 'Pausada' seca, e o motivo sai no campo próprio — critério 31.7", () => {
    const evento = {
      tipo: "transicao" as const,
      ocorridoEm: "2026-08-20T19:40:00.000Z",
      transicao: {
        sequencia: 4,
        statusAnterior: "em_atendimento" as const,
        statusNovo: "pausada" as const,
        ocorreuEm: "2026-08-20T19:40:00.000Z",
        autor: GESTOR,
        observacao: "O material só chega na terça.",
        motivoPausa: "aguardando_peca" as const,
        motivoCancelamento: null,
      },
    };

    const paraOGestor = projetarEventoDaLinhaDoTempo(evento, "gestor");
    expect(paraOGestor.tipo === "transicao" && paraOGestor.rotulo).toBe("Pausada");
    expect(paraOGestor.tipo === "transicao" && paraOGestor.motivoPausa).toBe("aguardando_peca");
    // **A palavra do motivo NÃO está dentro do rótulo** — é o achado A-1 da spec, virado asserção: o
    // protótipo desenha "Pausada · aguardando peça", e o glossário, o contrato e o YAML dizem o contrário.
    expect(paraOGestor.tipo === "transicao" && paraOGestor.rotulo).not.toContain("peça");
    expect(paraOGestor.tipo === "transicao" && paraOGestor.rotulo).not.toContain("material");

    const paraOSolicitante = projetarEventoDaLinhaDoTempo(evento, "solicitante");
    expect(paraOSolicitante.tipo === "transicao" && paraOSolicitante.rotulo).toBe(
      "Parada — esperando material chegar",
    );
  });

  it("a criação lida pelo Gestor é 'Aberta', e pelo Solicitante é a frase — critério 31.7", () => {
    const evento = {
      tipo: "transicao" as const,
      ocorridoEm: "2026-08-15T11:12:00.000Z",
      transicao: {
        sequencia: 1,
        statusAnterior: null,
        statusNovo: "aberta" as const,
        ocorreuEm: "2026-08-15T11:12:00.000Z",
        autor: AUTORA,
        observacao: null,
        motivoPausa: null,
        motivoCancelamento: null,
      },
    };

    const doGestor = projetarEventoDaLinhaDoTempo(evento, "gestor");
    expect(doGestor.tipo === "transicao" && doGestor.rotulo).toBe("Aberta");

    const doSolicitante = projetarEventoDaLinhaDoTempo(evento, "solicitante");
    expect(doSolicitante.tipo === "transicao" && doSolicitante.rotulo).toBe(
      "Recebida — aguardando análise",
    );
  });

  it("a atribuição traz responsavel, encerradaEm e motivoEncerramento — critério 29.3", () => {
    const projetado = projetarEventoDaLinhaDoTempo(
      {
        tipo: "atribuicao",
        ocorridoEm: "2026-08-15T12:44:00.000Z",
        atribuicao: {
          responsavel: ENCARREGADO,
          autor: GESTOR,
          atribuidoEm: "2026-08-15T12:44:00.000Z",
          encerradaEm: "2026-08-18T09:00:00.000Z",
          motivoEncerramento: "reatribuicao",
        },
      },
      "solicitante",
    );

    expect(projetado).toStrictEqual({
      tipo: "atribuicao",
      ocorridoEm: "2026-08-15T12:44:00.000Z",
      autor: GESTOR,
      responsavel: ENCARREGADO,
      encerradaEm: "2026-08-18T09:00:00.000Z",
      motivoEncerramento: "reatribuicao",
    });
    // **`atribuidoEm` não sai duas vezes**: a chave de ordenação já é `ocorridoEm`.
    expect(projetado).not.toHaveProperty("atribuidoEm");
  });

  it("a atribuição vigente sai com os dois nulos, e nunca ausentes", () => {
    const projetado = projetarEventoDaLinhaDoTempo(
      {
        tipo: "atribuicao",
        ocorridoEm: "2026-08-18T09:00:00.000Z",
        atribuicao: {
          responsavel: ENCARREGADO,
          autor: GESTOR,
          atribuidoEm: "2026-08-18T09:00:00.000Z",
          encerradaEm: null,
          motivoEncerramento: null,
        },
      },
      "solicitante",
    );

    expect(projetado.tipo === "atribuicao" && projetado.encerradaEm).toBeNull();
    expect(projetado.tipo === "atribuicao" && projetado.motivoEncerramento).toBeNull();
  });

  it("o AUTOR de uma atribuição é quem atribuiu, nunca o responsável — colisão nº 2 do glossário", () => {
    const projetado = projetarEventoDaLinhaDoTempo(
      {
        tipo: "atribuicao",
        ocorridoEm: "2026-08-15T12:44:00.000Z",
        atribuicao: {
          responsavel: ENCARREGADO,
          autor: GESTOR,
          atribuidoEm: "2026-08-15T12:44:00.000Z",
          encerradaEm: null,
          motivoEncerramento: null,
        },
      },
      "solicitante",
    );

    expect(projetado.autor).toStrictEqual(GESTOR);
    expect(projetado.tipo === "atribuicao" && projetado.responsavel).toStrictEqual(ENCARREGADO);
  });
});

describe("o cursor da conversa — dois adaptadores, e nenhuma cópia da validação", () => {
  it("ida e volta preserva o par", () => {
    const cursor = { criadoEm: "2026-08-20T15:00:00.000Z", id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f" };
    expect(decodificarCursorDeConversa(codificarCursorDeConversa(cursor))).toStrictEqual(cursor);
  });

  it("lixo devolve null, e não a primeira página", () => {
    expect(decodificarCursorDeConversa("pagina-2")).toBeNull();
    expect(decodificarCursorDeConversa("")).toBeNull();
  });

  it("data inválida e id que não é uuid são recusados", () => {
    expect(decodificarCursorDeConversa(Buffer.from("ontem|abc", "utf8").toString("base64url"))).toBeNull();
    expect(
      decodificarCursorDeConversa(
        Buffer.from("2026-08-20T15:00:00.000Z|nao-e-uuid", "utf8").toString("base64url"),
      ),
    ).toBeNull();
  });
});

describe("projetarPaginaDeComentarios — o cursor só existe quando há próxima página", () => {
  const mensagem = (id: string, criadoEm: string) => ({
    id,
    texto: "t",
    autor: { pessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d", nome: "Marina Rocha" },
    criadoEm,
  });

  it("com temMais, o cursor é o do ÚLTIMO item devolvido", () => {
    const ultima = mensagem("c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f", "2026-08-20T15:02:00.000Z");
    const projetada = projetarPaginaDeComentarios({
      itens: [mensagem("a1b2c3d4-e5f6-4718-8293-a4b5c6d7e8f9", "2026-08-20T15:00:00.000Z"), ultima],
      temMais: true,
    });

    expect(projetada.proximoCursor).toBe(
      codificarCursorDeConversa({ criadoEm: ultima.criadoEm, id: ultima.id }),
    );
  });

  it("sem temMais, proximoCursor é null", () => {
    const projetada = projetarPaginaDeComentarios({
      itens: [mensagem("a1b2c3d4-e5f6-4718-8293-a4b5c6d7e8f9", "2026-08-20T15:00:00.000Z")],
      temMais: false,
    });
    expect(projetada.proximoCursor).toBeNull();
  });

  it("página vazia com temMais falso não inventa cursor", () => {
    expect(projetarPaginaDeComentarios({ itens: [], temMais: false }).proximoCursor).toBeNull();
  });

  it("o item projetado tem os QUATRO campos do schema Comentario, e nada mais", () => {
    const projetada = projetarPaginaDeComentarios({
      itens: [mensagem("a1b2c3d4-e5f6-4718-8293-a4b5c6d7e8f9", "2026-08-20T15:00:00.000Z")],
      temMais: false,
    });
    expect(Object.keys(projetada.itens[0] ?? {}).sort()).toStrictEqual([
      "autor",
      "criadoEm",
      "id",
      "texto",
    ]);
  });
});

describe("comentarioSchema — 1 a 4000, aparado num lugar só", () => {
  it("apara antes de checar: texto só de espaços é recusado", () => {
    expect(comentarioSchema.safeParse({ texto: "   " }).success).toBe(false);
  });

  it("acima de 4000 é recusado, e 4000 passa", () => {
    expect(comentarioSchema.safeParse({ texto: "a".repeat(4001) }).success).toBe(false);
    expect(comentarioSchema.safeParse({ texto: "a".repeat(4000) }).success).toBe(true);
  });

  it("o valor que sai vem APARADO — quem apara é o schema", () => {
    const lido = comentarioSchema.parse({ texto: "  a lâmpada foi trocada  " });
    expect(lido.texto).toBe("a lâmpada foi trocada");
  });
});

describe("as duas frases da conversa escolhem por AUTORIA, não por papel — critério 30.4", () => {
  it("o Solicitante autor lê «falar com os Gestores»", () => {
    expect(vazioDaConversa(true)).toBe(
      "Nenhuma mensagem ainda. Escreva aqui para falar com os Gestores.",
    );
    expect(rotuloDoCampoDeConversa(true)).toBe("Escrever para os Gestores");
  });

  it("o Gestor NÃO autor lê «falar com o Solicitante» — a população inteira do risco do 30.4", () => {
    expect(vazioDaConversa(false)).toBe(
      "Nenhuma mensagem ainda. Escreva aqui para falar com o Solicitante.",
    );
    expect(rotuloDoCampoDeConversa(false)).toBe("Escrever para o Solicitante");
  });

  it("o Gestor AUTOR — o síndico morador do 28.5 — lê a frase do autor, e é a razão de ser da decisão", () => {
    // Por permissão ele leria "…falar com o Solicitante", dirigido a ele mesmo: falso nas duas metades,
    // nomeando quem não está e omitindo quem está. Por autoria ele lê "…os Gestores", e ali isso é FATO —
    // participantes são Gestores + autor (critério 30.2); se o autor é Gestor, o conjunto SÃO os Gestores.
    expect(vazioDaConversa(true)).toContain("os Gestores");
    expect(rotuloDoCampoDeConversa(true)).toBe("Escrever para os Gestores");
  });

  it("as duas frases são diferentes, e é a diferença que o critério 30.4 protege", () => {
    expect(vazioDaConversa(true)).not.toBe(vazioDaConversa(false));
    expect(rotuloDoCampoDeConversa(true)).not.toBe(rotuloDoCampoDeConversa(false));
  });
});

describe("enviarComentario — a irmã sem o ramo do 409", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no 201, devolve o comentário inteiro — é ele que a lista local acrescenta", async () => {
    const criado = {
      id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
      texto: "A lâmpada nova já foi instalada.",
      autor: { pessoaId: "8f14e45f-ceea-467a-9f1e-3a1b2c4d5e6f", nome: "Roberto Salles" },
      criadoEm: "2026-08-20T15:00:00.000Z",
    };

    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      expect(url).toBe("/api/ocorrencias/abc/comentarios");
      expect(init.method).toBe("POST");
      // A afirmação de organização do item 7b cobre a décima primeira escrita de cliente.
      expect(init.headers).toMatchObject(cabecalhosDeEscrita("organizacao-a"));
      expect(JSON.parse(String(init.body))).toStrictEqual({ texto: criado.texto });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(criado) });
    });

    expect(await enviarComentario("abc", criado.texto, "organizacao-a")).toStrictEqual({
      ok: true,
      comentario: criado,
    });
  });

  it("num problema com detail, o aviso é o detail", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ codigo: "FORMATO_INVALIDO", detail: "Escreva a mensagem." }),
      }),
    );

    expect(await enviarComentario("abc", "", "organizacao-a")).toStrictEqual({
      ok: false,
      aviso: "Escreva a mensagem.",
    });
  });

  it("sem detail, cai na frase genérica", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }));
    expect(await enviarComentario("abc", "oi", "organizacao-a")).toStrictEqual({
      ok: false,
      aviso: MENSAGEM_GENERICA,
    });
  });

  it("rede caída não sobe para o Error Boundary — nuvem sem SLA", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("rede")));
    expect(await enviarComentario("abc", "oi", "organizacao-a")).toStrictEqual({
      ok: false,
      aviso: MENSAGEM_GENERICA,
    });
  });
});

/**
 * ============================================================================
 *  O critério 20.6 — a busca por nome do modal de atribuição
 * ============================================================================
 *
 * **É a única metade desta fatia que tem teste**, e a razão está na §3.12 da spec: o produto não tem
 * biblioteca de teste de componente React, então o que ficasse dentro do `.tsx` não seria conferível por
 * máquina nenhuma. O que está aqui é a decisão; o JSX que a consome vai para o roteiro de validação.
 */
describe("o critério 20.6 — normalizar, casar por prefixo de palavra e repartir", () => {
  const candidato = (pessoaId: string, nome: string, papel: string): Candidato => ({
    pessoaId,
    nome,
    papel,
    area: null,
  });

  const HELENA = candidato("p-1", "Helena Prado", "Gestor");
  const MARIA = candidato("p-2", "Maria Silva", "Encarregado");
  const MARIANA = candidato("p-3", "Mariana Costa", "Solicitante");
  const ANA_SILVA = candidato("p-4", "Ana Silva", "Solicitante");
  const ANA_RIBEIRO = candidato("p-5", "Ana Ribeiro", "Solicitante");
  const JOAO = candidato("p-6", "João Pedro", "Solicitante");

  const TODOS = [HELENA, MARIA, MARIANA, ANA_SILVA, ANA_RIBEIRO, JOAO] as const;

  it("normalizarParaBusca tira acento, caixa, borda e espaço repetido", () => {
    expect(normalizarParaBusca("JOSÉ")).toBe("jose");
    expect(normalizarParaBusca("  Conceição  ")).toBe("conceicao");
    expect(normalizarParaBusca("Ana   Maria")).toBe("ana maria");
  });

  it("termosDaBusca devolve lista vazia para branco e para só-espaços", () => {
    expect(termosDaBusca("")).toStrictEqual([]);
    // O caso que a guarda `normalizada === ""` existe para acertar: sem ela isto seria `[""]`, um termo
    // que casaria tudo por acidente em vez de por regra.
    expect(termosDaBusca("   ")).toStrictEqual([]);
    expect(termosDaBusca("  ana   s ")).toStrictEqual(["ana", "s"]);
  });

  it("casa por prefixo de PALAVRA, e não do nome inteiro — sobrenome é como se procura gente", () => {
    expect(casaPeloNome("Maria Silva", termosDaBusca("silva"))).toBe(true);
  });

  it("casa por PREFIXO, e não por pedaço — `ana` não acha `Mariana`", () => {
    expect(casaPeloNome("Mariana Costa", termosDaBusca("ana"))).toBe(false);
    expect(casaPeloNome("Ana Silva", termosDaBusca("ana"))).toBe(true);
  });

  it("acento não separa os dois lados — nem quem digita, nem quem é digitado", () => {
    expect(casaPeloNome("João Pedro", termosDaBusca("joao"))).toBe(true);
    expect(casaPeloNome("Joao Pedro", termosDaBusca("joão"))).toBe(true);
    expect(casaPeloNome("Maria Silva", termosDaBusca("SILVA"))).toBe(true);
  });

  it("com vários termos, TODOS precisam casar", () => {
    expect(casaPeloNome("Ana Silva", termosDaBusca("ana s"))).toBe(true);
    expect(casaPeloNome("Ana Ribeiro", termosDaBusca("ana s"))).toBe(false);
  });

  it("filtrarPorNome com busca em branco devolve a lista inteira, NA MESMA ORDEM", () => {
    // A ordem é a de `order by p.nome` do repositório, e é a mesma de T-08. Filtrar não reordena.
    expect(filtrarPorNome(TODOS, "")).toStrictEqual(TODOS);
    expect(filtrarPorNome(TODOS, "   ")).toStrictEqual(TODOS);
  });

  it("filtrarPorNome preserva a ordem do que sobra", () => {
    expect(filtrarPorNome(TODOS, "ana")).toStrictEqual([ANA_SILVA, ANA_RIBEIRO]);
  });

  it("repartirCandidatos tira quem chama dos DOIS blocos e o devolve em `eu`", () => {
    const { eu, executores, solicitantes } = repartirCandidatos(TODOS, "p-1");

    expect(eu).toStrictEqual(HELENA);
    // Dois controles enviando o mesmo `pessoaId` é o que a §3.3 existe para impedir.
    expect(executores).toStrictEqual([MARIA]);
    expect(solicitantes).toStrictEqual([MARIANA, ANA_SILVA, ANA_RIBEIRO, JOAO]);
  });

  it("quem chama ausente da lista: `eu` é null e os dois blocos ficam íntegros", () => {
    // Hoje inalcançável — `podeAtribuir` exige `vinculo.gerir` e a lista é a dos vínculos ativos —, e é o
    // caso de borda da §3.4: sem `eu`, a fileira não renderiza e o modal continua sendo o do item 19.
    const { eu, executores, solicitantes } = repartirCandidatos(TODOS, "p-ausente");

    expect(eu).toBeNull();
    expect(executores).toStrictEqual([HELENA, MARIA]);
    expect(solicitantes).toStrictEqual([MARIANA, ANA_SILVA, ANA_RIBEIRO, JOAO]);
  });

  it("a repartição preserva a ordem DENTRO de cada bloco", () => {
    const invertidos = [ANA_RIBEIRO, ANA_SILVA, MARIA, HELENA] as const;
    const { executores, solicitantes } = repartirCandidatos(invertidos, "p-ausente");

    expect(executores).toStrictEqual([MARIA, HELENA]);
    expect(solicitantes).toStrictEqual([ANA_RIBEIRO, ANA_SILVA]);
  });

  it("a palavra que separa os blocos é `Solicitante`, e ela vem do PAPEL_EM_PALAVRA de T-05", () => {
    // O acoplamento existe desde o item 19 (a constante `PAPEL_SOLICITANTE` de `busca-de-candidatos.ts`,
    // que o `ModalDeAtribuicao` usa para repartir os blocos) e nada aqui o conserta.
    // O que muda é que ele passa a ter teste: se `PAPEL_EM_PALAVRA` mudar a palavra, este caso cai.
    const so = [candidato("p-9", "Quem Quer", "Solicitante")] as const;

    expect(repartirCandidatos(so, "p-ausente").solicitantes).toHaveLength(1);
    expect(repartirCandidatos(so, "p-ausente").executores).toHaveLength(0);
  });
});

describe("o carimbo da trilha de auditoria — com segundos, e no fuso escrito", () => {
  it("mostra dia, mês, ano e hora com segundos, em America/Sao_Paulo", () => {
    // 12h14:02 UTC em agosto é 09h14:02 em São Paulo (UTC-3, sem horário de verão desde 2019).
    // **O separador é ` · `** — a regra de data de 16/09/2026, e o critério 44n.14. Os segundos são a
    // exceção declarada ao `dd/mm/aaaa · hh:mm` do guia: numa trilha, o segundo é a prova da ordem.
    expect(dataHoraComSegundos("2026-08-03T12:14:02.000Z")).toBe("03/08/2026 · 09:14:02");
  });

  it("meia-noite é 00, nunca 24 — é o `hourCycle: h23`", () => {
    expect(dataHoraComSegundos("2026-08-04T03:00:00.000Z")).toBe("04/08/2026 · 00:00:00");
  });

  it("vira o dia com o fuso, e não com o UTC", () => {
    // 02h30 UTC de 05/08 ainda é 23h30 de 04/08 em São Paulo. Uma trilha que erra o dia prova o
    // contrário do que aconteceu.
    expect(dataHoraComSegundos("2026-08-05T02:30:00.000Z")).toBe("04/08/2026 · 23:30:00");
  });

  it("o campo vazio é o travessão do protótipo, escrito uma vez", () => {
    // **Sem consumidor de tela desde o 44n** — os dois nadas viraram frase (critério 44n.4). A constante
    // fica, e é o achado A5 da spec: apagá-la é de quem inventariar exportação sem consumidor.
    expect(CAMPO_VAZIO).toBe("—");
  });
});

describe("a leitura do ciclo — critérios 44d.2 e 44d.7", () => {
  it("recém-criada: o primeiro passo é o atual, e os três seguintes esperam", () => {
    const leitura = lerOCiclo([{ status: "aberta", em: "15/08/2026, 09h40" }], "aberta");

    expect(leitura.passos.map((passo) => passo.estado)).toEqual([
      "atual",
      "por-alcancar",
      "por-alcancar",
      "por-alcancar",
    ]);
    expect(leitura.passos[0]?.em).toBe("15/08/2026, 09h40");
    expect(leitura.passos[1]?.em).toBeNull();
    expect(leitura.foraDaLinha).toBeNull();
  });

  it("resolvida: os quatro têm data, e o último é o atual", () => {
    const leitura = lerOCiclo(
      [
        { status: "aberta", em: "15/08, 09h40" },
        { status: "em_analise", em: "15/08, 10h10" },
        { status: "em_atendimento", em: "16/08, 08h00" },
        { status: "resolvida", em: "17/08, 17h30" },
      ],
      "resolvida",
    );

    expect(leitura.passos.map((passo) => passo.estado)).toEqual([
      "alcancado",
      "alcancado",
      "alcancado",
      "atual",
    ]);
    expect(leitura.foraDaLinha).toBeNull();
  });

  it("pausada NÃO consome etapa: o ciclo não anda e não recua", () => {
    const leitura = lerOCiclo(
      [
        { status: "aberta", em: "15/08, 09h40" },
        { status: "em_analise", em: "15/08, 10h10" },
      ],
      "pausada",
    );

    // Nenhum passo é `atual`: `pausada` não está no ciclo, e o que foi alcançado continua alcançado.
    expect(leitura.passos.map((passo) => passo.estado)).toEqual([
      "alcancado",
      "alcancado",
      "por-alcancar",
      "por-alcancar",
    ]);
    expect(leitura.foraDaLinha).toEqual({ status: "pausada", depoisDe: "em_analise" });
  });

  it("cancelada é saída: o que não foi alcançado vira INALCANÇÁVEL, não pendente", () => {
    const leitura = lerOCiclo([{ status: "aberta", em: "15/08, 09h40" }], "cancelada");

    // A diferença com o caso da pausa é o ponto do critério 7: prometer "por alcançar" a quem não vai
    // alcançar é a tela mentindo.
    expect(leitura.passos.map((passo) => passo.estado)).toEqual([
      "alcancado",
      "inalcancavel",
      "inalcancavel",
      "inalcancavel",
    ]);
    expect(leitura.foraDaLinha).toEqual({ status: "cancelada", depoisDe: "aberta" });
  });

  it("retomada: o passo guarda a PRIMEIRA vez em que foi alcançado", () => {
    const leitura = lerOCiclo(
      [
        { status: "aberta", em: "15/08, 09h40" },
        { status: "em_analise", em: "15/08, 10h10" },
        { status: "em_atendimento", em: "16/08, 08h00" },
        { status: "pausada", em: "16/08, 11h00" },
        { status: "em_atendimento", em: "18/08, 09h00" },
      ],
      "em_atendimento",
    );

    // A segunda passagem por `em_atendimento` não reescreve a data: o ciclo conta quando se chegou,
    // não quando se voltou. E `pausada` não vira passo — o que se prova pelo ESTADO dos quatro, e não
    // pela lista de nomes, que é sempre `CICLO` qualquer que seja a lógica.
    expect(leitura.passos[2]?.em).toBe("16/08, 08h00");
    expect(leitura.passos.map((passo) => passo.estado)).toEqual([
      "alcancado",
      "alcancado",
      "atual",
      "por-alcancar",
    ]);
    expect(leitura.foraDaLinha).toBeNull();
  });

  it("o status atual sem transição registrada é ATUAL, e nunca pendente", () => {
    // A premissa P1 faz o registro da criação nascer com a ocorrência, então isto não deve acontecer.
    // O ramo existe por honestidade: se acontecer, a régua marca onde a ocorrência está em vez de dizer
    // que o passo em que ela está ainda não veio.
    const leitura = lerOCiclo([{ status: "aberta", em: "15/08, 09h40" }], "em_atendimento");

    expect(leitura.passos[2]?.estado).toBe("atual");
    expect(leitura.passos[2]?.em).toBeNull();
    expect(leitura.passos[1]?.estado).toBe("por-alcancar");
    expect(leitura.foraDaLinha).toBeNull();
  });
});

describe("errosDoRegistro — os quatro obrigatórios de T-04 (critério 44l.7)", () => {
  const cheio: ValoresDoRegistro = {
    titulo: "Infiltração no teto da garagem",
    descricao: "Água pingando perto da vaga 12 quando chove.",
    categoriaId: "cat-1",
    areaId: "area-1",
    localizacaoComplemento: "",
  };

  it("com tudo preenchido, nenhum erro", () => {
    expect(errosDoRegistro(cheio)).toStrictEqual({});
  });

  it("cada obrigatório vazio tem a sua frase, e ela diz o que fazer", () => {
    expect(errosDoRegistro(VALORES_VAZIOS)).toStrictEqual({
      titulo: "Dê um título à ocorrência.",
      descricao: "Descreva o que aconteceu, em uma frase.",
      categoriaId: "Escolha uma categoria.",
      areaId: "Escolha onde aconteceu.",
    });
  });

  it("só espaço não vale, nos dois campos de texto", () => {
    const erros = errosDoRegistro({ ...cheio, titulo: "   ", descricao: "\n \t" });
    expect(erros.titulo).toBe("Dê um título à ocorrência.");
    expect(erros.descricao).toBe("Descreva o que aconteceu, em uma frase.");
  });

  it("a referência do lugar vazia nunca é erro — ela não é obrigatória", () => {
    expect(errosDoRegistro({ ...cheio, localizacaoComplemento: "" }).localizacaoComplemento).toBeUndefined();
  });
});

describe("temAlgoEscrito — o que faz o cancelar perguntar (critério 44l.9)", () => {
  it("nada escrito e sem foto: não pergunta", () => {
    expect(temAlgoEscrito(VALORES_VAZIOS, false)).toBe(false);
  });

  it("só espaço em branco não conta como escrito", () => {
    expect(temAlgoEscrito({ ...VALORES_VAZIOS, titulo: "   " }, false)).toBe(false);
  });

  it("qualquer um dos cinco campos conta", () => {
    for (const campo of [
      "titulo",
      "descricao",
      "categoriaId",
      "areaId",
      "localizacaoComplemento",
    ] as const) {
      expect(temAlgoEscrito({ ...VALORES_VAZIOS, [campo]: "x" }, false), campo).toBe(true);
    }
  });

  it("a foto conta sozinha — escolher, esperar subir e cancelar descartava sem perguntar", () => {
    expect(temAlgoEscrito(VALORES_VAZIOS, true)).toBe(true);
  });
});

describe("vazioDoRegistro — as três faltas, e o botão só para quem configura (critério 44l.13)", () => {
  it("sem áreas, quem configura vê o caminho para a lista que falta", () => {
    const vazio = vazioDoRegistro(["areas"], true);
    expect(vazio.titulo).toBe("Esta organização não tem áreas ativas.");
    expect(vazio.corpo).toContain("Reative ao menos uma");
    expect(vazio.acao).toStrictEqual({ href: "/configuracao/areas", rotulo: "Ir para Áreas" });
  });

  it("sem categorias, o mesmo, apontando para a outra lista", () => {
    const vazio = vazioDoRegistro(["categorias"], true);
    expect(vazio.titulo).toBe("Esta organização não tem categorias ativas.");
    expect(vazio.acao).toStrictEqual({ href: "/configuracao/categorias", rotulo: "Ir para Categorias" });
  });

  it("faltando as duas, não há lista privilegiada e o destino é o índice", () => {
    const vazio = vazioDoRegistro(["categorias", "areas"], true);
    expect(vazio.titulo).toBe("Esta organização não tem categorias nem áreas ativas.");
    expect(vazio.acao).toStrictEqual({ href: "/configuracao", rotulo: "Ir para a configuração" });
  });

  it("quem NÃO configura lê a mesma primeira frase, 'Fale com um Gestor.' e nenhum botão", () => {
    for (const faltando of [["areas"], ["categorias"], ["categorias", "areas"]] as const) {
      const com = vazioDoRegistro(faltando, true);
      const sem = vazioDoRegistro(faltando, false);
      expect(sem.titulo).toBe(com.titulo);
      expect(sem.corpo).toBe("Fale com um Gestor.");
      // O botão e a segunda frase andam juntos: oferecer o caminho a quem não pode percorrê-lo é o
      // beco que o item 44h passou inteiro tirando do produto.
      expect(sem.acao).toBeNull();
    }
  });
});

describe("rotuloDoTipoDeArea — a palavra que vai ao lado de cada área", () => {
  it("os dois tipos, em palavra, nunca só por cor (compromisso A-5)", () => {
    expect(rotuloDoTipoDeArea("comum")).toBe("área comum");
    expect(rotuloDoTipoDeArea("privativa")).toBe("unidade privativa");
  });
});

describe("as áreas usadas no aparelho — critério 44l.4", () => {
  const ativas = [
    { id: "a1", nome: "Garagem" },
    { id: "a2", nome: "Hall de entrada" },
    { id: "a3", nome: "Salão de festas" },
    { id: "a4", nome: "Elevador social" },
  ];

  it("a lista guardada é reordenada SOBRE as ativas que acabaram de chegar", () => {
    expect(areasUsadas(["a3", "a1"], ativas).map((a) => a.id)).toStrictEqual(["a3", "a1"]);
  });

  it("guardada que não está mais entre as ativas simplesmente some — área desativada não aparece", () => {
    expect(areasUsadas(["a9", "a2"], ativas).map((a) => a.id)).toStrictEqual(["a2"]);
  });

  it("o areaId de outra organização não casa, e some pela mesma porta", () => {
    expect(areasUsadas(["de-outro-lugar"], ativas)).toStrictEqual([]);
  });

  it("aparecem no máximo três, embora se guardem seis", () => {
    expect(areasUsadas(["a4", "a3", "a2", "a1"], ativas).map((a) => a.id)).toStrictEqual([
      "a4",
      "a3",
      "a2",
    ]);
  });

  it("lista guardada vazia devolve vazio, e o bloco não desenha", () => {
    expect(areasUsadas([], ativas)).toStrictEqual([]);
  });

  it("a nova vai para a frente", () => {
    expect(comAreaUsada(["a1", "a2"], "a3")).toStrictEqual(["a3", "a1", "a2"]);
  });

  it("repetida não duplica, e sobe", () => {
    expect(comAreaUsada(["a1", "a2", "a3"], "a3")).toStrictEqual(["a3", "a1", "a2"]);
  });

  it("o teto de seis corta a mais antiga", () => {
    expect(comAreaUsada(["1", "2", "3", "4", "5", "6"], "7")).toStrictEqual([
      "7",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });
});

/**
 * ============================================================================
 *  Os quatro desfechos do controle de foto — o critério 51.8
 * ============================================================================
 *
 * **É a guarda que faltava no V-12.** O encadeamento à mão terminava na frase de tamanho, e como o
 * `500` não traz `detail` (`docs/api/openapi.yaml`, resposta `ErroInterno`), todo erro de servidor era
 * anunciado como *"a foto ficou grande demais"* — inclusive um JPEG de 160 bytes.
 *
 * **O produto não tem biblioteca de teste de componente React**, e não ganha uma aqui: a decisão mora numa
 * função com teste, que é a mesma forma dos itens 20 e 21.
 */
describe("os quatro desfechos do controle de foto — critério 51.8", () => {
  it("500 sem detail diz a frase honesta", () => {
    const corpo = { status: 500, codigo: "ERRO_INTERNO", traceId: "01M30RAB4B5Y3VRN5GJKZK6CCB" };
    expect(mensagemDoProblema(corpo, FRASES_DA_FOTO)).toBe(FOTO.naoSubiu);
  });

  it("e a frase de tamanho NÃO aparece quando o servidor não manda o código dela", () => {
    const corpo = { status: 500, codigo: "ERRO_INTERNO", traceId: "01M30RAB4B5Y3VRN5GJKZK6CCB" };
    expect(mensagemDoProblema(corpo, FRASES_DA_FOTO)).not.toBe(
      FRASES_DO_SERVIDOR.ANEXO_ACIMA_DO_LIMITE,
    );
  });

  it("o código de tamanho diz a frase de tamanho, e a prefere ao detail do servidor", () => {
    const corpo = {
      status: 422,
      codigo: "ANEXO_ACIMA_DO_LIMITE",
      detail: "o objeto tem 900000 bytes, acima do que a autorização carimbou",
    };
    expect(mensagemDoProblema(corpo, FRASES_DA_FOTO)).toBe(
      FRASES_DO_SERVIDOR.ANEXO_ACIMA_DO_LIMITE,
    );
  });

  it("429 diz a frase do limite", () => {
    const corpo = { status: 429, codigo: "LIMITE_DE_AUTORIZACOES_DE_UPLOAD" };
    expect(mensagemDoProblema(corpo, FRASES_DA_FOTO)).toBe(
      FRASES_DO_SERVIDOR.LIMITE_DE_AUTORIZACOES_DE_UPLOAD,
    );
  });

  it("409 com detail mostra o texto do servidor — é a decisão do item 7b, e ela sobrevive", () => {
    const daAbaEsquecida = "Esta aba está em outra organização. Recarregue a página antes de continuar.";
    const corpo = { status: 409, codigo: "ORGANIZACAO_DIVERGENTE", detail: daAbaEsquecida };
    expect(mensagemDoProblema(corpo, FRASES_DA_FOTO)).toBe(daAbaEsquecida);
  });
});

/**
 * ============================================================================
 *  O aviso do registro, e a foto que não foi junto — o critério 51.9
 * ============================================================================
 *
 * **O DG-5 continua valendo:** foto vazia ou falhada manda sem anexo, e isso é desfecho legítimo. O que
 * muda é o silêncio. Quem escolheu uma foto, viu vermelho e registrou ficava sem saber se ela foi.
 *
 * **Segurar o registro foi recusado na spec**: transformaria indisponibilidade de armazenamento em
 * indisponibilidade de registrar ocorrência, que é a capacidade central do enunciado.
 */
describe("o aviso do registro — critério 51.9", () => {
  it("sem foto nenhuma, é o aviso de sucesso de sempre", () => {
    expect(avisoDoRegistro("vazio", false)).toStrictEqual({
      forma: "sucesso",
      titulo: TEXTOS_DO_REGISTRO.sucesso,
    });
  });

  it("com a foto pronta, é o aviso de sucesso de sempre", () => {
    expect(avisoDoRegistro("pronta", true)).toStrictEqual({
      forma: "sucesso",
      titulo: TEXTOS_DO_REGISTRO.sucesso,
    });
  });

  it("com a foto falhada, avisa que a ocorrência foi sem ela", () => {
    expect(avisoDoRegistro("falhou", false)).toStrictEqual({
      forma: "atencao",
      titulo: TEXTOS_DO_REGISTRO.semFoto,
      descricao: TEXTOS_DO_REGISTRO.semFotoApoio,
    });
  });

  it("subindo e a promessa não entregou referência, avisa igual", () => {
    expect(avisoDoRegistro("subindo", false)).toStrictEqual({
      forma: "atencao",
      titulo: TEXTOS_DO_REGISTRO.semFoto,
      descricao: TEXTOS_DO_REGISTRO.semFotoApoio,
    });
  });

  it("o aviso de atenção fica até ser fechado, e é por isso que ele não é um sucesso comum", () => {
    // `router.replace` leva a pessoa para T-05 no mesmo instante. Um aviso de quatro segundos numa tela
    // que acabou de trocar é um aviso que ninguém leu.
    expect(avisoDoRegistro("falhou", false).forma).toBe("atencao");
  });
});

describe("o que o item 66 acrescenta às frases de T-05", () => {
  it("o caminho corta o título em 40 caracteres, com reticências contadas", () => {
    expect(encurtarParaOCaminho("Vazamento no teto")).toBe("Vazamento no teto");
    expect(encurtarParaOCaminho("a".repeat(40))).toBe("a".repeat(40));
    expect(encurtarParaOCaminho("a".repeat(41))).toBe(`${"a".repeat(39)}…`);
    expect(Array.from(encurtarParaOCaminho("x".repeat(150)))).toHaveLength(40);
  });

  it("o espaço antes do corte não fica pendurado antes das reticências", () => {
    expect(encurtarParaOCaminho(`${"a".repeat(38)} bcd`)).toBe(`${"a".repeat(38)}…`);
  });

  it("o aviso de avaliação não contém o que o ponta a ponta procura sem escopo", () => {
    for (const proibida of ["Situação", "Nota", "Sua avaliação", "Avaliar"]) {
      expect(AVISO_DE_AVALIACAO).not.toContain(proibida);
    }
  });
});

/**
 * **Critérios 76.3 e 76.4 — a lista tem uma forma só, e o convite a avaliar não mora nela.** Avaliar
 * acontece só na página da ocorrência, na faixa do item 66. As guardas são de ausência: é o que o
 * critério pede, e um convite que voltasse por engano voltaria em silêncio.
 */
describe("a lista, uma forma nos dois recortes (item 76)", () => {
  const LISTA = "src/interface/componentes/lista-de-ocorrencias.tsx";

  it("não há desenho próprio para «Minhas ocorrências» (critério 76.3)", () => {
    const fonte = lerFonte(LISTA);
    expect(fonte).not.toContain("LinhaDoSolicitante");
    expect(fonte).not.toContain('visibilidadeAplicada === "apenas_minhas"');
  });

  it("o convite a avaliar e a porta pelo endereço saíram (critério 76.4)", () => {
    for (const caminho of [
      LISTA,
      "src/interface/componentes/rotulos.ts",
      "src/interface/componentes/modal-de-avaliacao.tsx",
      "src/interface/ganchos/use-envio-do-modal.ts",
      "app/(casca)/ocorrencias/page.tsx",
    ]) {
      const fonte = lerFonte(caminho);
      expect(fonte, caminho).not.toMatch(
        /CONVITE_A_AVALIAR|convidaAAvaliar|ConviteAAvaliar|destinoDaAvaliacao|abreAvaliacaoPeloEndereco|abrirAoCarregar|abertoAoMontar|acao=avaliar|pessoaIdDeQuemLe/u,
      );
    }
  });

  /**
   * **T-05 fica fora do laço de cima**, porque `pessoaIdDeQuemLe` continua existindo lá com outro sentido:
   * é quem lê a conversa, em `conversa-da-ocorrencia.tsx`.
   */
  it("T-05 não lê mais a ação pelo endereço (critério 76.4)", () => {
    const fonte = lerFonte("app/(casca)/ocorrencias/[ocorrenciaId]/page.tsx");
    expect(fonte).not.toMatch(/abreAvaliacaoPeloEndereco|abrirAoCarregar|searchParams/u);
  });
});

describe("a nota em estrelas — critério 76.5", () => {
  it("as cinco opções, com as pontas nomeadas e o meio em número", () => {
    expect(NOTAS_DA_AVALIACAO.map((nota) => nomeDaNota(nota.valor))).toStrictEqual([
      "1, muito ruim",
      "2",
      "3",
      "4",
      "5, muito bom",
    ]);
  });

  it("o texto ao lado das estrelas diz a nota em palavra, e as pontas pelo nome (A-5)", () => {
    expect(textoDaNota(null)).toBe("Escolha de 1 a 5");
    expect(textoDaNota(1)).toBe("1 de 5, muito ruim");
    expect(textoDaNota(3)).toBe("3 de 5");
    expect(textoDaNota(5)).toBe("5 de 5, muito bom");
  });

  it("continua sendo um grupo de rádios de verdade, e nada foi instalado", () => {
    const modal = lerFonte("src/interface/componentes/modal-de-avaliacao.tsx");
    expect(modal).toContain('type="radio"');
    expect(modal).toContain("name={grupoId}");
    expect(modal).toContain("<Star");
    expect(modal).toContain('className="peer sr-only"');
    // O rótulo acessível é texto dentro do `<label>`, e não `aria-label`: é a mesma marcação do item 18.
    expect(modal).toContain('<span className="sr-only">{nomeDaNota(opcao.valor)}</span>');
    expect(existsSync(`${RAIZ}src/interface/componentes/ui/rating.tsx`)).toBe(false);
  });
});

/**
 * ============================================================================
 *  87.2 · A leitura muda num lugar só, e nenhuma permissão nasce
 * ============================================================================
 *
 * **O critério 2 do item 87 é sobre onde o conceito mora, e é por isso que o teste lê fonte.** Um teste
 * de comportamento não distingue *"o compartilhamento entra na leitura num lugar"* de *"entra em sete"*:
 * os dois passariam. O que ele prende é a estrutura, e a estrutura é o que a decisão protege.
 */
describe("87.2 · a leitura muda num lugar só, e nenhuma permissão nasce", () => {
  // **O fim de linha é normalizado:** no clone Windows os `.ts` saem com CRLF, e procurar `"\n}\n"` cru
  // devolveria -1.
  const fonte = lerFonte("src/aplicacao/ocorrencia/consultas.ts").replace(/\r\n/gu, "\n");
  const corpoDe = (nome: string) => {
    const inicio = fonte.indexOf(`export function ${nome}(`);
    const fim = fonte.indexOf("\n}\n", inicio);
    expect(inicio, nome).toBeGreaterThanOrEqual(0);
    expect(fim, nome).toBeGreaterThan(inicio);
    return fonte.slice(inicio, fim);
  };

  it("o enum de permissões continua com dezoito, e nenhuma fala de compartilhar", () => {
    expect(PERMISSOES).toHaveLength(18);
    expect(PERMISSOES.some((p) => p.includes("compartilh"))).toBe(false);
  });

  it("o compartilhamento entra em podeLerOcorrencia e não em participaDaOcorrencia", () => {
    expect(corpoDe("podeLerOcorrencia")).toMatch(/compartilhamentos/u);
    expect(corpoDe("participaDaOcorrencia")).not.toMatch(/compartilh/u);
  });

  it("nenhuma rota repete a regra em linha", () => {
    const rotas = globSync("app/**/*.{ts,tsx}", { cwd: RAIZ });
    expect(rotas.length).toBeGreaterThan(0);
    for (const rota of rotas) {
      expect(lerFonte(rota), rota).not.toMatch(/autor\.pessoaId !== ctx\.pessoaId/u);
    }
  });
});

/**
 * ============================================================================
 *  87 · A fronteira HTTP do compartilhamento
 * ============================================================================
 */
describe("87 · a fronteira HTTP do compartilhamento", () => {
  it("a busca exige 2 letras depois de aparar, e recusa acima de 120", () => {
    expect(() => lerBuscaDeCandidatosDaUrl(new URLSearchParams("busca=%20a%20"))).toThrow(
      FormatoInvalido,
    );
    expect(lerBuscaDeCandidatosDaUrl(new URLSearchParams("busca=%20an%20"))).toBe("an");
    expect(() =>
      lerBuscaDeCandidatosDaUrl(new URLSearchParams(`busca=${"a".repeat(121)}`)),
    ).toThrow(FormatoInvalido);
  });

  const AUTORA_87 = "00000000-0000-4000-8000-0000000000b1";
  const VIZINHA = "00000000-0000-4000-8000-0000000000b2";
  const SOLICITANTE_87 = [
    "ocorrencia.registrar",
    "ocorrencia.ler_propria",
    "ocorrencia.comentar",
    "ocorrencia.cancelar_propria",
    "ocorrencia.avaliar",
  ];

  it("o detalhe dá a lista a quem participa, e só a faixa a quem recebeu", () => {
    const lida: OcorrenciaLida = {
      ...umaOcorrenciaLidaCom([]),
      autor: { pessoaId: AUTORA_87, nome: "Ana" },
      compartilhamentos: [
        {
          com: { pessoaId: VIZINHA, nome: "Bia", papel: "solicitante" },
          por: { pessoaId: AUTORA_87, nome: "Ana", papel: "solicitante" },
          compartilhadoEm: "2026-09-26T12:00:00.000Z",
        },
      ],
    };
    const daAutora = projetarOcorrenciaDetalhe(lida, {
      pessoaId: AUTORA_87,
      permissoes: SOLICITANTE_87,
    });
    expect(daAutora.compartilhamento).toMatchObject({
      tipo: "gestao",
      pessoas: [{ podeDesfazer: true }],
    });

    const daVizinha = projetarOcorrenciaDetalhe(lida, {
      pessoaId: VIZINHA,
      permissoes: SOLICITANTE_87,
    });
    expect(daVizinha.compartilhamento).toStrictEqual({
      tipo: "recebida",
      por: { nome: "Ana", papel: "solicitante" },
      compartilhadoEm: "2026-09-26T12:00:00.000Z",
    });
    // A lista não viaja para quem recebeu: ela nomeia outros vizinhos.
    expect(JSON.stringify(daVizinha)).not.toContain(VIZINHA);
    expect(daVizinha.acoesDisponiveis).toStrictEqual([]);
  });
});

describe("87 · a aba na URL e o vazio dela", () => {
  it("?compartilhadas=comigo vira o recorte; outro valor e a mistura com ?autor=eu são 400", () => {
    expect(
      lerFiltroDeOcorrenciasDaUrl(new URLSearchParams("compartilhadas=comigo")),
    ).toStrictEqual({ compartilhadasComigo: true });
    expect(() =>
      lerFiltroDeOcorrenciasDaUrl(new URLSearchParams("compartilhadas=todas")),
    ).toThrow(FormatoInvalido);
    expect(() =>
      lerFiltroDeOcorrenciasDaUrl(new URLSearchParams("compartilhadas=comigo&autor=eu")),
    ).toThrow(FormatoInvalido);
  });

  it("a aba não conta como filtro, e Limpar filtros a preserva", () => {
    expect(algumFiltroAplicado({ compartilhadasComigo: true })).toBe(false);
    expect(semFiltros("compartilhadas=comigo&status=aberta&pagina=3").get("compartilhadas")).toBe(
      "comigo",
    );
  });

  it("o vazio da aba é o dela, e filtro aplicado continua ganhando", () => {
    expect(vazioDaLista("compartilhadas_comigo", false)).toBe("compartilhadas");
    expect(TEXTO_DO_VAZIO.compartilhadas).toStrictEqual({
      titulo: "Nada foi compartilhado com você.",
      corpo: null,
    });
    expect(vazioDaLista("compartilhadas_comigo", true)).toBe("filtro");
  });
});

/**
 * ============================================================================
 *  87.7 · O recorte de quem não tem `ler_todas`
 * ============================================================================
 *
 * **O que estas funções existem para conferir é a decisão, e não a redação.** Qual conjunto de opções cada
 * vínculo recebe, e o que cada escolha escreve na URL, são as duas coisas que o `.tsx` não tem como provar
 * — ele roda no navegador, e o produto não tem biblioteca de teste de componente.
 */
describe("87.7 · o recorte de quem não tem ler_todas", () => {
  it("sem ler_todas: Minhas e Compartilhadas, nesta ordem, sem número", () => {
    expect(opcoesDoRecorte(false)).toStrictEqual([
      { valor: "minhas", rotulo: "Minhas ocorrências", contagem: null },
      { valor: "compartilhadas", rotulo: "Compartilhadas comigo", contagem: null },
    ]);
  });

  it("com ler_todas: Todas e Minhas, com número, e sem a terceira", () => {
    expect(opcoesDoRecorte(true).map((o) => o.valor)).toStrictEqual(["todas", "minhas"]);
    expect(opcoesDoRecorte(true).every((o) => o.contagem !== null)).toBe(true);
  });

  it("o valor marcado sai do que o servidor aplicou", () => {
    expect(valorDoRecorte("todas")).toBe("todas");
    expect(valorDoRecorte("apenas_minhas")).toBe("minhas");
    expect(valorDoRecorte("compartilhadas_comigo")).toBe("compartilhadas");
  });

  it("trocar para compartilhadas liga o parâmetro e descarta a página; voltar o tira sem ligar autor", () => {
    const ida = consultaDoRecorte(
      "pagina=3&ate=x&totalNoCorte=9&status=aberta",
      "compartilhadas",
      false,
    );
    expect(ida.get("compartilhadas")).toBe("comigo");
    expect(ida.has("pagina")).toBe(false);
    expect(ida.has("ate")).toBe(false);
    expect(ida.has("totalNoCorte")).toBe(false);
    // O recorte de status sobrevive: trocar de aba não é limpar filtro.
    expect(ida.get("status")).toBe("aberta");

    const volta = consultaDoRecorte(ida.toString(), "minhas", false);
    expect(volta.has("compartilhadas")).toBe(false);
    expect(volta.has("autor")).toBe(false);
  });

  it("o Gestor em Minhas continua ligando ?autor=eu", () => {
    expect(consultaDoRecorte("", "minhas", true).get("autor")).toBe("eu");
    expect(consultaDoRecorte("autor=eu", "todas", true).has("autor")).toBe(false);
  });
});
