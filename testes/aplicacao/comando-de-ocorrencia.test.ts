import { beforeEach, describe, expect, it } from "vitest";

import {
  analisarOcorrencia,
  atribuirResponsavel,
  iniciarAtendimento,
  OcorrenciaNaoEncontrada,
  resolverOcorrencia,
  ResponsavelNaoAtribuido,
  ResponsavelSemVinculoAtivo,
  TransicaoNaoPermitida,
  type OcorrenciaCarregada,
  type OcorrenciaLida,
  type RepositorioEscopadoDeOcorrencias,
  type ResultadoDaAtribuicao,
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
  "ocorrencia.iniciar_atendimento",
  "ocorrencia.resolver",
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
    solucaoAplicada: null,
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
    /**
     * **O duplo TRANSCREVE, como o repositório de verdade transcreve.** Era `null` chumbado, e a partir
     * do item 26 isso seria mentira: `resolver` grava a coluna, e um duplo que sempre devolvesse `null`
     * faria o caso *"com solução aplicada"* passar provando o contrário do que promete.
     */
    solucaoAplicada: agregado.solucaoAplicada,
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
let atribuidos: { ocorrenciaId: string; dados: unknown }[];

function repositorio(opcoes: {
  /** O que cada `carregar` devolve, na ordem; o último valor se repete. */
  cargas: readonly (Ocorrencia | null)[];
  /**
   * Se há atribuição vigente — o fato que o envelope de `carregar` passou a carregar (item 22).
   * **Padrão `false`**, que é o mundo do item 19: nenhuma das cargas deste arquivo tem responsável.
   */
  temResponsavel?: boolean;
  conflito?: boolean;
  /** O que `atribuirResponsavel` responde. Padrão: atribuída, sem reatribuição. */
  atribuicao?: (agregado: Ocorrencia) => ResultadoDaAtribuicao;
}): RepositorioEscopadoDeOcorrencias {
  let chamada = 0;
  let ultimaCarga: Ocorrencia | null = null;

  return {
    carregar: async (): Promise<OcorrenciaCarregada | null> => {
      const carga = opcoes.cargas[Math.min(chamada, opcoes.cargas.length - 1)] ?? null;
      chamada += 1;
      carregados.push(carga);
      ultimaCarga = carga;
      // **O duplo transcreve o envelope, como o repositório de verdade transcreve o agregado.**
      return carga === null
        ? null
        : { ocorrencia: carga, temResponsavel: opcoes.temResponsavel ?? false };
    },
    aplicarTransicao: async (_id: string, ocorrencia: Ocorrencia): Promise<ResultadoDaTransicao> => {
      aplicados.push(ocorrencia);
      return opcoes.conflito === true
        ? { desfecho: "conflito" }
        : { desfecho: "aplicada", ocorrencia: lidaDe(ocorrencia) };
    },
    atribuirResponsavel: async (
      ocorrenciaId: string,
      dados: unknown,
    ): Promise<ResultadoDaAtribuicao> => {
      atribuidos.push({ ocorrenciaId, dados });
      const agregado = ultimaCarga;
      if (agregado === null) throw new Error("o duplo foi chamado sem carga — teste mal montado");
      return opcoes.atribuicao === undefined
        ? { desfecho: "atribuida", reatribuicao: false, ocorrencia: lidaDe(agregado) }
        : opcoes.atribuicao(agregado);
    },
  } as unknown as RepositorioEscopadoDeOcorrencias;
}

beforeEach(() => {
  carregados = [];
  aplicados = [];
  atribuidos = [];
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
    // **Era `[]` até o item 19, e passou a nomear o que ainda dá para fazer.** `COMANDOS_IMPLEMENTADOS`
    // ganhou `atribuir-responsavel`, que é admitido em `em_analise` — então a recusa de `analisar` agora
    // devolve a única ação que sobrou para este Gestor. É a mesma mudança dos três casos de
    // `testes/dominio/ocorrencia.test.ts`, e o critério 16.3 fica **mais** satisfeito: ele pede que o
    // campo exista e diga a verdade, não que ele seja vazio.
    expect(recusa.extensoes["acoesDisponiveis"]).toStrictEqual(["atribuir-responsavel"]);

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

/**
 * ============================================================================
 *  `atribuirResponsavel` — o primeiro comando que NÃO transiciona
 * ============================================================================
 *
 * **Nada aqui atravessa o agregado, e é decisão** (spec §3.1): `Ocorrencia` não ganha método `atribuir`.
 * A invariante 9 está classificada como *"do comando de aplicação, porque atravessa outra tabela"*, e
 * *"um responsável ativo por ocorrência"* é garantia de **classe B** — o banco a opera, o domínio não a
 * garante. O agregado é lido só para responder duas perguntas: *existe e eu alcanço?* e *este estado
 * admite este comando?*
 */
describe("atribuirResponsavel", () => {
  const ctx = { pessoaId: GESTOR, permissoes: DO_GESTOR, agora: "2026-08-28T14:05:00.000Z" };
  const ZELADOR = "3d7c1e92-8a4b-4f5c-9d6e-1a2b3c4d5e6f";

  it("caminho feliz: delega com o instante lido UMA vez, e devolve reatribuicao false — critério 19.1", async () => {
    const resultado = await atribuirResponsavel(repositorio({ cargas: [agregadoEm("aberta")] }), ctx, {
      ocorrenciaId: ID,
      responsavelPessoaId: ZELADOR,
    });

    expect(atribuidos).toHaveLength(1);
    expect(atribuidos[0]!.ocorrenciaId).toBe(ID);
    expect(atribuidos[0]!.dados).toStrictEqual({
      responsavelPessoaId: ZELADOR,
      // **Quem atribuiu é quem CHAMOU**, nunca o autor da ocorrência e nunca um campo do corpo.
      atribuidoPorPessoaId: GESTOR,
      em: "2026-08-28T14:05:00.000Z",
    });

    expect(resultado.reatribuicao).toBe(false);
    // **Nada foi aplicado no agregado** — é a metade negativa do critério 19.4, no nível da aplicação.
    expect(aplicados).toHaveLength(0);
  });

  it("reatribuição devolve true, e é o mesmo caminho — critério 21.1", async () => {
    const resultado = await atribuirResponsavel(
      repositorio({
        cargas: [agregadoEm("em_analise")],
        atribuicao: (agregado) => ({
          desfecho: "atribuida",
          reatribuicao: true,
          ocorrencia: lidaDe(agregado),
        }),
      }),
      ctx,
      { ocorrenciaId: ID, responsavelPessoaId: ZELADOR },
    );

    expect(resultado.reatribuicao).toBe(true);
  });

  it.each(["resolvida", "cancelada"] as const)(
    "%s recusa com 409, COM statusAtual e acoesDisponiveis, e nada é escrito — critério 19.2",
    async (terminal) => {
      const erro = await atribuirResponsavel(repositorio({ cargas: [agregadoEm(terminal)] }), ctx, {
        ocorrenciaId: ID,
        responsavelPessoaId: ZELADOR,
      }).catch((causa: unknown) => causa);

      expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
      const recusa = erro as TransicaoNaoPermitida;
      expect(recusa.codigo).toBe("TRANSICAO_NAO_PERMITIDA");
      // **Acesso por índice**, como os casos de `analisarOcorrencia` deste mesmo arquivo já fazem:
      // `extensoes` é `Readonly<Record<string, unknown>>`, e o `tsconfig` deste projeto exige o colchete.
      expect(recusa.extensoes["statusAtual"]).toBe(terminal);
      expect(recusa.extensoes["acoesDisponiveis"]).toStrictEqual([]);

      // **A recusa acontece ANTES da porta** — nenhuma escrita foi tentada.
      expect(atribuidos).toHaveLength(0);
    },
  );

  it.each(["aberta", "em_analise", "em_atendimento", "pausada"] as const)(
    "%s admite o comando — os quatro estados do critério 19.2",
    async (status) => {
      await atribuirResponsavel(repositorio({ cargas: [agregadoEm(status)] }), ctx, {
        ocorrenciaId: ID,
        responsavelPessoaId: ZELADOR,
      });

      expect(atribuidos).toHaveLength(1);
    },
  );

  it("desfecho de vínculo inativo vira ResponsavelSemVinculoAtivo — critério 19.3", async () => {
    const erro = await atribuirResponsavel(
      repositorio({
        cargas: [agregadoEm("aberta")],
        atribuicao: () => ({ desfecho: "responsavel-sem-vinculo-ativo" }),
      }),
      ctx,
      { ocorrenciaId: ID, responsavelPessoaId: ZELADOR },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(ResponsavelSemVinculoAtivo);
    expect((erro as ResponsavelSemVinculoAtivo).codigo).toBe("RESPONSAVEL_SEM_VINCULO_ATIVO");
  });

  it("conflito relê o estado e vira 409 — a corrida entre dois Gestores", async () => {
    // **O `23505` na constraint `atribuicoes_vigente_uk`**: dois Gestores atribuindo ao mesmo tempo. A
    // segunda leitura é o que faz `statusAtual` dizer onde a ocorrência está AGORA.
    const erro = await atribuirResponsavel(
      repositorio({
        cargas: [agregadoEm("aberta"), agregadoEm("cancelada")],
        atribuicao: () => ({ desfecho: "conflito" }),
      }),
      ctx,
      { ocorrenciaId: ID, responsavelPessoaId: ZELADOR },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    expect((erro as TransicaoNaoPermitida).extensoes["statusAtual"]).toBe("cancelada");
    expect(carregados).toHaveLength(2);
  });

  it("ocorrência inexistente nesta organização vira 404, e nada é escrito", async () => {
    await expect(
      atribuirResponsavel(repositorio({ cargas: [null] }), ctx, {
        ocorrenciaId: ID,
        responsavelPessoaId: ZELADOR,
      }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(atribuidos).toHaveLength(0);
  });

  it("quem não alcança a ocorrência recebe o MESMO 404 — §6.3", async () => {
    // Redundante hoje: quem tem `ocorrencia.atribuir` tem `ocorrencia.ler_todas` no mesmo papel. Roda
    // mesmo assim, porque amarrar uma à outra por coincidência de mapa é o acoplamento que some quando o
    // mapa muda (contrato §4.5).
    const semLerTodas = {
      pessoaId: GESTOR,
      permissoes: ["ocorrencia.atribuir", "ocorrencia.ler_propria"],
    };

    await expect(
      atribuirResponsavel(repositorio({ cargas: [agregadoEm("aberta")] }), semLerTodas, {
        ocorrenciaId: ID,
        responsavelPessoaId: ZELADOR,
      }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(atribuidos).toHaveLength(0);
  });
});

/**
 * ============================================================================
 *  `iniciarAtendimento` — a primeira recusa do produto que não olha `status`
 * ============================================================================
 *
 * **Duas recusas de `409` no mesmo comando**, e a ordem entre elas é do contrato: o exemplo
 * `semResponsavel` do `openapi.yaml` traz `statusAtual: "em_analise"`, quer dizer que para chegar naquele
 * erro a ocorrência **já passou** pela conferência de estado.
 */
describe("iniciarAtendimento", () => {
  const ctx = { pessoaId: GESTOR, permissoes: DO_GESTOR, agora: "2026-08-28T15:20:00.000Z" };

  it("caminho feliz: o agregado ATRAVESSADO chega ao repositório em em_atendimento — critério 22.1", async () => {
    const lida = await iniciarAtendimento(
      repositorio({ cargas: [agregadoEm("em_analise")], temResponsavel: true }),
      ctx,
      { ocorrenciaId: ID, observacao: "O Zelador começa amanhã." },
    );

    const gravado = aplicados[0]!;
    expect(gravado.status).toBe("em_atendimento");
    expect(gravado.trilha).toHaveLength(2);
    expect(gravado.ultimaTransicao.statusAnterior).toBe("em_analise");
    expect(gravado.ultimaTransicao.autorPessoaId).toBe(GESTOR);
    expect(gravado.ultimaTransicao.ocorreuEm).toBe("2026-08-28T15:20:00.000Z");
    expect(gravado.ultimaTransicao.observacao).toBe("O Zelador começa amanhã.");

    expect(lida.status).toBe("em_atendimento");
  });

  it("observação em branco vira null — string vazia não entra numa trilha append-only", async () => {
    await iniciarAtendimento(
      repositorio({ cargas: [agregadoEm("em_analise")], temResponsavel: true }),
      ctx,
      { ocorrenciaId: ID, observacao: "   " },
    );

    expect(aplicados[0]!.ultimaTransicao.observacao).toBeNull();
  });

  it("SEM responsável: 409 RESPONSAVEL_NAO_ATRIBUIDO, e aplicarTransicao NÃO é chamado — critério 22.2", async () => {
    const erro = await iniciarAtendimento(
      repositorio({ cargas: [agregadoEm("em_analise")], temResponsavel: false }),
      ctx,
      { ocorrenciaId: ID },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(ResponsavelNaoAtribuido);
    const recusa = erro as ResponsavelNaoAtribuido;
    expect(recusa.codigo).toBe("RESPONSAVEL_NAO_ATRIBUIDO");
    // **Os textos são os do `openapi.yaml`, literais** — `detail` publicado é contrato.
    expect(recusa.titulo).toBe("Ninguém atribuído");
    expect(recusa.detalhe).toBe("Atribua um responsável antes de iniciar o atendimento.");
    // **As DUAS extensões, como o exemplo mostra.**
    expect(recusa.extensoes["statusAtual"]).toBe("em_analise");
    expect(recusa.extensoes["acoesDisponiveis"]).toStrictEqual(["atribuir-responsavel"]);

    // **Nenhum registro é criado** — e é estrutural: o `insert` só existe dentro de `aplicarTransicao`.
    expect(aplicados).toHaveLength(0);
  });

  it("fora de em_analise: 409 TRANSICAO_NAO_PERMITIDA, COM as duas extensões — critério 22.4", async () => {
    for (const status of ["aberta", "em_atendimento", "pausada", "resolvida", "cancelada"] as const) {
      aplicados = [];
      const erro = await iniciarAtendimento(
        repositorio({ cargas: [agregadoEm(status)], temResponsavel: true }),
        ctx,
        { ocorrenciaId: ID },
      ).catch((causa: unknown) => causa);

      expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
      expect((erro as TransicaoNaoPermitida).extensoes["statusAtual"]).toBe(status);
      expect(aplicados).toHaveLength(0);
    }
  });

  it("status errado E sem responsável dá TRANSICAO_NAO_PERMITIDA — a ordem é a do contrato", async () => {
    // O exemplo `semResponsavel` do `openapi.yaml` traz `statusAtual: "em_analise"`: para chegar nele, a
    // ocorrência já passou pela conferência de estado. Conferir o responsável antes contaria, a quem o
    // comando ia recusar de qualquer jeito, um fato sobre a organização.
    const erro = await iniciarAtendimento(
      repositorio({ cargas: [agregadoEm("aberta")], temResponsavel: false }),
      ctx,
      { ocorrenciaId: ID },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    expect(erro).not.toBeInstanceOf(ResponsavelNaoAtribuido);
  });

  it("ocorrência inexistente nesta organização vira 404, e nada é gravado", async () => {
    await expect(
      iniciarAtendimento(repositorio({ cargas: [null] }), ctx, { ocorrenciaId: ID }),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(aplicados).toHaveLength(0);
  });

  it("quem não alcança a ocorrência recebe o MESMO 404 — §6.3", async () => {
    const semLerTodas = {
      pessoaId: GESTOR,
      permissoes: ["ocorrencia.iniciar_atendimento", "ocorrencia.ler_propria"],
    };

    await expect(
      iniciarAtendimento(
        repositorio({ cargas: [agregadoEm("em_analise")], temResponsavel: true }),
        semLerTodas,
        { ocorrenciaId: ID },
      ),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);

    expect(aplicados).toHaveLength(0);
  });

  it("a corrida entre dois Gestores: conflito vira 409 com o status que de fato está lá agora", async () => {
    const erro = await iniciarAtendimento(
      repositorio({
        cargas: [agregadoEm("em_analise"), agregadoEm("em_atendimento")],
        temResponsavel: true,
        conflito: true,
      }),
      ctx,
      { ocorrenciaId: ID },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    expect((erro as TransicaoNaoPermitida).extensoes["statusAtual"]).toBe("em_atendimento");
    // Duas leituras: a de entrada e a releitura do conflito.
    expect(carregados).toHaveLength(2);
  });

  it("conflito com a ocorrência sumindo na releitura degrada para 404, não para 500", async () => {
    await expect(
      iniciarAtendimento(
        repositorio({ cargas: [agregadoEm("em_analise"), null], temResponsavel: true, conflito: true }),
        ctx,
        { ocorrenciaId: ID },
      ),
    ).rejects.toBeInstanceOf(OcorrenciaNaoEncontrada);
  });
});

describe("resolverOcorrencia", () => {
  const ctx = { pessoaId: GESTOR, permissoes: DO_GESTOR, agora: "2026-08-29T10:05:00.000Z" };

  it("caminho feliz: o agregado ATRAVESSADO chega ao repositório em resolvida, com dois registros", async () => {
    const lida = await resolverOcorrencia(
      repositorio({ cargas: [agregadoEm("em_atendimento")] }),
      ctx,
      { ocorrenciaId: ID, observacao: "Conferido com a moradora." },
    );

    // **O que o duplo recebeu**, e é o que prova que o comando atravessou o agregado: se ele montasse um
    // DTO, o `status` do que chega ao repositório sumiria em vez de continuar certo por acidente.
    expect(aplicados).toHaveLength(1);
    expect(aplicados[0]!.status).toBe("resolvida");
    expect(aplicados[0]!.trilha).toHaveLength(2);
    expect(aplicados[0]!.ultimaTransicao.statusAnterior).toBe("em_atendimento");
    expect(aplicados[0]!.ultimaTransicao.observacao).toBe("Conferido com a moradora.");
    // **O instante é o do contexto**, lido uma vez, e não `new Date()` de dentro do comando.
    expect(aplicados[0]!.ultimaTransicao.ocorreuEm).toBe("2026-08-29T10:05:00.000Z");
    expect(lida.status).toBe("resolvida");
  });

  it("com solucaoAplicada, o texto chega ao repositório DENTRO do agregado", async () => {
    const lida = await resolverOcorrencia(
      repositorio({ cargas: [agregadoEm("em_atendimento")] }),
      ctx,
      { ocorrenciaId: ID, solucaoAplicada: "Trocada a lâmpada da vaga 34." },
    );

    // **Dentro do agregado, e não ao lado dele** — é a §3.3 da spec: `aplicarTransicao` transcreve o que
    // o agregado decidiu, e não recebe extras por fora.
    expect(aplicados[0]!.solucaoAplicada).toBe("Trocada a lâmpada da vaga 34.");
    expect(lida.solucaoAplicada).toBe("Trocada a lâmpada da vaga 34.");
  });

  it("sem solucaoAplicada, nada é escrito na coluna — e um registro só é criado", async () => {
    await resolverOcorrencia(repositorio({ cargas: [agregadoEm("em_atendimento")] }), ctx, {
      ocorrenciaId: ID,
    });

    expect(aplicados[0]!.solucaoAplicada).toBeNull();
    // **Um registro de transição, nunca dois** — é a metade do critério 25.3 e a invariante 2.
    expect(aplicados[0]!.trilha).toHaveLength(2);
  });

  it("os dois campos em branco viram null — string vazia numa trilha append-only é ruído", async () => {
    await resolverOcorrencia(repositorio({ cargas: [agregadoEm("em_atendimento")] }), ctx, {
      ocorrenciaId: ID,
      observacao: "   ",
      solucaoAplicada: "   ",
    });

    expect(aplicados[0]!.ultimaTransicao.observacao).toBeNull();
    // **Vazio é AUSENTE, não apagamento** — o agregado o trata como *não informado* e preserva.
    expect(aplicados[0]!.solucaoAplicada).toBeNull();
  });

  it("fora de em_atendimento dá 409 TRANSICAO_NAO_PERMITIDA, com statusAtual e acoesDisponiveis", async () => {
    for (const status of ["aberta", "em_analise", "pausada", "resolvida", "cancelada"] as const) {
      aplicados = [];

      const erro = await resolverOcorrencia(repositorio({ cargas: [agregadoEm(status)] }), ctx, {
        ocorrenciaId: ID,
      }).catch((causa: unknown) => causa);

      expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
      expect((erro as TransicaoNaoPermitida).extensoes["statusAtual"]).toBe(status);
      expect((erro as TransicaoNaoPermitida).extensoes["acoesDisponiveis"]).toBeDefined();
      // **Nenhum registro é criado na recusa** — critério 26.2, e é estrutural: o `insert` só existe
      // dentro de `aplicarTransicao`.
      expect(aplicados).toHaveLength(0);
    }
  });

  it("o segundo resolver na mesma ocorrência é o mesmo 409 — a máquina é a chave de idempotência", async () => {
    // Critério 26.5, na camada em que ele é decidido: a ocorrência já está `resolvida`, e
    // `transicaoPermitida` responde `false`. Nunca uma segunda resolução.
    const erro = await resolverOcorrencia(repositorio({ cargas: [agregadoEm("resolvida")] }), ctx, {
      ocorrenciaId: ID,
      solucaoAplicada: "Uma segunda tentativa de escrever.",
    }).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    expect(aplicados).toHaveLength(0);
  });

  it("ocorrência inexistente dá 404, e nada é aplicado", async () => {
    const erro = await resolverOcorrencia(repositorio({ cargas: [null] }), ctx, {
      ocorrenciaId: ID,
    }).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(OcorrenciaNaoEncontrada);
    expect(aplicados).toHaveLength(0);
  });

  it("o conflito relê e responde com o status de AGORA, não com o da leitura", async () => {
    // A corrida do contrato §7.9: o `update … where status = 'em_atendimento'` não achou linha. A
    // releitura é o que faz a frase de T-05 dizer onde a ocorrência está agora.
    const erro = await resolverOcorrencia(
      repositorio({ cargas: [agregadoEm("em_atendimento"), agregadoEm("resolvida")], conflito: true }),
      ctx,
      { ocorrenciaId: ID },
    ).catch((causa: unknown) => causa);

    expect(erro).toBeInstanceOf(TransicaoNaoPermitida);
    expect((erro as TransicaoNaoPermitida).extensoes["statusAtual"]).toBe("resolvida");
    expect(carregados).toHaveLength(2);
  });
});
