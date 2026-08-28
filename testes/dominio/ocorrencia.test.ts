import { describe, expect, it } from "vitest";

import {
  AnexoDaOcorrencia,
  comandoPermitido,
  comandosDisponiveis,
  COMANDOS_IMPLEMENTADOS,
  MOTIVOS_DE_CANCELAMENTO,
  MOTIVOS_DO_AUTOR,
  motivosPermitidos,
  Ocorrencia,
  PrioridadeImutavelEmEstadoTerminal,
  RegistroDeTransicao,
  transicaoPermitida,
} from "@/dominio/ocorrencia";

/**
 * ============================================================================
 *  O grupo 1 da ADR-0008 — exaustivo, em memória, em milissegundos
 * ============================================================================
 *
 * É aqui que o volume vai, e é aqui que os sete itens do lote 6 vão acrescentar casos **sem arquivo
 * novo**. O agregado não persiste (ADR-0005), e é isso que torna este grupo barato.
 */

const REGISTRO = {
  titulo: "Lâmpada queimada na garagem",
  descricao: "Queimada faz três dias, corredor escuro.",
  categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
  areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
  areaTipo: "comum" as const,
  localizacaoComplemento: "ao lado da vaga 34",
  autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
  ocorreuEm: "2026-08-25T13:02:11.000Z",
};

/** Os seis, escritos à mão: um teste que importasse `STATUS` do Domínio provaria a constante contra ela
 *  mesma. */
const STATUS_TODOS = [
  "aberta",
  "em_analise",
  "em_atendimento",
  "pausada",
  "resolvida",
  "cancelada",
] as const;

describe("Ocorrencia.registrar", () => {
  it("nasce aberta e normal — os dois escritos pelo agregado, nunca pelo cliente", () => {
    const ocorrencia = Ocorrencia.registrar(REGISTRO);

    expect(ocorrencia.status).toBe("aberta");
    expect(ocorrencia.prioridade).toBe("normal");
  });

  it("grava exatamente UM registro de transição — a invariante 2", () => {
    expect(Ocorrencia.registrar(REGISTRO).trilha).toHaveLength(1);
  });

  it("o primeiro registro tem statusAnterior nulo e sequencia 1 — a premissa P1", () => {
    const [primeiro] = Ocorrencia.registrar(REGISTRO).trilha;

    expect(primeiro?.statusAnterior).toBeNull();
    expect(primeiro?.statusNovo).toBe("aberta");
    expect(primeiro?.sequencia).toBe(1);
  });

  it("o registro carrega os cinco campos do enunciado", () => {
    const [primeiro] = Ocorrencia.registrar(REGISTRO).trilha;

    // status anterior · novo status · data e horário · autor da transição · observação
    expect(primeiro?.statusAnterior).toBeNull();
    expect(primeiro?.statusNovo).toBe("aberta");
    expect(primeiro?.ocorreuEm).toBe("2026-08-25T13:02:11.000Z");
    expect(primeiro?.autorPessoaId).toBe(REGISTRO.autorPessoaId);
    expect(primeiro?.observacao).toBeNull();
  });

  it("congela o tipo da área no instante do registro", () => {
    expect(Ocorrencia.registrar({ ...REGISTRO, areaTipo: "privativa" }).areaTipo).toBe("privativa");
  });

  it("a trilha é imutável — mexer no que sai não mexe no agregado", () => {
    const ocorrencia = Ocorrencia.registrar(REGISTRO);
    const roubada = ocorrencia.trilha as unknown as unknown[];

    expect(() => roubada.push({})).toThrow();
    expect(ocorrencia.trilha).toHaveLength(1);
  });
});

describe("a máquina de estados — a tabela da arquitetura.md §4", () => {
  it.each([
    ["aberta", "analisar"],
    ["aberta", "cancelar"],
    ["em_analise", "iniciar-atendimento"],
    ["em_analise", "pausar"],
    ["em_analise", "cancelar"],
    ["em_atendimento", "resolver"],
    ["em_atendimento", "pausar"],
    ["em_atendimento", "cancelar"],
    ["pausada", "retomar"],
    ["pausada", "cancelar"],
  ] as const)("%s aceita %s", (status, comando) => {
    expect(transicaoPermitida(status, comando)).toBe(true);
  });

  it.each([
    // **A transição inválida que o DoD cobra.** Resolver exige passar por
    // `em_atendimento`; de `aberta` não sai.
    ["aberta", "resolver"],
    ["aberta", "iniciar-atendimento"],
    ["aberta", "retomar"],
    ["em_analise", "resolver"],
    ["resolvida", "analisar"],
    ["resolvida", "cancelar"],
    ["cancelada", "analisar"],
    ["cancelada", "cancelar"],
  ] as const)("%s recusa %s", (status, comando) => {
    expect(transicaoPermitida(status, comando)).toBe(false);
  });

  it("resolvida e cancelada são poços — não sai transição nenhuma delas (D24)", () => {
    for (const terminal of ["resolvida", "cancelada"] as const) {
      const saidas = (
        ["analisar", "iniciar-atendimento", "pausar", "retomar", "resolver", "cancelar"] as const
      ).filter((comando) => transicaoPermitida(terminal, comando));
      expect(saidas).toStrictEqual([]);
    }
  });
});

/**
 * ============================================================================
 *  `comandoPermitido` — a união das DUAS tabelas, e o item 19
 * ============================================================================
 *
 * **`transicaoPermitida` responde `false` para os quatro comandos que não transicionam, em todos os seis
 * estados** — ela consulta só a tabela com coluna `Para`. Usá-la para admitir `atribuir-responsavel`
 * recusaria o comando sempre, e é exatamente o defeito que este predicado existe para impedir.
 *
 * **Os dois convivem, e não é redundância:** quem vai **mover** o status pergunta `transicaoPermitida`;
 * quem vai **executar um comando** pergunta `comandoPermitido`. O item 22 precisa dos dois.
 */
describe("comandoPermitido", () => {
  it.each([
    ["aberta", "atribuir-responsavel"],
    ["em_analise", "atribuir-responsavel"],
    ["em_atendimento", "atribuir-responsavel"],
    ["pausada", "atribuir-responsavel"],
  ] as const)("%s admite %s — critério 19.2", (status, comando) => {
    expect(comandoPermitido(status, comando)).toBe(true);
  });

  it.each([
    ["resolvida", "atribuir-responsavel"],
    ["cancelada", "atribuir-responsavel"],
  ] as const)("%s RECUSA %s — os dois terminais, e é o 409 do critério 19.2", (status, comando) => {
    expect(comandoPermitido(status, comando)).toBe(false);
  });

  it("transicaoPermitida continua respondendo false para atribuir-responsavel nos SEIS estados", () => {
    // **É o que torna o predicado novo necessário**, e o que impede alguém de "simplificar" um no outro.
    for (const status of STATUS_TODOS) {
      expect(transicaoPermitida(status, "atribuir-responsavel")).toBe(false);
    }
  });

  it("para quem transiciona, os dois predicados concordam — analisar em aberta", () => {
    expect(transicaoPermitida("aberta", "analisar")).toBe(true);
    expect(comandoPermitido("aberta", "analisar")).toBe(true);
    expect(comandoPermitido("em_analise", "analisar")).toBe(false);
  });

  it("os quatro comandos sem transição têm cada um a própria janela — a tabela companheira inteira", () => {
    // `alterar-prioridade` fora dos terminais (invariante 7), `registrar-solucao-aplicada` só depois de
    // haver trabalho a descrever, `avaliar` só em `resolvida` (invariante 8).
    expect(comandoPermitido("resolvida", "alterar-prioridade")).toBe(false);
    expect(comandoPermitido("aberta", "registrar-solucao-aplicada")).toBe(false);
    expect(comandoPermitido("em_atendimento", "registrar-solucao-aplicada")).toBe(true);
    expect(comandoPermitido("resolvida", "avaliar")).toBe(true);
    expect(comandoPermitido("em_atendimento", "avaliar")).toBe(false);
  });
});

