import { describe, expect, it } from "vitest";

import {
  CodigoPublicoNaoEncontrado,
  JaVinculado,
  lerConvite,
  pedirEntrada,
  PedidoDeEntradaPendente,
  type RepositorioDeConvites,
  type RepositorioDePedidosDeEntrada,
  type ResultadoDoPedidoDeEntrada,
} from "@/aplicacao/organizacao";

/**
 * O comando `pedirEntrada`, com a porta substituída **pela porta** — não por *mock* de módulo (ADR-0005).
 *
 * O que está sob teste aqui é a tradução de desfecho em recusa nomeada, e a regra de correção do nome. O
 * que a escrita faz no banco é a tarefa 8, contra Postgres.
 */
const PEDIDO = {
  id: "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9",
  organizacao: { nome: "Condomínio Recanto Azul" },
  situacao: "pendente",
  criadoEm: "2026-08-23T13:02:11.000Z",
} as const;

const SESSAO = { pessoaId: "p-1", nome: "Helena Rocha" };

function duplo(resultado: ResultadoDoPedidoDeEntrada) {
  const recebidos: Array<Parameters<RepositorioDePedidosDeEntrada["registrar"]>[0]> = [];
  const porta: RepositorioDePedidosDeEntrada = {
    async registrar(dados) {
      recebidos.push(dados);
      return resultado;
    },
  };
  return { porta, recebidos };
}

describe("pedirEntrada", () => {
  it("devolve o pedido registrado no caminho feliz", async () => {
    const { porta } = duplo({ desfecho: "registrado", pedido: PEDIDO });

    const pedido = await pedirEntrada(
      { pedidosDeEntrada: porta },
      SESSAO,
      { codigoPublico: "RECANTO7", nome: null, telefone: null },
      false,
    );

    expect(pedido).toStrictEqual(PEDIDO);
  });

  it("traduz cada desfecho de recusa no erro nomeado do contrato", async () => {
    const casos = [
      { desfecho: "codigo-nao-encontrado", erro: CodigoPublicoNaoEncontrado, codigo: "CODIGO_PUBLICO_NAO_ENCONTRADO" },
      { desfecho: "ja-vinculado", erro: JaVinculado, codigo: "JA_VINCULADO" },
      { desfecho: "ja-pendente", erro: PedidoDeEntradaPendente, codigo: "PEDIDO_DE_ENTRADA_PENDENTE" },
    ] as const;

    for (const caso of casos) {
      const { porta } = duplo({ desfecho: caso.desfecho });
      const chamada = pedirEntrada(
        { pedidosDeEntrada: porta },
        SESSAO,
        { codigoPublico: "RECANTO7", nome: null, telefone: null },
        false,
      );

      await expect(chamada).rejects.toBeInstanceOf(caso.erro);
      await expect(chamada).rejects.toMatchObject({ codigo: caso.codigo });
    }
  });

  /**
   * **O campo `nome` vem pré-preenchido com o nome atual** (inventário, T-02 face A). Quem não o toca envia
   * o valor que já estava, e isso não é uma correção — é o formulário devolvendo o que recebeu.
   */
  it("só manda corrigir o nome quando ele mudou de verdade", async () => {
    const iguais = duplo({ desfecho: "registrado", pedido: PEDIDO });
    await pedirEntrada(
      { pedidosDeEntrada: iguais.porta },
      SESSAO,
      { codigoPublico: "RECANTO7", nome: "Helena Rocha", telefone: null },
      false,
    );
    expect(iguais.recebidos[0]?.nome).toBeNull();

    const vazio = duplo({ desfecho: "registrado", pedido: PEDIDO });
    await pedirEntrada(
      { pedidosDeEntrada: vazio.porta },
      SESSAO,
      { codigoPublico: "RECANTO7", nome: "   ", telefone: null },
      false,
    );
    expect(vazio.recebidos[0]?.nome).toBeNull();

    const mudou = duplo({ desfecho: "registrado", pedido: PEDIDO });
    await pedirEntrada(
      { pedidosDeEntrada: mudou.porta },
      SESSAO,
      { codigoPublico: "RECANTO7", nome: "  Helena R. Rocha  ", telefone: null },
      false,
    );
    expect(mudou.recebidos[0]?.nome).toBe("Helena R. Rocha");
  });

  it("repassa o telefone e o código sem tocá-los — quem normaliza é a tela, quem confere é o schema", async () => {
    const { porta, recebidos } = duplo({ desfecho: "registrado", pedido: PEDIDO });

    await pedirEntrada(
      { pedidosDeEntrada: porta },
      SESSAO,
      { codigoPublico: "AURORA22", nome: null, telefone: "+5511999990000" },
      false,
    );

    expect(recebidos[0]).toStrictEqual({
      pessoaId: "p-1",
      codigoPublico: "AURORA22",
      nome: null,
      telefone: "+5511999990000",
    });
  });

  it("quem já tem vínculo em alguma organização não reescreve o próprio nome (critério 7b.8)", async () => {
    const { porta, recebidos } = duplo({ desfecho: "registrado", pedido: PEDIDO });

    await pedirEntrada(
      { pedidosDeEntrada: porta },
      SESSAO,
      { codigoPublico: "ALVORADA2", nome: "Helena R. da Silva", telefone: null },
      true,
    );

    /**
     * **`pessoas` é tabela global.** Corrigir o nome aqui renomearia a Pessoa **dentro de A também** — e o
     * nome dela já está na trilha imutável de A. A correção do critério **7a.5** é *"o último ponto em que
     * o nome é corrigível"* para quem **não tem vínculo nenhum**; para quem tem, não há ponto nenhum.
     */
    expect(recebidos[0]?.nome).toBeNull();
  });

  it("quem não tem vínculo nenhum continua podendo corrigir — o 7a.5 não muda", async () => {
    const { porta, recebidos } = duplo({ desfecho: "registrado", pedido: PEDIDO });

    await pedirEntrada(
      { pedidosDeEntrada: porta },
      SESSAO,
      { codigoPublico: "RECANTO7", nome: "Helena R. da Silva", telefone: null },
      false,
    );

    expect(recebidos[0]?.nome).toBe("Helena R. da Silva");
  });
});

