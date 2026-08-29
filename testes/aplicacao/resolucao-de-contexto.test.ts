import { describe, expect, it } from "vitest";

import {
  NOME_AUSENTE,
  NaoAutenticado,
  SemVinculoNaOrganizacao,
  escolherOrganizacaoAtiva,
  resolverContexto,
} from "@/aplicacao/contexto";
import { projetarContexto } from "@/interface/projecoes";

import { escolhaDaSessao, montarDuplos } from "./duplos";

/**
 * ============================================================================
 *  Unitário de APLICAÇÃO — sem banco, com repositório em memória
 *  (arquitetura.md §7 · ADR-0005)
 * ============================================================================
 *
 * **O que este arquivo prova, e é o item que esta tarefa exige:** que o contexto resolvido é o **da
 * sessão** — não o de outra pessoa, não o de um cabeçalho, não o de um cookie que o cliente escolheu.
 *
 * É o teste do ponto único de estrangulamento da ADR-0003, no cenário que o critério A4 nomeia: *"duas
 * organizações semeadas e **a mesma Pessoa vinculada às duas**"* — a Persona 1B. Semente com pessoas
 * distintas por organização **não detecta** o erro, porque o vazamento aparece justamente quando a Pessoa é
 * global e a consulta parte dela.
 */

// ---------------------------------------------------------------------------
// O cenário da Persona 1B, montado uma vez
// ---------------------------------------------------------------------------

/** A síndica profissional: uma Pessoa, dois vínculos, papéis diferentes (D4, Persona 1B). */
const PERSONA_1B = {
  pessoas: [{ pessoaId: "pessoa-sindica", usuarioId: "usuario-sindica", nome: "Síndica profissional" }],
  vinculos: [
    {
      pessoaId: "pessoa-sindica",
      organizacaoId: "organizacao-a",
      organizacaoNome: "Condomínio Recanto Azul",
      codigoPublico: "RECANTO7",
      papel: "gestor" as const,
    },
    {
      pessoaId: "pessoa-sindica",
      organizacaoId: "organizacao-b",
      organizacaoNome: "Edifício Alvorada",
      codigoPublico: "ALVORADA2",
      papel: "solicitante" as const,
    },
  ],
} as const;

/** Uma segunda Pessoa, numa das mesmas organizações. É a vizinha de quem os dados não podem vazar. */
const VIZINHA = {
  pessoaId: "pessoa-vizinha",
  usuarioId: "usuario-vizinha",
  nome: "Moradora do Recanto Azul",
} as const;

const VINCULO_DA_VIZINHA = {
  pessoaId: "pessoa-vizinha",
  organizacaoId: "organizacao-a",
  organizacaoNome: "Condomínio Recanto Azul",
  codigoPublico: "RECANTO7",
  papel: "solicitante" as const,
} as const;

const CENARIO = {
  pessoas: [...PERSONA_1B.pessoas, VIZINHA],
  vinculos: [...PERSONA_1B.vinculos, VINCULO_DA_VIZINHA],
};

// ---------------------------------------------------------------------------

