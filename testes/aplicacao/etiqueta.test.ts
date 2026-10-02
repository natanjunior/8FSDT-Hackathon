import { describe, expect, it } from "vitest";

import {
  EtiquetaNaoEncontrada,
  VinculoNaoEncontrado,
  apagarEtiqueta,
  atribuirEtiqueta,
  tirarEtiqueta,
  type RepositorioEscopadoDeEtiquetas,
  type ResultadoDaAtribuicaoDeEtiqueta,
  type ResultadoDaRetiradaDeEtiqueta,
  type ResultadoDoApagarEtiqueta,
} from "@/aplicacao/organizacao";

/**
 * **O que está sob teste é a tradução**, como em `vinculo.test.ts`: desfecho da porta → recusa nomeada.
 * As garantias que produzem os desfechos são do banco, e estão em `testes/integracao/etiqueta.test.ts`.
 */
const ELETRICISTA = { id: "etiqueta-1", nome: "Eletricista" };

function portaFalsa(
  atribuicao: ResultadoDaAtribuicaoDeEtiqueta,
  retirada: ResultadoDaRetiradaDeEtiqueta = { desfecho: "tirada" },
  apagamento: ResultadoDoApagarEtiqueta = { desfecho: "apagada" },
): RepositorioEscopadoDeEtiquetas {
  return {
    listar: () => Promise.resolve([ELETRICISTA]),
    atribuir: () => Promise.resolve(atribuicao),
    tirar: () => Promise.resolve(retirada),
    apagar: () => Promise.resolve(apagamento),
  };
}

const DADOS = { pessoaId: "pessoa-1", nome: "Eletricista", porPessoaId: "gestor-1" };

describe("atribuirEtiqueta", () => {
  it("atribuída devolve a etiqueta e se foi criada", async () => {
    const porta = portaFalsa({ desfecho: "atribuida", etiqueta: ELETRICISTA, criada: true });
    expect(await atribuirEtiqueta(porta, DADOS)).toStrictEqual({ etiqueta: ELETRICISTA, criada: true, jaTinha: false });
  });

  it("ja-tinha é sucesso, e diz que já tinha", async () => {
    const porta = portaFalsa({ desfecho: "ja-tinha", etiqueta: ELETRICISTA });
    expect(await atribuirEtiqueta(porta, DADOS)).toStrictEqual({ etiqueta: ELETRICISTA, criada: false, jaTinha: true });
  });

  it("nao-encontrado é VINCULO_NAO_ENCONTRADO", async () => {
    await expect(atribuirEtiqueta(portaFalsa({ desfecho: "nao-encontrado" }), DADOS)).rejects.toBeInstanceOf(
      VinculoNaoEncontrado,
    );
  });
});

describe("tirarEtiqueta e apagarEtiqueta", () => {
  const atribuida: ResultadoDaAtribuicaoDeEtiqueta = { desfecho: "atribuida", etiqueta: ELETRICISTA, criada: false };

  it("vínculo e etiqueta ausentes viram os dois 404 distintos", async () => {
    await expect(
      tirarEtiqueta(portaFalsa(atribuida, { desfecho: "vinculo-nao-encontrado" }), { pessoaId: "p", etiquetaId: "e" }),
    ).rejects.toBeInstanceOf(VinculoNaoEncontrado);
    await expect(
      tirarEtiqueta(portaFalsa(atribuida, { desfecho: "etiqueta-nao-encontrada" }), { pessoaId: "p", etiquetaId: "e" }),
    ).rejects.toBeInstanceOf(EtiquetaNaoEncontrada);
  });

  it("apagar o que não existe é ETIQUETA_NAO_ENCONTRADA", async () => {
    await expect(
      apagarEtiqueta(portaFalsa(atribuida, undefined, { desfecho: "nao-encontrada" }), "e"),
    ).rejects.toBeInstanceOf(EtiquetaNaoEncontrada);
  });

  it("o código é o do contrato", () => {
    expect(new EtiquetaNaoEncontrada().codigo).toBe("ETIQUETA_NAO_ENCONTRADA");
  });
});