describe("lerConvite — o modelo de leitura da página do convite (item 86)", () => {
  const JARDIM = { nome: "Condomínio Jardim das Acácias", codigoPublico: "K7M4QX2P" };

  function convites(opcoes: { existe?: boolean; pendente?: boolean } = {}) {
    const perguntas: Array<[string, string]> = [];
    const porta: RepositorioDeConvites = {
      async porCodigo(codigo) {
        return opcoes.existe === false ? null : { ...JARDIM, codigoPublico: codigo };
      },
      async temPedidoPendente(pessoaId, codigo) {
        perguntas.push([pessoaId, codigo]);
        return opcoes.pendente === true;
      },
    };
    return { porta, perguntas };
  }

  const QUEM = { pessoaId: "p-1", codigosComVinculoAtivo: [] as string[], organizacoesComVinculoAtivo: [] as string[] };

  it("sem sessão devolve nome, código e sem-sessao, e nada mais", async () => {
    const { porta, perguntas } = convites();
    const lido = await lerConvite({ convites: porta }, null, "K7M4QX2P");

    expect(lido).toStrictEqual({ organizacao: JARDIM, situacao: "sem-sessao" });
    expect(Object.keys(lido.organizacao).sort()).toStrictEqual(["codigoPublico", "nome"]);
    // Sem sessão não há pessoa de quem perguntar pendência.
    expect(perguntas).toStrictEqual([]);
  });

  it("código que não leva a lugar nenhum é CODIGO_PUBLICO_NAO_ENCONTRADO, com e sem sessão", async () => {
    const { porta } = convites({ existe: false });
    await expect(lerConvite({ convites: porta }, null, "K7M4QX2Q")).rejects.toBeInstanceOf(
      CodigoPublicoNaoEncontrado,
    );
    await expect(lerConvite({ convites: porta }, QUEM, "K7M4QX2Q")).rejects.toBeInstanceOf(
      CodigoPublicoNaoEncontrado,
    );
  });

  it("quem tem vínculo ativo nela já participa, e a pendência nem é perguntada", async () => {
    const { porta, perguntas } = convites({ pendente: true });
    const lido = await lerConvite(
      { convites: porta },
      { pessoaId: "p-1", codigosComVinculoAtivo: ["OUTRA123", "K7M4QX2P"], organizacoesComVinculoAtivo: [] },
      "K7M4QX2P",
    );
    expect(lido.situacao).toBe("ja-participa");
    expect(perguntas).toStrictEqual([]);
  });

  it("quem tem pedido pendente nela vê pedido-pendente, e a pergunta é sobre a própria pessoa", async () => {
    const { porta, perguntas } = convites({ pendente: true });
    const lido = await lerConvite({ convites: porta }, QUEM, "K7M4QX2P");
    expect(lido.situacao).toBe("pedido-pendente");
    expect(perguntas).toStrictEqual([["p-1", "K7M4QX2P"]]);
  });

  it("o resto pode pedir, inclusive quem teve o vínculo revogado (ele não está em codigosComVinculoAtivo)", async () => {
    const { porta } = convites({ pendente: false });
    const lido = await lerConvite({ convites: porta }, QUEM, "K7M4QX2P");
    expect(lido.situacao).toBe("pode-pedir");
  });
});
