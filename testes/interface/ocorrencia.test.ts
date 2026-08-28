import { describe, expect, it } from "vitest";

import type { AnexoLido, OcorrenciaLida, OcorrenciaResumoLida } from "@/aplicacao/ocorrencia";
import { COMANDOS_IMPLEMENTADOS, STATUS } from "@/dominio/ocorrencia";
import {
  codificarCursor,
  decodificarCursor,
  descricaoDoRecorte,
  nomeDaPrioridade,
  nomeDoStatus,
  projetarAnexo,
  projetarOcorrenciaDetalhe,
  projetarOcorrenciaResumo,
  projetarPaginaDeOcorrencias,
} from "@/interface/projecoes";
import {
  CorpoNaoSuportado,
  FormatoInvalido,
  lerCorpoOpcional,
  lerCursorDaUrl,
  lerFiltroDeOcorrenciasDaUrl,
  lerLimiteDaUrl,
  lerVarianteDaUrl,
  type ErroDeCampo,
} from "@/interface/http";
import {
  nomesDeStatus,
  rotuloDeComando,
  rotulosDeStatus,
} from "@/interface/componentes/rotulos";
import { tempoCurto, tempoRelativo } from "@/interface/componentes/tempo-relativo";
import { TEXTO_DO_VAZIO, vazioDaLista } from "@/interface/componentes/vazio-da-lista";
import {
  camposEscritosPeloServidor,
  comandoComObservacaoSchema,
  registroDeOcorrenciaSchema,
} from "@/interface/schemas";

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
  motivoPausa: null,
  registradaEm: "2026-08-20T13:02:11.000Z",
  atualizadaEm: "2026-08-20T14:10:00.000Z",
};

describe("o OcorrenciaResumo projetado", () => {
  it("traz os treze campos do contrato, e categoria SEM icone (critério 14.6)", () => {
    const resumo = projetarOcorrenciaResumo(RESUMO_LIDO);

    expect(resumo.categoria).toStrictEqual({
      id: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
      nome: "Problemas de iluminação",
    });
    expect(resumo.categoria).not.toHaveProperty("icone");
    expect(resumo).not.toHaveProperty("descricao");
    expect(resumo).not.toHaveProperty("acoesDisponiveis");
  });

  it("statusRotulo é o rótulo de gente, nunca o enum cru", () => {
    expect(projetarOcorrenciaResumo(RESUMO_LIDO).statusRotulo).toBe("Recebida — aguardando análise");
  });

  it("motivoPausa é nulo fora de pausada, e é o motivo dentro dela", () => {
    expect(projetarOcorrenciaResumo(RESUMO_LIDO).motivoPausa).toBeNull();

    const pausada = projetarOcorrenciaResumo({
      ...RESUMO_LIDO,
      status: "pausada",
      motivoPausa: "aguardando_peca",
    });
    expect(pausada.motivoPausa).toBe("aguardando_peca");
    expect(pausada.statusRotulo).toBe("Parada — esperando material chegar");
  });

  it("quantidadeDeAnexos vem do repositório; responsavel continua forçado — item 19", () => {
    const resumo = projetarOcorrenciaResumo(RESUMO_LIDO);
    expect(resumo.quantidadeDeAnexos).toBe(0);
    expect(resumo.responsavel).toBeNull();
    // **A asserção que torna o caso útil.** Com o campo vindo do repositório, provar que ele sai `0`
    // quando entra `0` não prova nada; o que prova é o REPASSE.
    expect(projetarOcorrenciaResumo({ ...RESUMO_LIDO, quantidadeDeAnexos: 3 }).quantidadeDeAnexos).toBe(
      3,
    );
  });
});