describe("resolverContexto — o contexto é o da sessão", () => {
  it("resolve para a Pessoa da sessão, e não para outra do mesmo banco", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-vizinha", nomeSugerido: null }, CENARIO);

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.sessao.usuarioId).toBe("usuario-vizinha");
    expect(resolucao.sessao.pessoaId).toBe("pessoa-vizinha");
    expect(resolucao.sessao.nome).toBe("Moradora do Recanto Azul");

    // A consulta de vínculos partiu da Pessoa da sessão — de nenhuma outra.
    expect(duplos.rastro.consultasDeVinculo).toStrictEqual(["pessoa-vizinha"]);
  });

  it("a Pessoa da sessão só vê os próprios vínculos — nunca os da vizinha", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-sindica", nomeSugerido: null }, CENARIO);

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    // Ordem alfabética por nome de organização, com colação pt-BR — a mesma do `order by o.nome` do
    // repositório real: "Condomínio Recanto Azul" antes de "Edifício Alvorada".
    expect(resolucao.vinculos.map((v) => v.organizacao.id)).toStrictEqual([
      "organizacao-a",
      "organizacao-b",
    ]);

    for (const vinculo of resolucao.vinculos) {
      expect(vinculo.vinculo.pessoaId).toBe("pessoa-sindica");
    }
  });

  it("um cookie que aponte para organização sem vínculo é ignorado, não obedecido", async () => {
    // É o caso que a decisão da §4.2 do contrato existe para eliminar: a organização nunca é entrada livre
    // do cliente. Aqui o cookie pede uma organização em que a Pessoa não tem vínculo — e a resolução cai na
    // regra do estado inicial como se o cookie não existisse.
    const duplos = montarDuplos({ usuarioId: "usuario-vizinha", nomeSugerido: null }, CENARIO);

    const resolucao = await resolverContexto(
      duplos.portas,
      escolhaDaSessao({ "usuario-vizinha": "organizacao-b" }),
    );

    expect(resolucao.ativo?.organizacao.id).toBe("organizacao-a");
    expect(resolucao.escolhidaAutomaticamente).toBe(true);
  });

  it("a escolha de um usuário não vale para outro", async () => {
    // O cookie é assinado e amarrado ao `usuarioId` (contrato §4.3). O duplo reproduz a amarração: a
    // escolha registrada para a síndica não alcança a sessão da vizinha.
    const duplos = montarDuplos({ usuarioId: "usuario-vizinha", nomeSugerido: null }, CENARIO);

    const resolucao = await resolverContexto(
      duplos.portas,
      escolhaDaSessao({ "usuario-sindica": "organizacao-b" }),
    );

    expect(resolucao.ativo?.organizacao.id).toBe("organizacao-a");
  });

  it("sem sessão, recusa — e não consulta vínculo nenhum", async () => {
    const duplos = montarDuplos(null, PERSONA_1B);

    await expect(resolverContexto(duplos.portas, escolhaDaSessao())).rejects.toBeInstanceOf(
      NaoAutenticado,
    );
    expect(duplos.rastro.consultasDeVinculo).toStrictEqual([]);
    expect(duplos.rastro.pessoasCriadas).toBe(0);
  });

  it("carrega os pedidos de entrada da Pessoa, nas três situações", async () => {
    const pedidos = [
      {
        id: "ped-3",
        organizacao: { nome: "Edifício Alvorada" },
        situacao: "aprovado" as const,
        criadoEm: "2026-08-21T10:00:00.000Z",
      },
      {
        id: "ped-2",
        organizacao: { nome: "Edifício Aurora" },
        situacao: "recusado" as const,
        criadoEm: "2026-08-22T10:00:00.000Z",
      },
      {
        id: "ped-1",
        organizacao: { nome: "Condomínio Recanto Azul" },
        situacao: "pendente" as const,
        criadoEm: "2026-08-23T10:00:00.000Z",
      },
    ];

    const duplos = montarDuplos({ usuarioId: "usuario-vizinha", nomeSugerido: null }, {
      ...CENARIO,
      pedidos,
    });
    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.pedidos).toStrictEqual(pedidos);

    // A consulta partiu da Pessoa resolvida — "pessoa-vizinha" — nunca do `usuarioId` da sessão.
    expect(duplos.rastro.consultasDePedido).toStrictEqual(["pessoa-vizinha"]);
  });
});