describe("comandosDisponiveis", () => {
  const TODAS = [
    "ocorrencia.analisar",
    "ocorrencia.atribuir",
    "ocorrencia.iniciar_atendimento",
    // O sexto comando construído. **Não entra `ocorrencia.avaliar`**: `avaliar` é do item 27, e o caso
    // que precisa dele monta a própria lista — ver o último caso deste bloco.
    "ocorrencia.retomar",
    // **O sétimo comando construído, e ele MUDA duas asserções deste arquivo** — em `em_atendimento` e em
    // `pausada`. Sem esta linha as duas continuariam verdes e deixariam de descrever a produção: todo
    // Gestor de verdade tem `ocorrencia.registrar_solucao` (`Permissao.ts`).
    "ocorrencia.registrar_solucao",
    "ocorrencia.resolver",
    "ocorrencia.alterar_prioridade",
    "ocorrencia.cancelar_qualquer",
  ];

  it("hoje traz OITO comandos — 16, 19, 22, 26, 23, 24, o 25 e o alterar-prioridade do 17", () => {
    // **A lista cresce um item por vez, e cada item é o que constrói o próprio endpoint.** A §8.5 do
    // contrato lida ao contrário: comando presente é comando cujo endpoint existe.
    expect(COMANDOS_IMPLEMENTADOS).toStrictEqual([
      "analisar",
      "atribuir-responsavel",
      "iniciar-atendimento",
      "pausar",
      "retomar",
      "registrar-solucao-aplicada",
      "resolver",
      "alterar-prioridade",
    ]);
  });

  it("o Gestor em aberta vê DOIS botões — o primeiro caso do produto", () => {
    // **Na ordem do enum `Comando`**, que é o que dispensa o cliente de ter uma segunda lista só para
    // ordenar a barra.
    // **E ganhou `alterar-prioridade` no item 17**, que é admitido nos quatro estados não terminais e é o
    // **nono** do enum — por isso entra no fim. A saída sai na ordem de `COMANDOS`, não na de
    // `COMANDOS_IMPLEMENTADOS`.
    expect(
      comandosDisponiveis({
        status: "aberta",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: false,
      }),
    ).toStrictEqual([
      "analisar",
      "atribuir-responsavel",
      "alterar-prioridade",
    ]);
  });

  it("em em_analise, o botão de iniciar depende do responsável — o filtro padrão, critério 22.3", () => {
    // Era `[]` até o item 19: `analisar` sai da lista assim que a ocorrência é analisada, e não havia
    // outro comando construído. Agora o Gestor tem o que fazer no instante seguinte à triagem — e, desde
    // o item 22, o que ele tem depende de haver responsável.
    const semResponsavel = comandosDisponiveis({
      status: "em_analise",
      permissoes: TODAS,
      ehAutor: false,
      temResponsavel: false,
    });
    const comResponsavel = comandosDisponiveis({
      status: "em_analise",
      permissoes: TODAS,
      ehAutor: false,
      temResponsavel: true,
    });

    expect(semResponsavel).toStrictEqual(["atribuir-responsavel", "alterar-prioridade"]);
    // **Na ordem do enum**: `atribuir-responsavel` vem antes de `iniciar-atendimento`, e é o que faz o
    // R-08 morder — a ordem não é promessa de destaque (contrato §8.5).
    // **E ganhou `alterar-prioridade` no item 17**, que é admitido nos quatro estados não terminais e é o
    // **nono** do enum — por isso entra no fim. A saída sai na ordem de `COMANDOS`, não na de
    // `COMANDOS_IMPLEMENTADOS`.
    expect(comResponsavel).toStrictEqual([
      "atribuir-responsavel",
      "iniciar-atendimento",
      "alterar-prioridade",
    ]);
  });

  it("nos dois terminais a lista continua vazia — critério 19.2, a metade da tela", () => {
    for (const terminal of ["resolvida", "cancelada"] as const) {
      expect(
        comandosDisponiveis({
          status: terminal,
          permissoes: TODAS,
          ehAutor: false,
          temResponsavel: false,
        }),
      ).toStrictEqual([]);
    }
  });

  /**
   * **A derivação é real, e é isto que prova.** Se ela fosse `[]` chumbado, este teste passaria com o
   * filtro desligado e continuaria passando com a lista cheia — e os itens 16 a 27 descobririam tarde
   * que não havia derivação nenhuma.
   */
  it("com o filtro desligado, deriva de verdade da tabela × permissões", () => {
    const semFiltro = {
      status: "aberta" as const,
      permissoes: TODAS,
      ehAutor: false,
      temResponsavel: false,
      filtro: null,
    };

    expect(comandosDisponiveis(semFiltro)).toStrictEqual([
      "analisar",
      "atribuir-responsavel",
      "alterar-prioridade",
      "cancelar",
    ]);
  });

  it("sai na ordem do enum Comando — os que movem adiante primeiro, cancelar por último", () => {
    const emAtendimento = comandosDisponiveis({
      status: "em_atendimento",
      permissoes: ["ocorrencia.pausar", "ocorrencia.resolver", "ocorrencia.cancelar_qualquer"],
      ehAutor: false,
      temResponsavel: false,
      filtro: null,
    });

    expect(emAtendimento).toStrictEqual(["pausar", "resolver", "cancelar"]);
  });

  it("o Solicitante autor em aberta só pode cancelar a própria", () => {
    expect(
      comandosDisponiveis({
        status: "aberta",
        permissoes: ["ocorrencia.registrar", "ocorrencia.cancelar_propria"],
        ehAutor: true,
        temResponsavel: false,
        filtro: null,
      }),
    ).toStrictEqual(["cancelar"]);
  });

  it("quem não é autor e só tem cancelar_propria não pode cancelar", () => {
    expect(
      comandosDisponiveis({
        status: "aberta",
        permissoes: ["ocorrencia.registrar", "ocorrencia.cancelar_propria"],
        ehAutor: false,
        temResponsavel: false,
        filtro: null,
      }),
    ).toStrictEqual([]);
  });

  it("em cancelada a lista é vazia para todo mundo, e vazia é resposta legítima", () => {
    expect(
      comandosDisponiveis({
        status: "cancelada",
        permissoes: TODAS,
        ehAutor: true,
        temResponsavel: false,
        filtro: null,
      }),
    ).toStrictEqual([]);
  });

  it("atribuir-responsavel é recusado nos dois terminais (contrato §8.4)", () => {
    for (const terminal of ["resolvida", "cancelada"] as const) {
      expect(
        comandosDisponiveis({
          status: terminal,
          permissoes: ["ocorrencia.atribuir"],
          ehAutor: false,
          temResponsavel: false,
          filtro: null,
        }),
      ).toStrictEqual([]);
    }
  });

  it("registrar-solucao-aplicada só sai de em_atendimento e pausada", () => {
    const permissoes = ["ocorrencia.registrar_solucao"];
    const de = (status: "aberta" | "em_analise" | "em_atendimento" | "pausada" | "resolvida") =>
      comandosDisponiveis({ status, permissoes, ehAutor: false, temResponsavel: false, filtro: null });

    expect(de("em_atendimento")).toStrictEqual(["registrar-solucao-aplicada"]);
    expect(de("pausada")).toStrictEqual(["registrar-solucao-aplicada"]);
    expect(de("aberta")).toStrictEqual([]);
    expect(de("em_analise")).toStrictEqual([]);
    expect(de("resolvida")).toStrictEqual([]);
  });

  it("com o filtro LIGADO, os quatro recusados continuam sem ele — a recusa é da tabela, não do filtro", () => {
    // **O par do caso acima, e a diferença é o filtro.** Aquele prova a janela com `filtro: null`; este
    // prova que, com o comando já implementado, a recusa dos quatro estados continua vindo da tabela
    // companheira. Sem os dois lados, um `[]` por comando-não-implementado passaria por recusa de estado.
    const de = (status: "aberta" | "em_analise" | "resolvida" | "cancelada") =>
      comandosDisponiveis({
        status,
        permissoes: ["ocorrencia.registrar_solucao"],
        ehAutor: false,
        temResponsavel: true,
      });

    for (const status of ["aberta", "em_analise", "resolvida", "cancelada"] as const) {
      expect(de(status)).toStrictEqual([]);
    }
  });

  it("avaliar só em resolvida, só do autor, e some depois de avaliada (invariante 8)", () => {
    const base = { permissoes: ["ocorrencia.avaliar"], temResponsavel: false, filtro: null };

    expect(comandosDisponiveis({ ...base, status: "resolvida", ehAutor: true })).toStrictEqual([
      "avaliar",
    ]);
    expect(comandosDisponiveis({ ...base, status: "resolvida", ehAutor: false })).toStrictEqual([]);
    expect(comandosDisponiveis({ ...base, status: "em_analise", ehAutor: true })).toStrictEqual([]);
    expect(
      comandosDisponiveis({ ...base, status: "resolvida", ehAutor: true, jaAvaliada: true }),
    ).toStrictEqual([]);
  });

  it("alterar-prioridade é congelada nos terminais (invariante 7, D6)", () => {
    const base = {
      permissoes: ["ocorrencia.alterar_prioridade"],
      ehAutor: false,
      temResponsavel: false,
      filtro: null,
    };

    expect(comandosDisponiveis({ ...base, status: "aberta" })).toStrictEqual(["alterar-prioridade"]);
    expect(comandosDisponiveis({ ...base, status: "resolvida" })).toStrictEqual([]);
    expect(comandosDisponiveis({ ...base, status: "cancelada" })).toStrictEqual([]);
  });

  /**
   * **A quarta entrada da derivação — a invariante 9** (contrato §8.5, terceira fonte).
   *
   * `filtro: null` de propósito: `iniciar-atendimento` só entra em `COMANDOS_IMPLEMENTADOS` na tarefa 4,
   * e o que se prova aqui é a **derivação**, não o filtro. É exatamente para isto que `filtro: null`
   * existe (`MaquinaDeEstados.ts`).
   */
  it("sem responsável, iniciar-atendimento SOME de em_analise — critério 22.3", () => {
    expect(
      comandosDisponiveis({
        status: "em_analise",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: false,
        filtro: null,
      }),
    ).toStrictEqual(["atribuir-responsavel", "alterar-prioridade", "cancelar"]);
  });

  it("com responsável, ele APARECE — e na ordem do enum, depois de atribuir", () => {
    expect(
      comandosDisponiveis({
        status: "em_analise",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: true,
        filtro: null,
      }),
    ).toStrictEqual([
      "atribuir-responsavel",
      "iniciar-atendimento",
      "alterar-prioridade",
      "cancelar",
    ]);
  });

  it("temResponsavel NÃO afeta comando nenhum além do iniciar-atendimento", () => {
    // **A invariante 9 é sobre um comando só.** Se um dia ela vazar para outro, este caso quebra — e é
    // mais barato do que descobrir pela tela.
    //
    // **`STATUS_TODOS`, e não `STATUS` do Domínio**: o arquivo escreve os seis à mão de propósito —
    // *"um teste que importasse `STATUS` do Domínio provaria a constante contra ela mesma"*.
    for (const status of STATUS_TODOS) {
      const sem = comandosDisponiveis({
        status,
        permissoes: TODAS,
        ehAutor: true,
        temResponsavel: false,
        filtro: null,
      });
      const com = comandosDisponiveis({
        status,
        permissoes: TODAS,
        ehAutor: true,
        temResponsavel: true,
        filtro: null,
      });

      expect(com.filter((comando) => comando !== "iniciar-atendimento")).toStrictEqual(
        sem.filter((comando) => comando !== "iniciar-atendimento"),
      );
    }
  });

  it("em em_atendimento o Gestor vê atribuir, registrar solução e resolver — na ordem do enum", () => {
    // **Na ordem do enum `Comando`**: `atribuir-responsavel` vem antes de `resolver`. Que a ênfase seja
    // do `resolver` é decisão de TELA — `ACAO_PRIMARIA`, item 22 —, e não desta lista.
    //
    // **Com o filtro PADRÃO**, que é o que a produção faz: `pausar` e `cancelar`
    // saem porque `COMANDOS_IMPLEMENTADOS` ainda não os tem. É por isso que este caso mora aqui e não na
    // tarefa 1 — antes do passo 4 ele devolveria `["atribuir-responsavel"]`.
    // **E ganhou `alterar-prioridade` no item 17**, que é admitido nos quatro estados não terminais e é o
    // **nono** do enum — por isso entra no fim. A saída sai na ordem de `COMANDOS`, não na de
    // `COMANDOS_IMPLEMENTADOS`.
    expect(
      comandosDisponiveis({
        status: "em_atendimento",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: true,
      }),
    ).toStrictEqual([
      "atribuir-responsavel",
      "registrar-solucao-aplicada",
      "resolver",
      "alterar-prioridade",
    ]);
  });

  it("o Solicitante autor em em_atendimento continua com a lista VAZIA — o critério 26.3 na lista", () => {
    // **É a metade do 26.3 que é conferível aqui:** ser autor dá `ler_propria` e `cancelar_propria`,
    // nunca `resolver`. O botão nunca aparece; o `403` do `comContexto` é a outra metade (D-P3).
    expect(
      comandosDisponiveis({
        status: "em_atendimento",
        permissoes: ["ocorrencia.ler_propria", "ocorrencia.cancelar_propria", "ocorrencia.avaliar"],
        ehAutor: true,
        temResponsavel: true,
      }),
    ).toStrictEqual([]);
  });

  it("em resolvida a lista é vazia para o Gestor E para o autor — o critério 26.4", () => {
    // **Com o filtro LIGADO**, que é o que a produção faz. É o `[]` que a frase do 26.6 explica.
    expect(
      comandosDisponiveis({
        status: "resolvida",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: true,
      }),
    ).toStrictEqual([]);

    expect(
      comandosDisponiveis({
        status: "resolvida",
        permissoes: ["ocorrencia.ler_propria", "ocorrencia.avaliar"],
        ehAutor: true,
        temResponsavel: true,
      }),
    ).toStrictEqual([]);
  });

  it("com o filtro desligado, resolvida devolve avaliar para o autor — o [] é derivação, não constante", () => {
    // **A prova de que o vazio do caso acima não é `[]` chumbado.** `SEM_TRANSICAO.avaliar` admite
    // `resolvida`, e o que o esconde hoje é `COMANDOS_IMPLEMENTADOS` — até o item 27.
    //
    // **A lista de permissões é própria e inline**, e não `TODAS`: `TODAS` não tem `ocorrencia.avaliar`,
    // e escrito com ela este caso devolveria `[]` provando o contrário do que promete (furo F-6).
    expect(
      comandosDisponiveis({
        status: "resolvida",
        permissoes: ["ocorrencia.ler_propria", "ocorrencia.avaliar"],
        ehAutor: true,
        temResponsavel: true,
        filtro: null,
      }),
    ).toStrictEqual(["avaliar"]);

    // E para quem **não** é o autor, nem com o filtro desligado — a invariante 8.
    expect(
      comandosDisponiveis({
        status: "resolvida",
        permissoes: ["ocorrencia.ler_todas", "ocorrencia.avaliar"],
        ehAutor: false,
        temResponsavel: true,
        filtro: null,
      }),
    ).toStrictEqual([]);
  });

  it("pausada com o filtro ligado oferece atribuir, retomar e registrar solução — o outro não existe ainda", () => {
    // **Na ordem de `COMANDOS`**, que é o que dispensa o cliente de ter uma segunda lista só para
    // ordenar a barra. O que falta é `cancelar` (18).
    // **E ganhou `alterar-prioridade` no item 17**, que é admitido nos quatro estados não terminais e é o
    // **nono** do enum — por isso entra no fim. A saída sai na ordem de `COMANDOS`, não na de
    // `COMANDOS_IMPLEMENTADOS`.
    expect(
      comandosDisponiveis({
        status: "pausada",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: true,
      }),
    ).toStrictEqual([
      "atribuir-responsavel",
      "retomar",
      "registrar-solucao-aplicada",
      "alterar-prioridade",
    ]);
  });

  it("pausada com filtro null devolve os CINCO, na ordem de COMANDOS — a prova de que o recorte é derivação", () => {
    // **`TODAS` já basta desde o item 25**: a permissão `ocorrencia.registrar_solucao` entrou na lista
    // quando o comando passou a ser oferecido de verdade. A concatenação que morava aqui virou ruído.
    expect(
      comandosDisponiveis({
        status: "pausada",
        permissoes: TODAS,
        ehAutor: false,
        temResponsavel: true,
        filtro: null,
      }),
    ).toStrictEqual([
      "atribuir-responsavel",
      "retomar",
      "registrar-solucao-aplicada",
      "alterar-prioridade",
      "cancelar",
    ]);
  });

  /**
   * ==========================================================================
   *  A metade de ESTADO do critério 18.3 — item 18
   * ==========================================================================
   *
   * A condição de **autoria** existe desde antes; o que nasce aqui é a de **estado**: o Solicitante autor
   * cancela a própria até `em_analise`, e a partir de `em_atendimento` só o Gestor.
   *
   * **Os quatro casos usam `filtro: null` de propósito** — o que se prova é a **derivação**, e não o
   * filtro. Um `[]` por comando-não-implementado passaria por recusa de papel sem que nada avisasse.
   */
  const DO_AUTOR = [
    "ocorrencia.registrar",
    "ocorrencia.ler_propria",
    "ocorrencia.cancelar_propria",
    "ocorrencia.comentar",
    "ocorrencia.avaliar",
  ];

  it("o autor recebe cancelar em aberta e em em_analise — a metade que ele alcança", () => {
    for (const status of ["aberta", "em_analise"] as const) {
      expect(
        comandosDisponiveis({
          status,
          permissoes: DO_AUTOR,
          ehAutor: true,
          temResponsavel: true,
          filtro: null,
        }),
      ).toStrictEqual(["cancelar"]);
    }
  });

  it("o autor NÃO recebe cancelar em em_atendimento nem em pausada — o critério 18.3", () => {
    // **É a metade que o `403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO` cobre no servidor**, e a lista é a
    // mesma constante: `ESTADOS_DE_CANCELAMENTO_DO_AUTOR`. Duas listas divergiriam, e a divergência
    // seria um botão que responde `403` no clique.
    for (const status of ["em_atendimento", "pausada"] as const) {
      expect(
        comandosDisponiveis({
          status,
          permissoes: DO_AUTOR,
          ehAutor: true,
          temResponsavel: true,
          filtro: null,
        }),
      ).toStrictEqual([]);
    }
  });

  it("o Gestor recebe cancelar nos QUATRO, mesmo não sendo autor — cancelar_qualquer pula a condição", () => {
    for (const status of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
      expect(
        comandosDisponiveis({
          status,
          permissoes: ["ocorrencia.cancelar_qualquer"],
          ehAutor: false,
          temResponsavel: true,
          filtro: null,
        }),
      ).toStrictEqual(["cancelar"]);
    }
  });
});

