import { describe, expect, it } from "vitest";

import {
  AreaInvalida,
  ContatoDuplicado,
  PessoaComContaNaoEditavel,
  UltimoGestor,
  VinculoComHistorico,
  VinculoNaoEncontrado,
  cadastrarVinculo,
  corrigirVinculo,
  listarVinculos,
  removerVinculo,
  type RepositorioEscopadoDeVinculos,
  type ResultadoDaCorrecao,
  type ResultadoDaRemocao,
  type ResultadoDoCadastro,
  type VinculoLido,
} from "@/aplicacao/organizacao";

/**
 * ============================================================================
 *  Os três casos de uso do vínculo — item 9a (D27)
 * ============================================================================
 *
 * **O que está sob teste é a tradução**, e só ela: desfecho da porta → recusa nomeada do contrato. As
 * garantias que produzem os desfechos são do banco — a CTE que cria Pessoa e Vínculo juntos, a FK composta
 * da Área e o `where usuario_id is null` da correção —, e prová-las contra um duplo provaria que o duplo
 * simula. Elas são da tarefa 2, contra Postgres de verdade.
 */

const ENCARREGADO: VinculoLido = {
  pessoa: { pessoaId: "pessoa-1", nome: "Sebastião Alves de Moura", contatos: [] },
  papel: "encarregado",
  area: null,
  temConta: false,
  criadoEm: "2026-08-23T12:00:00.000Z",
};

/** O duplo da porta. Cada teste diz o desfecho que quer, e inspeciona o que a porta recebeu. */
function portaFalsa(
  cadastro: ResultadoDoCadastro = { desfecho: "cadastrado", vinculo: ENCARREGADO },
  correcao: ResultadoDaCorrecao = { desfecho: "corrigido", vinculo: ENCARREGADO },
  remocao: ResultadoDaRemocao = { desfecho: "removido" },
): {
  porta: RepositorioEscopadoDeVinculos;
  recebido: { cadastrar?: unknown; corrigir?: unknown; remover?: unknown };
} {
  const recebido: { cadastrar?: unknown; corrigir?: unknown; remover?: unknown } = {};
  return {
    recebido,
    porta: {
      ativos: () => Promise.resolve([ENCARREGADO]),
      porPessoa: () => Promise.resolve(ENCARREGADO),
      cadastrar(dados) {
        recebido.cadastrar = dados;
        return Promise.resolve(cadastro);
      },
      corrigir(dados) {
        recebido.corrigir = dados;
        return Promise.resolve(correcao);
      },
      remover(pessoaId) {
        recebido.remover = pessoaId;
        return Promise.resolve(remocao);
      },
      // **Nunca chamada pelo caso de uso**, e é o ponto: `impedimentosDeRemocao` existe para a TELA
      // (spec §3.4). Se algum dia `removerVinculo` a chamar, o desfecho deixou de vir do banco.
      impedimentosDeRemocao: () => {
        throw new Error("removerVinculo não lê impedimentos — o desfecho vem do banco.");
      },
    },
  };
}

describe("listarVinculos", () => {
  it("devolve o que a porta devolveu, sem reordenar nem filtrar", async () => {
    const { porta } = portaFalsa();
    expect(await listarVinculos(porta)).toStrictEqual([ENCARREGADO]);
  });
});