describe("resolverContexto — a regra do estado inicial (contrato §4.3)", () => {
  it("com exatamente um vínculo, o servidor escolhe e sinaliza a gravação do cookie", async () => {
    const duplos = montarDuplos(
      { usuarioId: "usuario-vizinha", nomeSugerido: null },
      { pessoas: [VIZINHA], vinculos: [VINCULO_DA_VIZINHA] },
    );

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.ativo?.organizacao.nome).toBe("Condomínio Recanto Azul");
    expect(resolucao.ativo?.vinculo.papel).toBe("solicitante");
    expect(resolucao.escolhidaAutomaticamente).toBe(true);
  });

  it("com dois ou mais, não escolhe: a organização ativa vem nula — é a face D de T-02", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-sindica", nomeSugerido: null }, PERSONA_1B);

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.ativo).toBeNull();
    expect(resolucao.escolhidaAutomaticamente).toBe(false);
    expect(resolucao.vinculos).toHaveLength(2);
  });

  it("com dois ou mais e escolha válida, obedece — e não regrava o cookie", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-sindica", nomeSugerido: null }, PERSONA_1B);

    const resolucao = await resolverContexto(
      duplos.portas,
      escolhaDaSessao({ "usuario-sindica": "organizacao-b" }),
    );

    expect(resolucao.ativo?.organizacao.id).toBe("organizacao-b");
    expect(resolucao.ativo?.vinculo.papel).toBe("solicitante");
    expect(resolucao.escolhidaAutomaticamente).toBe(false);
  });

  it("com zero vínculos, não há o que escolher — é a face A de T-02", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-novo", nomeSugerido: "Helena Rocha" });

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.ativo).toBeNull();
    expect(resolucao.vinculos).toStrictEqual([]);
    expect(resolucao.escolhidaAutomaticamente).toBe(false);
  });

  it("vínculo revogado não conta — nem para a lista, nem para a escolha automática", async () => {
    const duplos = montarDuplos(
      { usuarioId: "usuario-sindica", nomeSugerido: null },
      {
        pessoas: PERSONA_1B.pessoas,
        vinculos: [PERSONA_1B.vinculos[0]!, { ...PERSONA_1B.vinculos[1]!, revogado: true }],
      },
    );

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.vinculos).toHaveLength(1);
    expect(resolucao.ativo?.organizacao.id).toBe("organizacao-a");
    expect(resolucao.escolhidaAutomaticamente).toBe(true);
  });
});

describe("resolverContexto — o ACL que garante a Pessoa (modelo §9.2)", () => {
  it("cria a Pessoa no primeiro acesso, com o nome vindo dos metadados da conta", async () => {
    // Contrato §4.1: `pessoas.nome` vem dos metadados da conta, preenchidos no cadastro — e é por isso que
    // T-11 pede o nome.
    const duplos = montarDuplos({ usuarioId: "usuario-novo", nomeSugerido: "  Helena Rocha  " });

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(duplos.rastro.pessoasCriadas).toBe(1);
    expect(resolucao.sessao.nome).toBe("Helena Rocha");
    expect(duplos.pessoas()).toHaveLength(1);
  });

  it("é idempotente: o segundo acesso não cria uma segunda Pessoa", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-novo", nomeSugerido: "Helena Rocha" });

    const primeira = await resolverContexto(duplos.portas, escolhaDaSessao());
    const segunda = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(duplos.rastro.pessoasCriadas).toBe(1);
    expect(segunda.sessao.pessoaId).toBe(primeira.sessao.pessoaId);
    expect(duplos.pessoas()).toHaveLength(1);
  });

  it("não recria a Pessoa que já existe, nem sobrescreve o nome dela", async () => {
    const duplos = montarDuplos(
      { usuarioId: "usuario-sindica", nomeSugerido: "Outro Nome Qualquer" },
      PERSONA_1B,
    );

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(duplos.rastro.pessoasCriadas).toBe(0);
    expect(resolucao.sessao.nome).toBe("Síndica profissional");
  });

  it("conta sem nome nos metadados cai no literal declarado, e não em credencial", async () => {
    // `pessoas.nome` é `NOT NULL`, então é preciso um valor. Cair no trecho local do e-mail poria
    // credencial na trilha imutável, contra o RNF10 — o achado está registrado em `resolver-contexto.ts`.
    const duplos = montarDuplos({ usuarioId: "usuario-sem-nome", nomeSugerido: "   " });

    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(resolucao.sessao.nome).toBe(NOME_AUSENTE);
  });
});