describe("o anexo é filho do agregado, não vizinho dele", () => {
  const dadosDoAnexo = {
    tipo: "imagem" as const,
    chave: "anx_01JB8Z6K9T2M4N7Q",
    thumbnailChave: "anx_01JB8Z6K9T2M4N7Q_mini",
    nomeArquivo: null,
    titulo: null,
    tipoConteudo: "image/jpeg",
    tamanhoBytes: 391_244,
    anexadoPorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
    anexadoEm: "2026-08-27T13:02:11.000Z",
  };

  const base = {
    titulo: "Lâmpada queimada na garagem",
    descricao: "Está escuro à noite.",
    categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
    areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
    areaTipo: "comum" as const,
    localizacaoComplemento: null,
    autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
    ocorreuEm: "2026-08-27T13:02:11.000Z",
  };

  it("sem anexo, a lista é vazia — nunca indefinida", () => {
    expect(Ocorrencia.registrar(base).anexos).toStrictEqual([]);
  });

  it("com anexo, o agregado o carrega inteiro", () => {
    const ocorrencia = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] });

    expect(ocorrencia.anexos).toHaveLength(1);
    expect(ocorrencia.anexos[0]).toMatchObject({
      tipo: "imagem",
      chave: "anx_01JB8Z6K9T2M4N7Q",
      thumbnailChave: "anx_01JB8Z6K9T2M4N7Q_mini",
      tipoConteudo: "image/jpeg",
      tamanhoBytes: 391_244,
    });
  });

  it("a lista é congelada — não se acrescenta anexo por fora do comando", () => {
    const ocorrencia = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] });
    // Mesma invariante 3 da trilha, aplicada à outra filha do agregado.
    expect(() => (ocorrencia.anexos as AnexoDaOcorrencia[]).push(ocorrencia.anexos[0]!)).toThrow();
  });

  it("o anexo em si é imutável", () => {
    const anexo = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] }).anexos[0]!;
    expect(Object.isFrozen(anexo)).toBe(true);
  });

  it("anexar NÃO produz registro de transição — a trilha não conhece anexo", () => {
    const ocorrencia = Ocorrencia.registrar({ ...base, anexos: [dadosDoAnexo] });
    // `contrato-de-api.md` §8.8: "o RegistroDeTransicao não muda, e é bom que continue assim".
    expect(ocorrencia.trilha).toHaveLength(1);
    expect(ocorrencia.trilha[0]!.statusAnterior).toBeNull();
  });
});