describe("cadastrarVinculo", () => {
  it("apara o nome antes de gravar — o que vai para a trilha imutável não leva espaço de sobra", async () => {
    const { porta, recebido } = portaFalsa();

    await cadastrarVinculo(porta, {
      nome: "  Sebastião Alves de Moura  ",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });

    expect(recebido.cadastrar).toStrictEqual({
      nome: "Sebastião Alves de Moura",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
  });

  it("devolve o vínculo criado", async () => {
    const { porta } = portaFalsa();
    const vinculo = await cadastrarVinculo(porta, {
      nome: "Sebastião",
      papel: "encarregado",
      areaId: null,
      contatos: [],
    });
    expect(vinculo).toStrictEqual(ENCARREGADO);
  });

  it("área inválida vira AreaInvalida — 422, não 400: a forma estava certa", async () => {
    const { porta } = portaFalsa({ desfecho: "area-invalida" });
    await expect(
      cadastrarVinculo(porta, {
        nome: "Sebastião",
        papel: "encarregado",
        areaId: "area-de-outra",
        contatos: [],
      }),
    ).rejects.toBeInstanceOf(AreaInvalida);
  });
});

describe("corrigirVinculo", () => {
  it("sem vínculo nesta organização é 404, e a resposta é a mesma de inexistente", async () => {
    const { porta } = portaFalsa(undefined, { desfecho: "nao-encontrado" });
    await expect(
      corrigirVinculo(porta, { pessoaId: "pessoa-9", nome: "Outro" }),
    ).rejects.toBeInstanceOf(VinculoNaoEncontrado);
  });

  it("nome de quem tem conta é 409 — o cadastro dela vale em outras organizações", async () => {
    const { porta } = portaFalsa(undefined, { desfecho: "pessoa-com-conta" });
    await expect(
      corrigirVinculo(porta, { pessoaId: "pessoa-1", nome: "Marina" }),
    ).rejects.toBeInstanceOf(PessoaComContaNaoEditavel);
  });

  it("areaId null atravessa como null — é *tire a unidade*, não *não mexa*", async () => {
    const { porta, recebido } = portaFalsa();
    await corrigirVinculo(porta, { pessoaId: "pessoa-1", areaId: null });
    expect(recebido.corrigir).toStrictEqual({ pessoaId: "pessoa-1", areaId: null });
  });

  it("campo ausente não atravessa — omitir não mexe em nada", async () => {
    const { porta, recebido } = portaFalsa();
    await corrigirVinculo(porta, { pessoaId: "pessoa-1", nome: "Novo nome" });
    expect(recebido.corrigir).toStrictEqual({ pessoaId: "pessoa-1", nome: "Novo nome" });
  });
});

describe("contatos — a tradução do desfecho e o que não pode ser inventado", () => {
  const UM_CONTATO = [
    {
      tipo: "telefone" as const,
      valor: "+5511955217788",
      finalidade: "trabalho" as const,
      temWhatsapp: true,
      observacao: null,
    },
  ];

  it("cadastrar traduz contato-duplicado em CONTATO_DUPLICADO", async () => {
    const { porta } = portaFalsa({ desfecho: "contato-duplicado" });

    await expect(
      cadastrarVinculo(porta, {
        nome: "Sebastião",
        papel: "encarregado",
        areaId: null,
        contatos: UM_CONTATO,
      }),
    ).rejects.toBeInstanceOf(ContatoDuplicado);
  });

  it("corrigir traduz contato-duplicado em CONTATO_DUPLICADO", async () => {
    const { porta } = portaFalsa(undefined, { desfecho: "contato-duplicado" });

    await expect(
      corrigirVinculo(porta, { pessoaId: "pessoa-1", contatos: UM_CONTATO }),
    ).rejects.toBeInstanceOf(ContatoDuplicado);
  });

  it("a lista chega à porta como veio — a Aplicação não reordena nem apara contato", async () => {
    const { porta, recebido } = portaFalsa();
    await cadastrarVinculo(porta, {
      nome: "  Sebastião  ",
      papel: "encarregado",
      areaId: null,
      contatos: UM_CONTATO,
    });

    // O `nome` é aparado — vai para a trilha imutável. O contato, não: quem o normaliza é o schema.
    expect(recebido.cadastrar).toStrictEqual({
      nome: "Sebastião",
      papel: "encarregado",
      areaId: null,
      contatos: UM_CONTATO,
    });
  });

  /**
   * **O caso que protege dado de gente.** Corrigir só a unidade não pode inventar `contatos: []` no
   * caminho — a porta tem de receber um objeto **sem a chave**, que é o *"não mexa"* do contrato §8.2.
   */
  it("corrigir sem contatos entrega à porta um objeto SEM a chave contatos", async () => {
    const { porta, recebido } = portaFalsa();
    await corrigirVinculo(porta, { pessoaId: "pessoa-1", areaId: null });

    expect(Object.hasOwn(recebido.corrigir as object, "contatos")).toBe(false);
  });
});

/**
 * **Os três desfechos de recusa, e o que está sob teste é a TRADUÇÃO** — desfecho da porta → recusa
 * nomeada do contrato. As garantias que produzem os desfechos são do banco: as nove chaves estrangeiras
 * `on delete restrict` e a guarda do último Gestor dentro do `where`. Prová-las contra um duplo provaria
 * que o duplo simula. Elas são da tarefa 2, contra Postgres de verdade.
 */
describe("removerVinculo", () => {
  it("no caminho feliz não devolve nada, e entrega à porta o pessoaId cru", async () => {
    const { porta, recebido } = portaFalsa();

    await expect(removerVinculo(porta, "pessoa-1")).resolves.toBeUndefined();
    expect(recebido.remover).toBe("pessoa-1");
  });

  it("traduz nao-encontrado em VINCULO_NAO_ENCONTRADO", async () => {
    const { porta } = portaFalsa(undefined, undefined, { desfecho: "nao-encontrado" });

    await expect(removerVinculo(porta, "pessoa-1")).rejects.toBeInstanceOf(VinculoNaoEncontrado);
  });

  it("traduz com-historico em VINCULO_COM_HISTORICO", async () => {
    const { porta } = portaFalsa(undefined, undefined, { desfecho: "com-historico" });

    await expect(removerVinculo(porta, "pessoa-1")).rejects.toBeInstanceOf(VinculoComHistorico);
  });

  it("traduz ultimo-gestor em ULTIMO_GESTOR", async () => {
    const { porta } = portaFalsa(undefined, undefined, { desfecho: "ultimo-gestor" });

    await expect(removerVinculo(porta, "pessoa-1")).rejects.toBeInstanceOf(UltimoGestor);
  });
});