describe("a projeção de GET /contexto corresponde ao schema Contexto do openapi.yaml", () => {
  it("sem vínculo nenhum, é o exemplo semVinculo do openapi.yaml — e sustenta a face A de T-02", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-novo", nomeSugerido: "Helena Rocha" });
    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(projetarContexto(resolucao)).toStrictEqual({
      pessoa: { pessoaId: "pessoa-1", nome: "Helena Rocha" },
      organizacaoAtiva: null,
      papel: null,
      permissoes: [],
      vinculos: [],
      pedidosDeEntrada: [],
    });
  });

  it("com organização ativa, papel e permissões vêm do vínculo — e o Gestor acumula", async () => {
    const duplos = montarDuplos(
      { usuarioId: "usuario-sindica", nomeSugerido: null },
      { pessoas: PERSONA_1B.pessoas, vinculos: [PERSONA_1B.vinculos[0]!] },
    );
    const contexto = projetarContexto(await resolverContexto(duplos.portas, escolhaDaSessao()));

    expect(contexto.organizacaoAtiva).toStrictEqual({
      id: "organizacao-a",
      nome: "Condomínio Recanto Azul",
      codigoPublico: "RECANTO7",
    });
    expect(contexto.papel).toBe("gestor");
    expect(contexto.permissoes).toContain("ocorrencia.ler_todas");
    expect(contexto.permissoes).toContain("ocorrencia.registrar");
  });

  it("é o exemplo doisVinculos do openapi.yaml: nome e papel por organização, e nada mais", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-sindica", nomeSugerido: null }, PERSONA_1B);
    const contexto = projetarContexto(await resolverContexto(duplos.portas, escolhaDaSessao()));

    expect(contexto.vinculos).toStrictEqual([
      { organizacaoId: "organizacao-a", nome: "Condomínio Recanto Azul", papel: "gestor" },
      { organizacaoId: "organizacao-b", nome: "Edifício Alvorada", papel: "solicitante" },
    ]);

    // Nenhuma chave a mais: a face D mostra nome e papel porque é o que existe sem organização ativa
    // (contrato §4.4) — não há contagem de ocorrências por organização.
    for (const vinculo of contexto.vinculos) {
      expect(Object.keys(vinculo).sort()).toStrictEqual(["nome", "organizacaoId", "papel"]);
    }
  });
});

