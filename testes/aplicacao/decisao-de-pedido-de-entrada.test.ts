import { describe, expect, it } from "vitest";

import {
  AreaInvalida,
  JaVinculado,
  PedidoJaDecidido,
  PedidoNaoEncontrado,
  aprovarPedidoDeEntrada,
  listarPedidosDeEntrada,
  recusarPedidoDeEntrada,
  type PedidoDeEntradaLido,
  type RepositorioEscopadoDePedidosDeEntrada,
  type ResultadoDaAprovacao,
  type ResultadoDaRecusa,
  type VinculoLido,
} from "@/aplicacao/organizacao";

/**
 * ============================================================================
 *  Os dois comandos da decisão — item 8 (D25)
 * ============================================================================
 *
 * **O que está sob teste é a tradução**, e só ela: desfecho da porta → recusa nomeada do contrato. As
 * garantias que produzem os desfechos são do banco — o `update` condicional, a `PRIMARY KEY` de `vinculos`
 * e a FK composta da Área —, e provar aquilo contra um duplo provaria que o duplo simula (tarefa 8).
 *
 * **Sem banco, em milissegundos**, que é o que a ADR-0005 comprou ao pôr a porta na camada que a consome.
 */

const VINCULO: VinculoLido = {
  pessoa: { pessoaId: "pessoa-1", nome: "Camila Duarte", contatos: [] },
  papel: "solicitante",
  area: { id: "area-1", nome: "Apartamento 302", tipo: "privativa" },
  temConta: true,
  criadoEm: "2026-08-23T12:00:00.000Z",
};

const PEDIDO: PedidoDeEntradaLido = {
  id: "pedido-1",
  pessoa: { pessoaId: "pessoa-1", nome: "Camila Duarte", telefoneInformado: "+5511988771234" },
  situacao: "recusado",
  criadoEm: "2026-08-21T12:00:00.000Z",
  decididoEm: "2026-08-23T12:00:00.000Z",
  decididoPor: { pessoaId: "gestora-1", nome: "Marina Rocha" },
};

/** O duplo da porta escopada. Cada teste diz o desfecho que quer, e inspeciona o que a porta recebeu. */
function portaFalsa(
  aprovacao: ResultadoDaAprovacao,
  recusa: ResultadoDaRecusa = { desfecho: "recusado", pedido: PEDIDO },
): {
  porta: RepositorioEscopadoDePedidosDeEntrada;
  recebido: { aprovar?: unknown; recusar?: unknown; listar?: unknown };
} {
  const recebido: { aprovar?: unknown; recusar?: unknown; listar?: unknown } = {};
  return {
    recebido,
    porta: {
      listar(opcoes) {
        recebido.listar = opcoes;
        return Promise.resolve([PEDIDO]);
      },
      aprovar(decisao) {
        recebido.aprovar = decisao;
        return Promise.resolve(aprovacao);
      },
      recusar(decisao) {
        recebido.recusar = decisao;
        return Promise.resolve(recusa);
      },
    },
  };
}

describe("aprovar", () => {
  it("devolve o vínculo criado, com papel e unidade", async () => {
    const { porta, recebido } = portaFalsa({ desfecho: "aprovado", vinculo: VINCULO });

    const vinculo = await aprovarPedidoDeEntrada(porta, {
      pedidoId: "pedido-1",
      papel: "solicitante",
      areaId: "area-1",
      decididoPorPessoaId: "gestora-1",
    });

    expect(vinculo.papel).toBe("solicitante");
    expect(vinculo.area?.nome).toBe("Apartamento 302");
    expect(recebido.aprovar).toStrictEqual({
      pedidoId: "pedido-1",
      papel: "solicitante",
      areaId: "area-1",
      decididoPorPessoaId: "gestora-1",
    });
  });

  it("sem unidade, passa null para a porta", async () => {
    const semArea: VinculoLido = { ...VINCULO, papel: "gestor", area: null };
    const { porta, recebido } = portaFalsa({ desfecho: "aprovado", vinculo: semArea });

    const vinculo = await aprovarPedidoDeEntrada(porta, {
      pedidoId: "pedido-1",
      papel: "gestor",
      areaId: null,
      decididoPorPessoaId: "gestora-1",
    });

    expect(vinculo.area).toBeNull();
    expect(recebido.aprovar).toMatchObject({ areaId: null });
  });

  it("traduz os quatro desfechos de recusa", async () => {
    const casos = [
      { desfecho: "nao-encontrado" as const, erro: PedidoNaoEncontrado },
      { desfecho: "ja-decidido" as const, erro: PedidoJaDecidido },
      { desfecho: "ja-vinculado" as const, erro: JaVinculado },
      { desfecho: "area-invalida" as const, erro: AreaInvalida },
    ];

    for (const caso of casos) {
      const { porta } = portaFalsa({ desfecho: caso.desfecho });
      await expect(
        aprovarPedidoDeEntrada(porta, {
          pedidoId: "pedido-1",
          papel: "solicitante",
          areaId: null,
          decididoPorPessoaId: "gestora-1",
        }),
      ).rejects.toBeInstanceOf(caso.erro);
    }
  });
});

describe("recusar", () => {
  it("devolve o pedido recusado e passa a observação", async () => {
    const { porta, recebido } = portaFalsa({ desfecho: "nao-encontrado" });

    const pedido = await recusarPedidoDeEntrada(porta, {
      pedidoId: "pedido-1",
      observacao: "Não consta na lista da administradora.",
      decididoPorPessoaId: "gestora-1",
    });

    expect(pedido.situacao).toBe("recusado");
    expect(recebido.recusar).toMatchObject({ observacao: "Não consta na lista da administradora." });
  });

  it("observação em branco vira null — o CHECK aceita, e branco não é explicação", async () => {
    const { porta, recebido } = portaFalsa({ desfecho: "nao-encontrado" });

    await recusarPedidoDeEntrada(porta, {
      pedidoId: "pedido-1",
      observacao: "   ",
      decididoPorPessoaId: "gestora-1",
    });

    expect(recebido.recusar).toMatchObject({ observacao: null });
  });

  it("traduz os dois desfechos de recusa", async () => {
    for (const caso of [
      { desfecho: "nao-encontrado" as const, erro: PedidoNaoEncontrado },
      { desfecho: "ja-decidido" as const, erro: PedidoJaDecidido },
    ]) {
      const { porta } = portaFalsa({ desfecho: "nao-encontrado" }, { desfecho: caso.desfecho });
      await expect(
        recusarPedidoDeEntrada(porta, {
          pedidoId: "pedido-1",
          observacao: null,
          decididoPorPessoaId: "gestora-1",
        }),
      ).rejects.toBeInstanceOf(caso.erro);
    }
  });
});

describe("listar", () => {
  it("sem filtro, pede só os pendentes — é o default do contrato", async () => {
    const { porta, recebido } = portaFalsa({ desfecho: "nao-encontrado" });

    await listarPedidosDeEntrada(porta, {});

    expect(recebido.listar).toStrictEqual({ situacoes: ["pendente"] });
  });

  it("com filtro, repassa as situações pedidas", async () => {
    const { porta, recebido } = portaFalsa({ desfecho: "nao-encontrado" });

    await listarPedidosDeEntrada(porta, { situacoes: ["aprovado", "recusado"] });

    expect(recebido.listar).toStrictEqual({ situacoes: ["aprovado", "recusado"] });
  });
});