/**
 * ============================================================================
 *  O agregado volta do banco, e executa um comando — o item 16
 * ============================================================================
 *
 * **É a primeira transição do produto.** Até aqui o agregado sabia nascer e a máquina de estados sabia
 * responder perguntas; ninguém sabia executar um comando sobre ocorrência que já existe.
 */
describe("Ocorrencia.reconstituir e o comando analisar", () => {
  const GESTOR = "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f";

  const ABERTA = {
    titulo: "Lâmpada queimada na garagem",
    descricao: "Queimada faz três dias, corredor escuro.",
    categoriaId: "6b1c8f2e-1111-4a2b-8c3d-4e5f6a7b8c9d",
    areaId: "0f9a4d71-1111-4b2c-9d3e-4f5a6b7c8d9e",
    areaTipo: "comum" as const,
    localizacaoComplemento: "ao lado da vaga 34",
    autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
    registradaEm: "2026-08-25T13:02:11.000Z",
    status: "aberta" as const,
    prioridade: "normal" as const,
    /** **Nula até alguém resolver.** A coluna existe desde a migração 005 e, até o item 26, nenhum
     *  endpoint a escrevia — era coluna lida pela projeção e escrita por ninguém. */
    solucaoAplicada: null,
    trilha: [
      RegistroDeTransicao.reconstituir({
        sequencia: 1,
        statusAnterior: null,
        statusNovo: "aberta",
        ocorreuEm: "2026-08-25T13:02:11.000Z",
        autorPessoaId: "2c9a1f30-4d5e-4a6b-8c7d-9e0f1a2b3c4d",
        observacao: null,
        motivoPausa: null,
        motivoCancelamento: null,
      }),
    ],
  };

  const ANALISE = { autorPessoaId: GESTOR, ocorreuEm: "2026-08-27T09:14:00.000Z" };

  /**
   * O agregado no estado que o caso pedir. **`ABERTA` com o `status` trocado**, e nada mais: um segundo
   * objeto de reconstituição neste arquivo seria a cópia que diverge no dia em que `DadosDeReconstituicao`
   * ganhar campo.
   *
   * **A trilha continua sendo a de origem**, com um registro só — é o que torna a contagem dos casos
   * abaixo legível: dois depois de `analisar`, três depois de `iniciarAtendimento`.
   */
  const em = (status: (typeof STATUS_TODOS)[number]) =>
    Ocorrencia.reconstituir({ ...ABERTA, status });

  it("reconstituir devolve o agregado no estado em que ele foi gravado", () => {
    const ocorrencia = Ocorrencia.reconstituir(ABERTA);

    expect(ocorrencia.status).toBe("aberta");
    expect(ocorrencia.prioridade).toBe("normal");
    expect(ocorrencia.titulo).toBe(ABERTA.titulo);
    expect(ocorrencia.areaTipo).toBe("comum");
    expect(ocorrencia.trilha).toHaveLength(1);
  });

  it("reconstituir sem trilha estoura — a invariante 2 não se conserta lendo", () => {
    expect(() => Ocorrencia.reconstituir({ ...ABERTA, trilha: [] })).toThrow(/invariante 2/u);
  });

  it("o agregado reconstituído NÃO carrega anexos, e dizê-lo é o ponto", () => {
    // A chave do anexo não sai do repositório (modelo §2.8), então o caminho de ESCRITA não os reidrata.
    // Devolver `[]` seria mentira; o getter estoura, no mesmo idioma de `ultimaTransicao`.
    expect(() => Ocorrencia.reconstituir(ABERTA).anexos).toThrow(/sem anexos/u);
  });

  it("analisar sai de aberta e chega a em_analise — o critério 16.1", () => {
    expect(Ocorrencia.reconstituir(ABERTA).analisar(ANALISE).status).toBe("em_analise");
  });

  it("analisar acrescenta UM registro, com os cinco campos — o critério 16.2", () => {
    const analisada = Ocorrencia.reconstituir(ABERTA).analisar({
      ...ANALISE,
      observacao: "Vou ver o estoque.",
    });
    const registro = analisada.ultimaTransicao;

    expect(analisada.trilha).toHaveLength(2);
    expect(registro.sequencia).toBe(2);
    expect(registro.statusAnterior).toBe("aberta");
    expect(registro.statusNovo).toBe("em_analise");
    expect(registro.ocorreuEm).toBe("2026-08-27T09:14:00.000Z");
    expect(registro.autorPessoaId).toBe(GESTOR);
    expect(registro.observacao).toBe("Vou ver o estoque.");
    expect(registro.motivoPausa).toBeNull();
    expect(registro.motivoCancelamento).toBeNull();
  });

  it("a trilha CRESCE — o registro de origem continua lá, na posição 1", () => {
    const trilha = Ocorrencia.reconstituir(ABERTA).analisar(ANALISE).trilha;

    expect(trilha[0]?.sequencia).toBe(1);
    expect(trilha[0]?.statusAnterior).toBeNull();
    expect(trilha[1]?.sequencia).toBe(2);
  });

  it("sem observação, o registro fica com null — nunca string vazia", () => {
    expect(Ocorrencia.reconstituir(ABERTA).analisar(ANALISE).ultimaTransicao.observacao).toBeNull();
  });

  it("o agregado ANTES não muda — o comando devolve instância nova", () => {
    const antes = Ocorrencia.reconstituir(ABERTA);
    const depois = antes.analisar(ANALISE);

    expect(antes.status).toBe("aberta");
    expect(antes.trilha).toHaveLength(1);
    expect(depois).not.toBe(antes);
  });

  it("analisar fora de aberta estoura — a invariante 1 é estrutural", () => {
    const emAnalise = Ocorrencia.reconstituir({ ...ABERTA, status: "em_analise" });
    // `Error`, e não `ErroDeDominio`: alcançar isto significa que a Aplicação esqueceu de conferir.
    expect(() => emAnalise.analisar(ANALISE)).toThrow(/invariante 1/u);
  });

  it("a sequência vem do último registro, não do tamanho da lista", () => {
    const comBuraco = Ocorrencia.reconstituir({
      ...ABERTA,
      trilha: [
        ...ABERTA.trilha,
        RegistroDeTransicao.reconstituir({
          sequencia: 7,
          statusAnterior: "em_analise",
          statusNovo: "aberta",
          ocorreuEm: "2026-08-26T10:00:00.000Z",
          autorPessoaId: GESTOR,
          observacao: null,
          motivoPausa: null,
          motivoCancelamento: null,
        }),
      ],
    });

    expect(comBuraco.analisar(ANALISE).ultimaTransicao.sequencia).toBe(8);
  });

  it("iniciarAtendimento sai de em_analise e chega a em_atendimento — o critério 22.1", () => {
    const emAnalise = em("em_analise");
    const iniciada = emAnalise.iniciarAtendimento({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:20:00.000Z",
    });

    expect(iniciada.status).toBe("em_atendimento");
  });

  it("iniciarAtendimento acrescenta UM registro, com os cinco campos — o critério 22.1", () => {
    const iniciada = em("em_analise").iniciarAtendimento({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:20:00.000Z",
      observacao: "O Zelador começa amanhã.",
    });

    const registro = iniciada.ultimaTransicao;
    expect(registro.statusAnterior).toBe("em_analise");
    expect(registro.statusNovo).toBe("em_atendimento");
    expect(registro.ocorreuEm).toBe("2026-08-28T15:20:00.000Z");
    // **O autor da transição é quem COMANDOU**, nunca o autor da ocorrência.
    expect(registro.autorPessoaId).toBe(GESTOR);
    expect(registro.observacao).toBe("O Zelador começa amanhã.");
    // `avanco` não põe motivo em nenhum dos dois campos — este destino não os exige.
    expect(registro.motivoPausa).toBeNull();
    expect(registro.motivoCancelamento).toBeNull();
  });

  it("a trilha de uma ocorrência atendida tem TRÊS registros — origem, análise e atendimento", () => {
    // **É a primeira ocorrência do produto com trilha de três**, e a sequência vem do ÚLTIMO registro.
    const analisada = em("aberta").analisar({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:00:00.000Z",
    });
    const iniciada = analisada.iniciarAtendimento({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:20:00.000Z",
    });

    expect(iniciada.trilha).toHaveLength(3);
    expect(iniciada.trilha.map((registro) => registro.sequencia)).toStrictEqual([1, 2, 3]);
    expect(iniciada.trilha.map((registro) => registro.statusNovo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
    ]);
  });

  it("sem observação, o registro de iniciarAtendimento fica com null — nunca string vazia", () => {
    const iniciada = em("em_analise").iniciarAtendimento({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:20:00.000Z",
    });

    expect(iniciada.ultimaTransicao.observacao).toBeNull();
  });

  it("o agregado ANTES de iniciarAtendimento não muda — o comando devolve instância nova", () => {
    const emAnalise = em("em_analise");
    emAnalise.iniciarAtendimento({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-28T15:20:00.000Z" });

    expect(emAnalise.status).toBe("em_analise");
    expect(emAnalise.trilha).toHaveLength(1);
  });

  it("iniciarAtendimento fora de em_analise estoura — a invariante 1 é estrutural", () => {
    // **Alcançar isto é defeito NOSSO, não recusa de negócio** — a Aplicação confere antes com
    // `transicaoPermitida`, e é ela quem produz o `409`. Por isso é `Error`, e não `ErroDeDominio`.
    for (const status of ["aberta", "em_atendimento", "pausada", "resolvida", "cancelada"] as const) {
      expect(() =>
        em(status).iniciarAtendimento({
          autorPessoaId: GESTOR,
          ocorreuEm: "2026-08-28T15:20:00.000Z",
        }),
      ).toThrow(/iniciarAtendimento exige status 'em_analise'/u);
    }
  });

  it("resolver sai de em_atendimento e chega a resolvida — o critério 26.1", () => {
    const emAtendimento = em("em_atendimento");
    const resolvida = emAtendimento.resolver({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-29T10:05:00.000Z",
    });

    // **O primeiro estado terminal do produto.** Depois dele, `TRANSICOES.resolvida` é vazia.
    expect(resolvida.status).toBe("resolvida");
  });

  it("resolver acrescenta UM registro, com os cinco campos — o critério 26.1", () => {
    const resolvida = em("em_atendimento").resolver({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-29T10:05:00.000Z",
      observacao: "Conferido com a moradora.",
    });

    const registro = resolvida.ultimaTransicao;
    expect(registro.statusAnterior).toBe("em_atendimento");
    expect(registro.statusNovo).toBe("resolvida");
    expect(registro.ocorreuEm).toBe("2026-08-29T10:05:00.000Z");
    // **O autor da transição é quem COMANDOU**, nunca o autor da ocorrência.
    expect(registro.autorPessoaId).toBe(GESTOR);
    expect(registro.observacao).toBe("Conferido com a moradora.");
    // `avanco` não põe motivo em nenhum dos dois campos — este destino não os exige.
    expect(registro.motivoPausa).toBeNull();
    expect(registro.motivoCancelamento).toBeNull();
  });

  it("a trilha de uma ocorrência resolvida tem QUATRO registros — o ciclo mínimo fechado", () => {
    // **É a primeira ocorrência do produto que percorre o ciclo inteiro dentro do agregado.**
    const resolvida = em("aberta")
      .analisar({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T09:00:00.000Z" })
      .iniciarAtendimento({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T09:30:00.000Z" })
      .resolver({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T10:05:00.000Z" });

    expect(resolvida.trilha).toHaveLength(4);
    expect(resolvida.trilha.map((registro) => registro.sequencia)).toStrictEqual([1, 2, 3, 4]);
    expect(resolvida.trilha.map((registro) => registro.statusNovo)).toStrictEqual([
      "aberta",
      "em_analise",
      "em_atendimento",
      "resolvida",
    ]);
  });

  it("sem observação, o registro de resolver fica com null — nunca string vazia", () => {
    const resolvida = em("em_atendimento").resolver({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-29T10:05:00.000Z",
    });

    expect(resolvida.ultimaTransicao.observacao).toBeNull();
  });

  it("o agregado ANTES de resolver não muda — o comando devolve instância nova", () => {
    const emAtendimento = em("em_atendimento");
    emAtendimento.resolver({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T10:05:00.000Z" });

    expect(emAtendimento.status).toBe("em_atendimento");
    expect(emAtendimento.trilha).toHaveLength(1);
  });

  it("resolver fora de em_atendimento estoura — a invariante 1 é estrutural", () => {
    // **Alcançar isto é defeito NOSSO, não recusa de negócio** — a Aplicação confere antes com
    // `transicaoPermitida`, e é ela quem produz o `409`. Por isso é `Error`, e não `ErroDeDominio`.
    for (const status of ["aberta", "em_analise", "pausada", "resolvida", "cancelada"] as const) {
      expect(() =>
        em(status).resolver({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T10:05:00.000Z" }),
      ).toThrow(/resolver exige status 'em_atendimento'/u);
    }
  });

  it("resolver COM solucaoAplicada grava o texto — o corpo de uma requisição só", () => {
    // **É a §3.2 inteira:** o texto viaja no corpo de `/resolver`, e não numa segunda chamada a
    // `/registrar-solucao-aplicada`, que ainda não existe e que seria recusado em `resolvida`.
    const resolvida = em("em_atendimento").resolver({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-29T10:05:00.000Z",
      solucaoAplicada: "Trocada a lâmpada da vaga 34.",
    });

    expect(resolvida.solucaoAplicada).toBe("Trocada a lâmpada da vaga 34.");
  });

  it("resolver SEM solucaoAplicada preserva a que havia — nunca apaga", () => {
    // **Apagar solução aplicada não é capacidade de endpoint nenhum.** Quando o item 25 existir, o
    // Gestor poderá tê-la escrito antes de resolver, e `null` no corpo significa *ausente*, não *limpe*.
    const comTexto = Ocorrencia.reconstituir({
      ...ABERTA,
      status: "em_atendimento",
      solucaoAplicada: "Escrita antes, pelo item 25.",
    });

    const semNada = comTexto.resolver({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-29T10:05:00.000Z",
    });
    const comNulo = comTexto.resolver({
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-29T10:05:00.000Z",
      solucaoAplicada: null,
    });

    expect(semNada.solucaoAplicada).toBe("Escrita antes, pelo item 25.");
    expect(comNulo.solucaoAplicada).toBe("Escrita antes, pelo item 25.");
  });

  it("reconstituir devolve a solução aplicada que estava gravada", () => {
    expect(
      Ocorrencia.reconstituir({ ...ABERTA, solucaoAplicada: "Veio do banco." }).solucaoAplicada,
    ).toBe("Veio do banco.");
    expect(Ocorrencia.reconstituir(ABERTA).solucaoAplicada).toBeNull();
  });

  it("analisar e iniciarAtendimento NÃO tocam a solução aplicada — o padrão de comTransicao", () => {
    // **É o D-P1 conferido:** o terceiro parâmetro tem padrão, e os comandos que não o informam
    // preservam a coluna. Sem o padrão, toda transição a apagaria em silêncio.
    const analisada = Ocorrencia.reconstituir({
      ...ABERTA,
      solucaoAplicada: "Não me apague.",
    }).analisar(ANALISE);

    const iniciada = Ocorrencia.reconstituir({
      ...ABERTA,
      status: "em_analise",
      solucaoAplicada: "Não me apague.",
    }).iniciarAtendimento({ autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T09:30:00.000Z" });

    expect(analisada.solucaoAplicada).toBe("Não me apague.");
    expect(iniciada.solucaoAplicada).toBe("Não me apague.");
  });

  describe("o comando pausar — o primeiro com DOIS estados de origem", () => {
    const ENTRADA = {
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:20:00.000Z",
      motivo: "aguardando_peca" as const,
      observacao: "Sem lâmpada no estoque.",
    };

    it("sai de em_analise para pausada, com UM registro a mais e os cinco campos do F5 mais o motivo", () => {
      const antes = em("em_analise");
      const depois = antes.pausar(ENTRADA);

      expect(depois.status).toBe("pausada");
      expect(depois.trilha).toHaveLength(antes.trilha.length + 1);

      const registro = depois.ultimaTransicao;
      expect(registro.statusAnterior).toBe("em_analise");
      expect(registro.statusNovo).toBe("pausada");
      expect(registro.ocorreuEm).toBe("2026-08-28T15:20:00.000Z");
      expect(registro.autorPessoaId).toBe(ENTRADA.autorPessoaId);
      expect(registro.observacao).toBe("Sem lâmpada no estoque.");
      expect(registro.motivoPausa).toBe("aguardando_peca");
      expect(registro.sequencia).toBe(antes.ultimaTransicao.sequencia + 1);
    });

    it("sai TAMBÉM de em_atendimento — e o statusAnterior gravado é o de onde saiu, que é o contrato do item 24", () => {
      expect(em("em_atendimento").pausar(ENTRADA).ultimaTransicao.statusAnterior).toBe(
        "em_atendimento",
      );
    });

    it("o agregado ANTES não muda — a trilha é append-only e a cópia é nova", () => {
      const antes = em("em_analise");
      const tamanho = antes.trilha.length;

      antes.pausar(ENTRADA);

      expect(antes.status).toBe("em_analise");
      expect(antes.trilha).toHaveLength(tamanho);
    });

    it("estoura nos QUATRO outros status — a rede estrutural da invariante 1", () => {
      for (const status of ["aberta", "pausada", "resolvida", "cancelada"] as const) {
        expect(() => em(status).pausar(ENTRADA)).toThrow(/pausar exige status/u);
      }
    });

    it("solucaoAplicada SOBREVIVE à pausa — pausar não é apagar trabalho registrado", () => {
      // **`ABERTA` com dois campos trocados** — é a mesma forma do caso *"resolver SEM solucaoAplicada
      // preserva a que havia"*, logo acima. `em()` não serve aqui porque ele fixa `solucaoAplicada: null`.
      const comSolucao = Ocorrencia.reconstituir({
        ...ABERTA,
        status: "em_atendimento",
        solucaoAplicada: "Troquei o disjuntor.",
      });

      expect(comSolucao.pausar(ENTRADA).solucaoAplicada).toBe("Troquei o disjuntor.");
    });
  });

  describe("o comando retomar — o único que LÊ a trilha para saber para onde vai", () => {
    const PAUSA = {
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T15:20:00.000Z",
      motivo: "aguardando_peca" as const,
      observacao: "Sem lâmpada no estoque.",
    };
    const RETOMADA = { autorPessoaId: GESTOR, ocorreuEm: "2026-08-29T08:00:00.000Z" };

    /**
     * **A pausa é construída pelo comando, e não à mão.** Um `reconstituir` com registro de pausa
     * escrito no teste provaria `retomar` contra um dado que o produto talvez nunca grave; atravessar
     * `pausar` prova a **ida e a volta** — que é literalmente o que a invariante 6 promete.
     */

    it("volta a em_analise quando a pausa saiu de em_analise — o critério 24.1", () => {
      expect(em("em_analise").pausar(PAUSA).retomar(RETOMADA).status).toBe("em_analise");
    });

    it("volta a em_atendimento quando a pausa saiu de em_atendimento — a OUTRA metade do 24.1", () => {
      expect(em("em_atendimento").pausar(PAUSA).retomar(RETOMADA).status).toBe("em_atendimento");
    });

    it("o registro criado tem statusAnterior 'pausada', e a trilha fica com os DOIS — critério 24.4", () => {
      const pausada = em("em_atendimento").pausar(PAUSA);
      const retomada = pausada.retomar({ ...RETOMADA, observacao: "Peça chegou." });
      const registro = retomada.ultimaTransicao;

      expect(retomada.trilha).toHaveLength(pausada.trilha.length + 1);
      expect(registro.statusAnterior).toBe("pausada");
      expect(registro.statusNovo).toBe("em_atendimento");
      expect(registro.sequencia).toBe(pausada.ultimaTransicao.sequencia + 1);
      expect(registro.ocorreuEm).toBe("2026-08-29T08:00:00.000Z");
      expect(registro.autorPessoaId).toBe(GESTOR);
      expect(registro.observacao).toBe("Peça chegou.");

      // **Avanço rotineiro: nenhum motivo codificado.** É o que `RegistroDeTransicao.avanco` garante,
      // e é o outro lado do `registros_transicao_motivo_ck`.
      expect(registro.motivoPausa).toBeNull();
      expect(registro.motivoCancelamento).toBeNull();

      // **A trilha guarda os DOIS**, e é o critério 24.4 em letra: o penúltimo é a pausa.
      const trilha = retomada.trilha;
      expect(trilha[trilha.length - 2]!.statusNovo).toBe("pausada");
      expect(trilha[trilha.length - 2]!.motivoPausa).toBe("aguardando_peca");
    });

    it("sem observação, o registro guarda null — retomar é avanço rotineiro (D23)", () => {
      expect(
        em("em_analise").pausar(PAUSA).retomar(RETOMADA).ultimaTransicao.observacao,
      ).toBeNull();
    });

    it("solucaoAplicada SOBREVIVE à retomada — retomar não é apagar trabalho registrado", () => {
      // **`ABERTA` com dois campos trocados**, como no caso irmão do `pausar`: `em()` fixa
      // `solucaoAplicada: null` e não serve aqui.
      const comSolucao = Ocorrencia.reconstituir({
        ...ABERTA,
        status: "em_atendimento",
        solucaoAplicada: "Troquei o disjuntor.",
      });

      expect(comSolucao.pausar(PAUSA).retomar(RETOMADA).solucaoAplicada).toBe(
        "Troquei o disjuntor.",
      );
    });

    it("o agregado ANTES não muda — a trilha é append-only e a cópia é nova", () => {
      const pausada = em("em_analise").pausar(PAUSA);
      const tamanho = pausada.trilha.length;

      pausada.retomar(RETOMADA);

      expect(pausada.status).toBe("pausada");
      expect(pausada.trilha).toHaveLength(tamanho);
    });

    it("estoura nos CINCO outros status — a rede estrutural da invariante 1", () => {
      for (const status of [
        "aberta",
        "em_analise",
        "em_atendimento",
        "resolvida",
        "cancelada",
      ] as const) {
        expect(() => em(status).retomar(RETOMADA)).toThrow(/retomar exige status/u);
      }
    });

    it("estoura se o destino lido NÃO for uma das duas origens de pausa — a guarda do critério 24.1", () => {
      // Uma linha corrompida: `pausada` cujo registro diz ter vindo de `resolvida`. **Sem esta guarda,
      // `retomar` alcançaria um estado TERMINAL pela porta errada** — contornando o "só o Gestor
      // resolve" do 26.3 e a própria terminalidade. A trilha é append-only: não teria conserto.
      const corrompida = Ocorrencia.reconstituir({
        ...ABERTA,
        status: "pausada",
        trilha: [
          RegistroDeTransicao.reconstituir({
            sequencia: 2,
            statusAnterior: "resolvida",
            statusNovo: "pausada",
            ocorreuEm: "2026-08-28T15:20:00.000Z",
            autorPessoaId: GESTOR,
            observacao: "Registro impossível.",
            motivoPausa: "aguardando_peca",
            motivoCancelamento: null,
          }),
        ],
      });

      expect(() => corrompida.retomar(RETOMADA)).toThrow(/como destino/u);
    });

    it("estoura também com statusAnterior NULO — o registro de origem não é registro de pausa", () => {
      // `em("pausada")` traz a trilha de ORIGEM: um registro só, `statusAnterior: null`. É o mesmo
      // defeito com outra cara, e a mesma guarda o pega — sem um segundo `if`.
      expect(() => em("pausada").retomar(RETOMADA)).toThrow(/como destino/u);
    });
  });

  describe("o comando registrarSolucaoAplicada — o primeiro que muda estado sem tocar a trilha", () => {
    /**
     * **`em(status)` serve aqui, e para `retomar` não servia.** Aquele lê `ultimaTransicao.statusAnterior`
     * para descobrir o destino, e por isso exigia uma pausa de verdade na trilha. Este **não lê a trilha**
     * — é literalmente o que o item entrega —, então o agregado com a trilha de origem basta.
     */
    const TEXTO = "Trocada a lâmpada da vaga 34 e revisado o reator do corredor.";

    it("grava a coluna a partir de em_atendimento — o critério 25.1", () => {
      expect(
        em("em_atendimento").registrarSolucaoAplicada({ solucaoAplicada: TEXTO }).solucaoAplicada,
      ).toBe(TEXTO);
    });

    it("grava a coluna a partir de pausada — a SEGUNDA origem, e ela é do critério 25.2", () => {
      // **Duas origens, como o `pausar`.** A lista vem da tabela companheira (`MaquinaDeEstados.ts:35`),
      // e é a mesma que a Aplicação consulta — não há segunda cópia dela em lugar nenhum.
      expect(
        em("pausada").registrarSolucaoAplicada({ solucaoAplicada: TEXTO }).solucaoAplicada,
      ).toBe(TEXTO);
    });

    it("a trilha NÃO cresce, e a última transição é a MESMA — o critério 25.1 pelo lado do negativo", () => {
      // **É o item inteiro, numa asserção.** Todos os seis comandos anteriores acrescem um registro; este
      // é o primeiro do qual isso é falso, e a ausência é o que o contrato declara (§8.4).
      const antes = em("em_atendimento");
      const depois = antes.registrarSolucaoAplicada({ solucaoAplicada: TEXTO });

      expect(depois.trilha).toHaveLength(antes.trilha.length);
      expect(depois.ultimaTransicao).toBe(antes.ultimaTransicao);
    });

    it("o status NÃO muda — não é transição, e não há para onde ir", () => {
      for (const origem of ["em_atendimento", "pausada"] as const) {
        expect(em(origem).registrarSolucaoAplicada({ solucaoAplicada: TEXTO }).status).toBe(origem);
      }
    });

    it("o agregado ANTES não muda — o comando devolve instância nova", () => {
      const antes = em("em_atendimento");
      antes.registrarSolucaoAplicada({ solucaoAplicada: TEXTO });

      expect(antes.solucaoAplicada).toBeNull();
      expect(antes.trilha).toHaveLength(1);
    });

    it("sobrescreve a solução que já havia — a última escrita vence, e é a §7.9 aceita", () => {
      // **O contrato aceita isto por escrito** (§7.9, uma das duas exposições nomeadas): dois Gestores
      // gravando no mesmo estado, o segundo vence. **Não construímos defesa contra o que foi decidido.**
      const comTexto = Ocorrencia.reconstituir({
        ...ABERTA,
        status: "em_atendimento",
        solucaoAplicada: "A primeira versão.",
      });

      expect(comTexto.registrarSolucaoAplicada({ solucaoAplicada: TEXTO }).solucaoAplicada).toBe(
        TEXTO,
      );
    });

    it("estoura nos QUATRO estados recusados — a guarda é rede, não decisão", () => {
      // **Alcançar isto é defeito NOSSO, não recusa de negócio** — a Aplicação confere antes com
      // `comandoPermitido`, e é ela quem produz o `409`. Por isso é `Error`, e não `ErroDeDominio`.
      //
      // **A mensagem NÃO termina em "invariante 1 violada"**, e as seis anteriores terminam: a invariante
      // 1 é sobre `status` nunca ser escrito de fora, e **este comando não escreve `status`**. Citá-la
      // aqui seria citar a invariante errada no único lugar em que ela não está em jogo.
      for (const status of ["aberta", "em_analise", "resolvida", "cancelada"] as const) {
        expect(() => em(status).registrarSolucaoAplicada({ solucaoAplicada: TEXTO })).toThrow(
          `registrarSolucaoAplicada exige 'em_atendimento' ou 'pausada'; a ocorrência está '${status}'.`,
        );
      }
    });
  });

  describe("o comando alterarPrioridade — o segundo que muda a raiz sem tocar a trilha", () => {
    /**
     * **`em(status)` serve aqui, e é o caso mais simples do arquivo:** este comando não lê a trilha, não
     * lê o relógio e não olha responsável. O agregado com a trilha de origem basta para os seis estados.
     *
     * **`ABERTA.prioridade` é `"normal"`**, que é o que `PRIORIDADE_INICIAL` grava no nascimento — então
     * `"alta"` e `"baixa"` são as duas mudanças de verdade, e `"normal"` é a que testa o valor igual.
     */
    it("grava a coluna a partir dos QUATRO estados admitidos — o critério 17.1", () => {
      // **A lista é o complemento de `TERMINAIS`**, e é a mesma que `SEM_TRANSICAO["alterar-prioridade"]`
      // traz (`MaquinaDeEstados.ts:31`). Escrita à mão aqui de propósito: um teste que importasse a
      // tabela provaria a constante contra ela mesma.
      for (const origem of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
        expect(em(origem).alterarPrioridade({ prioridade: "alta" }).prioridade).toBe("alta");
        expect(em(origem).alterarPrioridade({ prioridade: "baixa" }).prioridade).toBe("baixa");
      }
    });

    it("a trilha NÃO cresce, e a última transição é a MESMA — o critério 17.3 pelo lado do negativo", () => {
      // **É metade do item, numa asserção.** É o segundo comando do agregado do qual isso é verdade, e a
      // ausência é o que o contrato declara (`contrato-de-api.md:1206`).
      const antes = em("em_atendimento");
      const depois = antes.alterarPrioridade({ prioridade: "alta" });

      expect(depois.trilha).toHaveLength(antes.trilha.length);
      expect(depois.ultimaTransicao).toBe(antes.ultimaTransicao);
    });

    it("o status NÃO muda — não é transição, e não há para onde ir", () => {
      for (const origem of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
        expect(em(origem).alterarPrioridade({ prioridade: "alta" }).status).toBe(origem);
      }
    });

    it("a solução aplicada ATRAVESSA intacta — alterar prioridade não apaga o que o item 25 gravou", () => {
      // **O defeito que o `comPrioridade` posicional impediria de nascer em silêncio**, e mesmo assim vale
      // asserir: uma ocorrência `em_atendimento` pode ter solução registrada, e mudar a prioridade dela
      // não pode zerar a coluna vizinha.
      const comTexto = Ocorrencia.reconstituir({
        ...ABERTA,
        status: "em_atendimento",
        solucaoAplicada: "Trocada a lâmpada da vaga 34.",
      });

      expect(comTexto.alterarPrioridade({ prioridade: "baixa" }).solucaoAplicada).toBe(
        "Trocada a lâmpada da vaga 34.",
      );
    });

    it("o agregado ANTES não muda — o comando devolve instância nova", () => {
      const antes = em("em_atendimento");
      antes.alterarPrioridade({ prioridade: "alta" });

      expect(antes.prioridade).toBe("normal");
    });

    it("trocar para o MESMO valor é legal, e devolve instância nova", () => {
      // **Não há guarda de igualdade, e a ausência é decisão.** O agregado não sabe se a escrita "vale a
      // pena"; a tela é que não dispara `change` sem mudança. Inventar a recusa aqui produziria um `409`
      // — ou um erro — para uma requisição que o contrato aceita.
      const antes = em("aberta");
      const depois = antes.alterarPrioridade({ prioridade: "normal" });

      expect(depois.prioridade).toBe("normal");
      expect(depois).not.toBe(antes);
    });

    it("estoura nos DOIS terminais, citando a invariante 7 — a guarda é rede, não decisão", () => {
      // **Alcançar isto é defeito NOSSO** — a Aplicação confere antes com `comandoPermitido`, e é ela quem
      // produz o `409`. Por isso é `Error`, e não `ErroDeDominio`.
      //
      // **E a mensagem cita a invariante 7**, ao contrário da do item 25, que não cita nenhuma: lá a
      // invariante 1 não estava em jogo; aqui a 7 é exatamente o que a guarda defende.
      for (const status of ["resolvida", "cancelada"] as const) {
        expect(() => em(status).alterarPrioridade({ prioridade: "alta" })).toThrow(
          `alterarPrioridade não age em estado terminal; a ocorrência está '${status}' — invariante 7 violada.`,
        );
      }
    });
  });

  describe("o comando cancelar — o das QUATRO origens, e o último da máquina de estados", () => {
    const ENTRADA = {
      autorPessoaId: GESTOR,
      ocorreuEm: "2026-08-28T18:40:00.000Z",
      motivo: "improcedente" as const,
      observacao: "Vistoriado no local: não há vazamento.",
    };

    /** As quatro setas que chegam a `Cancelada` (`arquitetura.md` §4). Escritas à mão, como as do
     *  `alterarPrioridade`: um teste que importasse a lista provaria a constante contra ela mesma. */
    const ORIGENS = ["aberta", "em_analise", "em_atendimento", "pausada"] as const;

    it("sai das QUATRO origens para cancelada — o critério 18.2", () => {
      for (const origem of ORIGENS) {
        expect(em(origem).cancelar(ENTRADA).status).toBe("cancelada");
      }
    });

    it("acrescenta UM registro, com os cinco campos do F5 mais o motivo — a invariante 2", () => {
      for (const origem of ORIGENS) {
        const antes = em(origem);
        const depois = antes.cancelar(ENTRADA);
        const registro = depois.ultimaTransicao;

        expect(depois.trilha).toHaveLength(antes.trilha.length + 1);
        expect(registro.sequencia).toBe(antes.ultimaTransicao.sequencia + 1);
        expect(registro.statusAnterior).toBe(origem);
        expect(registro.statusNovo).toBe("cancelada");
        expect(registro.ocorreuEm).toBe("2026-08-28T18:40:00.000Z");
        expect(registro.autorPessoaId).toBe(GESTOR);
        expect(registro.observacao).toBe("Vistoriado no local: não há vazamento.");
        expect(registro.motivoCancelamento).toBe("improcedente");
        // **O outro lado do `registros_transicao_motivo_ck`**: destino `cancelada` exige
        // `motivo_cancelamento` e proíbe... nada, mas `motivoPausa` só pode existir em `pausada`.
        expect(registro.motivoPausa).toBeNull();
      }
    });

    it("estoura nos DOIS terminais, citando a invariante 1 — a rede estrutural", () => {
      // **Alcançar isto é defeito NOSSO** — quem decide é `transicaoPermitida`, na Aplicação, e é ela
      // quem produz o `409`. Por isso é `Error`, e não `ErroDeDominio`.
      for (const status of ["resolvida", "cancelada"] as const) {
        expect(() => em(status).cancelar(ENTRADA)).toThrow(/cancelar exige um estado não terminal/u);
        expect(() => em(status).cancelar(ENTRADA)).toThrow(/invariante 1 violada/u);
      }
    });

    it("a guarda concorda com TRANSICOES nos seis status — a quarta lista, fechada por comportamento", () => {
      // **O achado P-3 do plano, virado teste.** `ORIGENS_DE_CANCELAMENTO` é uma quarta lista de estados
      // no Domínio, e `transicaoPermitida(status, "cancelar")` responde exatamente a mesma pergunta. A
      // cópia ficou por simetria do arquivo; o que a impede de divergir é isto: se um sétimo estado
      // entrar numa das duas listas e não na outra, este caso cai.
      for (const status of STATUS_TODOS) {
        const permitido = transicaoPermitida(status, "cancelar");
        let estourou = false;
        try {
          em(status).cancelar(ENTRADA);
        } catch {
          estourou = true;
        }

        expect(estourou).toBe(!permitido);
      }
    });

    it("o agregado ANTES não muda — a trilha é append-only e a cópia é nova", () => {
      const antes = em("em_analise");
      const tamanho = antes.trilha.length;

      antes.cancelar(ENTRADA);

      expect(antes.status).toBe("em_analise");
      expect(antes.trilha).toHaveLength(tamanho);
    });

    it("solucaoAplicada SOBREVIVE ao cancelamento — encerrar não é apagar o trabalho descrito", () => {
      // **`comTransicao` sem o terceiro parâmetro**, como em `pausar` e `retomar`. O caminho é real:
      // `registrar-solucao-aplicada` é admitido em `em_atendimento` e em `pausada`, e dos dois se
      // cancela.
      const comSolucao = Ocorrencia.reconstituir({
        ...ABERTA,
        status: "em_atendimento",
        solucaoAplicada: "Troquei o disjuntor.",
      });

      expect(comSolucao.cancelar(ENTRADA).solucaoAplicada).toBe("Troquei o disjuntor.");

      // E pelo caminho de verdade, atravessando o agregado: registrar a solução e cancelar depois.
      const atravessada = Ocorrencia.reconstituir({ ...ABERTA, status: "em_atendimento" })
        .registrarSolucaoAplicada({ solucaoAplicada: "Trocada a lâmpada da vaga 34." })
        .cancelar(ENTRADA);

      expect(atravessada.status).toBe("cancelada");
      expect(atravessada.solucaoAplicada).toBe("Trocada a lâmpada da vaga 34.");
    });

    it("os QUATRO motivos do autor e os TRÊS do Gestor chegam ao registro — o domínio de valor é um só", () => {
      // A divisão por papel é **autorização**, e ela mora na Aplicação. O agregado grava o que recebe.
      for (const motivo of MOTIVOS_DE_CANCELAMENTO) {
        expect(em("aberta").cancelar({ ...ENTRADA, motivo }).ultimaTransicao.motivoCancelamento).toBe(
          motivo,
        );
      }
    });
  });
});

describe("RegistroDeTransicao.avanco", () => {
  const BASE = {
    sequencia: 2,
    statusAnterior: "aberta" as const,
    statusNovo: "em_analise" as const,
    ocorreuEm: "2026-08-27T09:14:00.000Z",
    autorPessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f",
    observacao: null,
  };

  it("produz registro sem motivo — avanço rotineiro não tem o que justificar (D23)", () => {
    const registro = RegistroDeTransicao.avanco(BASE);

    expect(registro.motivoPausa).toBeNull();
    expect(registro.motivoCancelamento).toBeNull();
    expect(Object.isFrozen(registro)).toBe(true);
  });

  it("recusa pausada e cancelada — é o CHECK do banco expresso em fábrica", () => {
    // `registros_transicao_motivo_ck` exige motivo E observação nesses dois destinos. Os itens 23 e 18
    // **ganharam** as fábricas próprias — `pausa` e `cancelamento` —, e esta porta continua não deixando
    // nenhum dos dois destinos nascer sem motivo. Com as duas construídas, o caso deixa de guardar uma
    // dívida e passa a guardar a fronteira: `avanco` não as dispensa.
    for (const destino of ["pausada", "cancelada"] as const) {
      expect(() => RegistroDeTransicao.avanco({ ...BASE, statusNovo: destino })).toThrow(/motivo/u);
    }
  });
});

describe("RegistroDeTransicao.pausa — a segunda fábrica, e a primeira com campo obrigatório", () => {
  const BASE = {
    sequencia: 3,
    statusAnterior: "em_atendimento" as const,
    ocorreuEm: "2026-08-28T15:20:00.000Z",
    autorPessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f",
    observacao: "Sem lâmpada no estoque; pedido feito ao fornecedor.",
    motivoPausa: "aguardando_peca" as const,
  };

  it("grava motivoPausa e NÃO grava motivoCancelamento — os dois lados do CHECK", () => {
    const registro = RegistroDeTransicao.pausa(BASE);

    expect(registro.statusNovo).toBe("pausada");
    expect(registro.statusAnterior).toBe("em_atendimento");
    expect(registro.motivoPausa).toBe("aguardando_peca");
    expect(registro.motivoCancelamento).toBeNull();
    expect(registro.observacao).toBe("Sem lâmpada no estoque; pedido feito ao fornecedor.");
  });

  it("não recebe statusNovo: o destino é sempre pausada, e não há como apontá-lo para outro lugar", () => {
    // A prova é de tipo, e é o compilador que a faz. Em tempo de execução resta conferir o destino.
    expect(RegistroDeTransicao.pausa({ ...BASE, statusAnterior: "em_analise" }).statusNovo).toBe(
      "pausada",
    );
  });

  it("estoura com observação em branco — o CHECK do banco distingue '' de texto, e o tipo não", () => {
    expect(() => RegistroDeTransicao.pausa({ ...BASE, observacao: "   " })).toThrow(/observação/i);
    expect(() => RegistroDeTransicao.pausa({ ...BASE, observacao: "" })).toThrow(/observação/i);
  });
});

describe("RegistroDeTransicao.cancelamento — a terceira fábrica, e a espelhada da pausa", () => {
  const BASE = {
    sequencia: 4,
    statusAnterior: "em_atendimento" as const,
    ocorreuEm: "2026-08-28T18:40:00.000Z",
    autorPessoaId: "9f1e2d3c-4b5a-4c6d-8e7f-0a1b2c3d4e5f",
    observacao: "Vistoriado no local: não há vazamento.",
    motivoCancelamento: "improcedente" as const,
  };

  it("grava motivoCancelamento e NÃO grava motivoPausa — o outro lado do mesmo CHECK", () => {
    const registro = RegistroDeTransicao.cancelamento(BASE);

    expect(registro.statusNovo).toBe("cancelada");
    expect(registro.statusAnterior).toBe("em_atendimento");
    expect(registro.motivoCancelamento).toBe("improcedente");
    expect(registro.motivoPausa).toBeNull();
    expect(registro.observacao).toBe("Vistoriado no local: não há vazamento.");
    expect(Object.isFrozen(registro)).toBe(true);
  });

  it("não recebe statusNovo: o destino é sempre cancelada — as QUATRO origens chegam ao mesmo lugar", () => {
    // A prova é de tipo, e é o compilador que a faz. Em tempo de execução resta conferir o destino.
    for (const origem of ["aberta", "em_analise", "em_atendimento", "pausada"] as const) {
      expect(RegistroDeTransicao.cancelamento({ ...BASE, statusAnterior: origem }).statusNovo).toBe(
        "cancelada",
      );
    }
  });

  it("estoura com observação em branco — a invariante 5 cobrada onde o tipo não alcança", () => {
    expect(() => RegistroDeTransicao.cancelamento({ ...BASE, observacao: "   " })).toThrow(
      /observação/i,
    );
    expect(() => RegistroDeTransicao.cancelamento({ ...BASE, observacao: "" })).toThrow(
      /observação/i,
    );
  });
});

describe("motivosPermitidos — o conjunto é do Domínio, a checagem é da Aplicação", () => {
  it("sem cancelar_qualquer devolve os QUATRO do autor; com ela, os SETE", () => {
    expect(motivosPermitidos(["ocorrencia.cancelar_propria"])).toStrictEqual([
      "desistencia",
      "resolvido_por_conta_propria",
      "aberta_por_engano",
      "duplicada",
    ]);

    expect(
      motivosPermitidos(["ocorrencia.cancelar_propria", "ocorrencia.cancelar_qualquer"]),
    ).toHaveLength(7);
  });

  it("lista vazia de permissões cai no conjunto do autor — o padrão é o menor", () => {
    expect(motivosPermitidos([])).toStrictEqual(MOTIVOS_DO_AUTOR);
  });

  it("MOTIVOS_DO_AUTOR é subconjunto de MOTIVOS_DE_CANCELAMENTO — o que o slice daria de graça", () => {
    // **O preço da lista literal, e vale pagá-lo.** `MOTIVOS_DE_CANCELAMENTO.slice(0, 4)` garantiria a
    // inclusão por construção e mentiria no dia em que alguém inserisse o oitavo motivo no meio do enum.
    // A lista literal escreve a intenção; este caso compra de volta a garantia que o `slice` dava.
    for (const motivo of MOTIVOS_DO_AUTOR) {
      expect(MOTIVOS_DE_CANCELAMENTO).toContain(motivo);
    }
  });
});

describe("PrioridadeImutavelEmEstadoTerminal — a segunda recusa de estado do produto", () => {
  it("carrega o codigo do contrato e os textos publicados, literais", () => {
    // **O `codigo` é o contrato; `titulo` e `detalhe` são texto para humano — e os dois são LITERAIS do
    // `openapi.yaml:1664` e `:1666`.** `detail` publicado é contrato, não frase nova.
    const erro = new PrioridadeImutavelEmEstadoTerminal("resolvida", []);

    expect(erro.codigo).toBe("PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL");
    expect(erro.titulo).toBe("Prioridade congelada");
    expect(erro.detalhe).toBe(
      "A prioridade não muda depois de resolvida ou cancelada, para o dashboard não mudar o passado.",
    );
  });

  it("carrega as DUAS extensoes, como a irma — nao ha forma de construi-la incompleta", () => {
    // **As duas, sempre.** O exemplo do `openapi.yaml:1662-1669` mostra só `statusAtual`, e é o achado
    // **A-2** da spec: o schema `Problema` (`:2420-2426`) declara as duas como extensões *"em conflitos de
    // estado"*, e isto é um conflito de estado. Enviar só uma criaria a terceira forma de corpo de `409`.
    const erro = new PrioridadeImutavelEmEstadoTerminal("cancelada", ["avaliar"]);

    expect(erro.extensoes["statusAtual"]).toBe("cancelada");
    expect(erro.extensoes["acoesDisponiveis"]).toStrictEqual(["avaliar"]);
  });
});