describe("o envelope da página", () => {
  it("com temMais, proximoCursor é o do ÚLTIMO item devolvido", () => {
    const envelope = projetarPaginaDeOcorrencias({
      itens: [RESUMO_LIDO],
      temMais: true,
      visibilidadeAplicada: "todas",
    });

    expect(envelope.visibilidadeAplicada).toBe("todas");
    expect(decodificarCursor(envelope.proximoCursor!)).toStrictEqual({
      registradaEm: RESUMO_LIDO.registradaEm,
      id: RESUMO_LIDO.id,
    });
  });

  it("sem temMais, proximoCursor é nulo — e nunca abre uma página vazia", () => {
    const envelope = projetarPaginaDeOcorrencias({
      itens: [RESUMO_LIDO],
      temMais: false,
      visibilidadeAplicada: "apenas_minhas",
    });

    expect(envelope.proximoCursor).toBeNull();
  });

  it("página vazia com temMais impossível: sem itens, não há cursor", () => {
    const envelope = projetarPaginaDeOcorrencias({
      itens: [],
      temMais: true,
      visibilidadeAplicada: "todas",
    });

    expect(envelope.itens).toStrictEqual([]);
    expect(envelope.proximoCursor).toBeNull();
  });

  it("não há total no envelope — o contrato §7.7 o recusou", () => {
    const envelope = projetarPaginaDeOcorrencias({
      itens: [RESUMO_LIDO],
      temMais: false,
      visibilidadeAplicada: "todas",
    });

    expect(envelope).not.toHaveProperty("total");
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

describe("os dois parâmetros de GET /ocorrencias", () => {
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
      expect(() => lerLimiteDaUrl(pedido(`?limite=${valor}`))).toThrowError(/FORMATO_INVALIDO|inválid/iu);
    },
  );

  it("cursor ausente é null", () => {
    expect(lerCursorDaUrl(pedido(""))).toBeNull();
  });

  it("cursor legível volta como par", () => {
    const codificado = codificarCursor({
      registradaEm: "2026-08-20T13:02:11.000Z",
      id: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
    });

    expect(lerCursorDaUrl(pedido(`?cursor=${encodeURIComponent(codificado)}`))).toStrictEqual({
      registradaEm: "2026-08-20T13:02:11.000Z",
      id: "9a1f2b3c-4d5e-6f70-8192-a3b4c5d6e7f8",
    });
  });

  it("cursor ilegível é 400, não a primeira página", () => {
    expect(() => lerCursorDaUrl(pedido("?cursor=pagina-2"))).toThrowError(/FORMATO_INVALIDO|inválid/iu);
  });
});

/**
 * **O critério 14.4 é sobre não trocar uma frase pela outra**, e a troca é uma decisão — não uma
 * redação. Por isso a decisão é uma função pura com os três ramos cobertos, mesmo com o terceiro só
 * ficando alcançável no item 15.
 */
describe("qual dos três vazios a tela mostra", () => {
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

  it("as três frases são diferentes entre si", () => {
    const titulos = Object.values(TEXTO_DO_VAZIO).map((texto) => texto.titulo);
    expect(new Set(titulos).size).toBe(3);
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
      projetarOcorrenciaResumo({ ...RESUMO_LIDO, quantidadeDeAnexos: 1 }).quantidadeDeAnexos,
    ).toBe(1);
  });

  it("sem anexo, o detalhe traz `[]` e `0` — nunca `null`", () => {
    const projetado = projetarOcorrenciaDetalhe(umaOcorrenciaLidaCom([]), QUEM_LE);
    expect(projetado.anexos).toStrictEqual([]);
    expect(projetado.quantidadeDeAnexos).toBe(0);
  });
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
});

describe("o critério 15.6 — a descrição do recorte, para o subtítulo do vazio", () => {
  const nomeDaCategoria = (id: string) => (id === "c-1" ? "Iluminação" : undefined);

  it("sem filtro nenhum, não há o que descrever", () => {
    expect(descricaoDoRecorte({}, nomeDaCategoria)).toStrictEqual([]);
  });

  it("cada dimensão vira uma cláusula com o MESMO rótulo do chip", () => {
    expect(
      descricaoDoRecorte({ status: ["pausada"], prioridade: ["alta"] }, nomeDaCategoria),
    ).toStrictEqual(["Status: Pausada", "Prioridade: Alta"]);
  });

  it("dois valores na mesma dimensão viram uma cláusula só, com os dois", () => {
    expect(descricaoDoRecorte({ status: ["aberta", "em_analise"] }, nomeDaCategoria)).toStrictEqual([
      "Status: Aberta, Em análise",
    ]);
  });

  it("categoria desconhecida não vira texto inventado", () => {
    expect(descricaoDoRecorte({ categoriaId: ["c-9"] }, nomeDaCategoria)).toStrictEqual([
      "Categoria: 1 selecionado",
    ]);
  });

  it("só as minhas é uma cláusula como as outras", () => {
    expect(descricaoDoRecorte({ apenasDoAutor: true }, nomeDaCategoria)).toStrictEqual([
      "Só as minhas",
    ]);
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
});

describe("os rótulos que descem para a barra de ações", () => {
  it("todo comando implementado tem rótulo — senão a barra some sem dizer nada", () => {
    // **É o alarme da tarefa 6 para os itens 17 a 27:** quem acrescentar um comando a
    // `COMANDOS_IMPLEMENTADOS` e esquecer o rótulo faria a barra renderizar nada, em silêncio.
    for (const comando of COMANDOS_IMPLEMENTADOS) {
      expect(rotuloDeComando(comando)).not.toBeNull();
    }
  });

  it("comando ainda não construído não tem rótulo, e é assim que a barra o ignora", () => {
    expect(rotuloDeComando("resolver")).toBeNull();
  });

  it("analisar é palavra, não ícone — compromisso A-5", () => {
    expect(rotuloDeComando("analisar")).toBe("Analisar");
  });

  it("os seis status têm rótulo do Solicitante e nome de Gestor — nenhum buraco", () => {
    const rotulos = rotulosDeStatus();
    const nomes = nomesDeStatus();

    for (const status of STATUS) {
      expect(typeof rotulos[status]).toBe("string");
      expect(typeof nomes[status]).toBe("string");
    }

    // A frase do `409` usa a coluna do Solicitante — "agora ela está Parada" —, e `pausada` degrada
    // para a palavra sozinha, porque um erro não carrega motivo de pausa.
    expect(rotulos.pausada).toBe("Parada");
    expect(rotulos.em_analise).toBe("Em análise");

    // O bloco Histórico usa a coluna do Gestor: ela é SUBSTANTIVO, e sobrevive dentro de "De X para Y".
    expect(nomes.aberta).toBe("Aberta");
    expect(nomes.em_analise).toBe("Em análise");
  });
});