describe("escolherOrganizacaoAtiva — o PUT /contexto/organizacao sem consulta nenhuma (item 7b)", () => {
  /**
   * **A resolução da síndica: dois vínculos, nenhum ativo.** É exatamente o estado em que o `PUT` existe
   * para ser chamado — `escolherAtivo` só escolhe sozinho com **um** vínculo (contrato §4.3).
   */
  async function resolucaoDaSindica() {
    const duplos = montarDuplos({ usuarioId: "usuario-sindica", nomeSugerido: null }, CENARIO);
    return resolverContexto(duplos.portas, escolhaDaSessao());
  }

  it("troca para uma organização em que há vínculo, e devolve a resolução com ela ativa", async () => {
    const resolucao = await resolucaoDaSindica();
    expect(resolucao.ativo).toBeNull();

    const trocada = escolherOrganizacaoAtiva(resolucao, "organizacao-b");

    expect(trocada.ativo?.organizacao.id).toBe("organizacao-b");
    expect(trocada.ativo?.vinculo.papel).toBe("solicitante");
  });

  it("não escreve na resolução recebida — devolve outra", async () => {
    const resolucao = await resolucaoDaSindica();

    escolherOrganizacaoAtiva(resolucao, "organizacao-b");

    // O anel externo grava o cookie com o que a função devolveu; se ela mutasse a entrada, o `GET` e o
    // `PUT` da mesma requisição passariam a discordar sem que nada tivesse mudado de propósito.
    expect(resolucao.ativo).toBeNull();
  });

  it("depois da troca, escolhidaAutomaticamente é false — quem grava o cookie é o handler", async () => {
    const resolucao = await resolucaoDaSindica();

    const trocada = escolherOrganizacaoAtiva(resolucao, "organizacao-a");

    // `escolhidaAutomaticamente: true` é o sinal que faz `abrirRequisicao` gravar cookie sozinho
    // (`com-contexto.ts:290-296`). Aqui quem grava é o handler, uma vez, com o valor que o cliente pediu.
    expect(trocada.escolhidaAutomaticamente).toBe(false);
  });

  it("a lista de vínculos e os pedidos atravessam intactos", async () => {
    const resolucao = await resolucaoDaSindica();

    const trocada = escolherOrganizacaoAtiva(resolucao, "organizacao-b");

    expect(trocada.vinculos).toStrictEqual(resolucao.vinculos);
    expect(trocada.pedidos).toStrictEqual(resolucao.pedidos);
    expect(trocada.sessao).toStrictEqual(resolucao.sessao);
  });

  it("organização real onde a Pessoa não tem vínculo — recusa", async () => {
    // A vizinha tem vínculo só em `organizacao-a`. `organizacao-b` existe no cenário, e ela não está lá.
    const duplos = montarDuplos({ usuarioId: "usuario-vizinha", nomeSugerido: null }, CENARIO);
    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    expect(() => escolherOrganizacaoAtiva(resolucao, "organizacao-b")).toThrow(SemVinculoNaOrganizacao);
  });

  it("organização inexistente — a MESMA recusa, indistinguível (critério 7b.3)", async () => {
    const duplos = montarDuplos({ usuarioId: "usuario-vizinha", nomeSugerido: null }, CENARIO);
    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    const semVinculo = capturar(() => escolherOrganizacaoAtiva(resolucao, "organizacao-b"));
    const inexistente = capturar(() => escolherOrganizacaoAtiva(resolucao, "organizacao-que-nao-existe"));

    // **Não confirma existência** (contrato §4.3). A função nunca soube a diferença: ela só procura na
    // lista de vínculos, e a organização que não está lá é a mesma coisa nos dois casos.
    expect(semVinculo.codigo).toBe("SEM_VINCULO_NA_ORGANIZACAO");
    expect(inexistente.codigo).toBe(semVinculo.codigo);
    expect(inexistente.titulo).toBe(semVinculo.titulo);
    expect(inexistente.detalhe).toBe(semVinculo.detalhe);
  });

  it("vínculo revogado não serve para escolher", async () => {
    const duplos = montarDuplos(
      { usuarioId: "usuario-sindica", nomeSugerido: null },
      {
        pessoas: PERSONA_1B.pessoas,
        vinculos: [PERSONA_1B.vinculos[0]!, { ...PERSONA_1B.vinculos[1]!, revogado: true }],
      },
    );
    const resolucao = await resolverContexto(duplos.portas, escolhaDaSessao());

    // Nada de novo a implementar: o vínculo revogado nunca entra em `resolucao.vinculos`, então a busca
    // não o acha. O caso está aqui porque é o do item 10, e alguém vai perguntar.
    expect(() => escolherOrganizacaoAtiva(resolucao, "organizacao-b")).toThrow(SemVinculoNaOrganizacao);
  });
});

/** O erro de domínio lançado, com os três textos à mão — `expect().toThrow` só compara a classe. */
function capturar(acao: () => unknown): SemVinculoNaOrganizacao {
  try {
    acao();
  } catch (erro) {
    if (erro instanceof SemVinculoNaOrganizacao) return erro;
    throw erro;
  }
  throw new Error("esperava SemVinculoNaOrganizacao, e nada foi lançado");
}
