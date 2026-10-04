import { describe, expect, it } from "vitest";

import {
  LoteDeEnvioInvalido,
  enviarConvitesPorEmail,
  situacaoDoConvitePorEmail,
  type ContatoLido,
  type DesfechoDoRegistro,
  type RepositorioEscopadoDeEnviosDeConvite,
  type RepositorioEscopadoDeVinculos,
  type ResumoDosEnvios,
  type VinculoLido,
} from "@/aplicacao/organizacao";
import type { Papel } from "@/dominio/organizacao";

import { carteiroFalso } from "./duplos";

/**
 * ============================================================================
 *  O convite por e-mail — item 122
 * ============================================================================
 *
 * **O que está sob teste é a regra**: o lote, a ordem dos motivos, o primeiro e-mail pela ordem, a
 * mensagem, e o envio em série. Os limites e a transação são do banco, e a prova deles está na integração.
 */

function contato(tipo: "email" | "telefone", valor: string, ordem: number): ContatoLido {
  return { id: `${tipo}-${String(ordem)}`, tipo, valor, finalidade: "pessoal", temWhatsapp: false, ordem, observacao: null };
}

function vinculo(
  pessoaId: string,
  dados: { papel?: Papel; temConta?: boolean; contatos?: ContatoLido[]; nome?: string } = {},
): VinculoLido {
  return {
    pessoa: { pessoaId, nome: dados.nome ?? `Pessoa ${pessoaId}`, contatos: dados.contatos ?? [contato("email", `${pessoaId}@example.com`, 1)] },
    papel: dados.papel ?? "solicitante",
    area: null,
    temConta: dados.temConta ?? false,
    criadoEm: "2026-10-01T12:00:00.000Z",
    atualizadoEm: null,
    etiquetas: [],
  };
}

function vinculosQueDevolvem(porId: Record<string, VinculoLido | null>): RepositorioEscopadoDeVinculos {
  return {
    porPessoa: (pessoaId: string) => Promise.resolve(porId[pessoaId] ?? null),
  } as unknown as RepositorioEscopadoDeVinculos;
}

/** O repositório falso: devolve o desfecho programado e, quando é `enviado`, chama `entregar` de verdade. */
function enviosFalsos(desfechos: Record<string, DesfechoDoRegistro["desfecho"]> = {}, resumo?: ResumoDosEnvios) {
  const linha: string[] = [];
  const porta: RepositorioEscopadoDeEnviosDeConvite = {
    async registrarEnvio({ pessoaId, entregar }) {
      linha.push(`inicio:${pessoaId}`);
      await new Promise((pronto) => setTimeout(pronto, 5));
      const desfecho = desfechos[pessoaId] ?? "enviado";
      if (desfecho === "enviado") {
        await entregar({ token: `token-${pessoaId}`, criadoEm: "", criadoPor: { pessoaId: "g", nome: "Ana Lima" } });
      }
      linha.push(`fim:${pessoaId}`);
      return desfecho === "enviado" ? { desfecho, enviadoEm: "2026-10-04T13:00:00.000Z" } : { desfecho };
    },
    resumoDe: () =>
      Promise.resolve(resumo ?? { ultimoEnvioEm: null, doParticipante: 0, enderecoJaRecebeuHoje: false }),
  };
  return { porta, linha };
}

const ENTRADA = {
  porPessoa: { pessoaId: "gestora", nome: "Ana Lima" },
  organizacao: { nome: "Jardim das Acácias" },
  novoToken: () => "T".repeat(43),
  montarLink: (token: string) => `https://x.example/convite-pessoal/${token}`,
};

describe("o lote (critério 4)", () => {
  it.each([
    ["vazia", []],
    ["repetida", ["a", "a"]],
    ["com 21", Array.from({ length: 21 }, (_, i) => `p${String(i)}`)],
  ] as const)("lista %s é recusada sem ler vínculo nenhum", async (_caso, pessoaIds) => {
    let leu = false;
    const vinculos = { porPessoa: () => ((leu = true), Promise.resolve(null)) } as unknown as RepositorioEscopadoDeVinculos;
    await expect(
      enviarConvitesPorEmail({ vinculos, enviosDeConvite: enviosFalsos().porta }, carteiroFalso().carteiro, {
        ...ENTRADA,
        pessoaIds,
      }),
    ).rejects.toMatchObject({ codigo: "LOTE_DE_ENVIO_INVALIDO" });
    await expect(
      enviarConvitesPorEmail({ vinculos, enviosDeConvite: enviosFalsos().porta }, carteiroFalso().carteiro, {
        ...ENTRADA,
        pessoaIds,
      }),
    ).rejects.toBeInstanceOf(LoteDeEnvioInvalido);
    expect(leu).toBe(false);
  });

  it("20 passa", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${String(i)}`);
    const porId = Object.fromEntries(ids.map((id) => [id, vinculo(id)]));
    const resumo = await enviarConvitesPorEmail(
      { vinculos: vinculosQueDevolvem(porId), enviosDeConvite: enviosFalsos().porta },
      carteiroFalso().carteiro,
      { ...ENTRADA, pessoaIds: ids },
    );
    expect(resumo.enviados).toHaveLength(20);
  });
});

describe("a ordem dos motivos (spec §3.2)", () => {
  it.each([
    ["sem vínculo aqui", null, "vinculo-revogado"],
    ["sem e-mail", vinculo("p", { contatos: [contato("telefone", "+5511999990000", 1)] }), "sem-email"],
    ["com conta", vinculo("p", { temConta: true }), "ja-tem-conta"],
    ["encarregado", vinculo("p", { papel: "encarregado" }), "encarregado"],
    ["encarregado sem e-mail", vinculo("p", { papel: "encarregado", contatos: [] }), "sem-email"],
  ] as const)("%s: %s", async (_caso, lido, motivo) => {
    const resumo = await enviarConvitesPorEmail(
      { vinculos: vinculosQueDevolvem({ p: lido }), enviosDeConvite: enviosFalsos().porta },
      carteiroFalso().carteiro,
      { ...ENTRADA, pessoaIds: ["p"] },
    );
    expect(resumo.enviados).toStrictEqual([]);
    expect(resumo.naoEnviados).toStrictEqual([
      { pessoaId: "p", nome: lido === null ? null : lido.pessoa.nome, motivo },
    ]);
  });

  it.each(["limite-do-dia", "limite-do-participante", "falha-no-envio"] as const)(
    "o desfecho %s do repositório vira o motivo",
    async (desfecho) => {
      const resumo = await enviarConvitesPorEmail(
        { vinculos: vinculosQueDevolvem({ p: vinculo("p") }), enviosDeConvite: enviosFalsos({ p: desfecho }).porta },
        carteiroFalso().carteiro,
        { ...ENTRADA, pessoaIds: ["p"] },
      );
      expect(resumo.naoEnviados).toStrictEqual([{ pessoaId: "p", nome: "Pessoa p", motivo: desfecho }]);
    },
  );
});

describe("a mensagem (spec §3.12)", () => {
  it("vai para o primeiro e-mail pela ordem, com o assunto, a pessoa, quem convidou, o link e a frase de ignorar", async () => {
    const carteiro = carteiroFalso();
    const lido = vinculo("p", {
      nome: "Maria Souza",
      contatos: [
        contato("telefone", "+5511999990000", 0),
        contato("email", "segunda@example.com", 2),
        contato("email", "primeira@example.com", 1),
      ],
    });
    await enviarConvitesPorEmail(
      { vinculos: vinculosQueDevolvem({ p: lido }), enviosDeConvite: enviosFalsos().porta },
      carteiro.carteiro,
      { ...ENTRADA, pessoaIds: ["p"] },
    );
    const [mensagem] = carteiro.mensagens;
    expect(mensagem?.para).toBe("primeira@example.com");
    expect(mensagem?.assunto).toBe("Convite para Jardim das Acácias");
    expect(mensagem?.texto).toContain("Maria Souza");
    expect(mensagem?.texto).toContain("Ana Lima");
    expect(mensagem?.texto).toContain("https://x.example/convite-pessoal/token-p");
    expect(mensagem?.texto).toContain("Se você não esperava este convite, pode ignorar esta mensagem.");
    expect(mensagem?.html).not.toContain("<img");
  });

  it("o HTML escapa o que foi digitado por gente", async () => {
    const carteiro = carteiroFalso();
    await enviarConvitesPorEmail(
      { vinculos: vinculosQueDevolvem({ p: vinculo("p", { nome: "<b>Maria</b> & Cia" }) }), enviosDeConvite: enviosFalsos().porta },
      carteiro.carteiro,
      { ...ENTRADA, pessoaIds: ["p"] },
    );
    expect(carteiro.mensagens[0]?.html).toContain("&lt;b&gt;Maria&lt;/b&gt; &amp; Cia");
    expect(carteiro.mensagens[0]?.html).not.toContain("<b>Maria");
  });

  it("o provedor que recusa chega ao repositório como rejeição de entregar", async () => {
    const carteiro = carteiroFalso();
    carteiro.falharCom(new Error("550"));
    let rejeitou = false;
    const enviosDeConvite: RepositorioEscopadoDeEnviosDeConvite = {
      async registrarEnvio({ entregar }) {
        try {
          await entregar({ token: "t", criadoEm: "", criadoPor: { pessoaId: "g", nome: "Ana" } });
          return { desfecho: "enviado", enviadoEm: "" };
        } catch {
          rejeitou = true;
          return { desfecho: "falha-no-envio" };
        }
      },
      resumoDe: () => Promise.reject(new Error("não usado")),
    };
    const resumo = await enviarConvitesPorEmail(
      { vinculos: vinculosQueDevolvem({ p: vinculo("p") }), enviosDeConvite },
      carteiro.carteiro,
      { ...ENTRADA, pessoaIds: ["p"] },
    );
    expect(rejeitou).toBe(true);
    expect(resumo.naoEnviados[0]?.motivo).toBe("falha-no-envio");
  });
});

describe("em série, e não em paralelo (ADR-0022)", () => {
  it("a segunda pessoa só começa depois de a primeira terminar", async () => {
    const envios = enviosFalsos();
    await enviarConvitesPorEmail(
      { vinculos: vinculosQueDevolvem({ a: vinculo("a"), b: vinculo("b"), c: vinculo("c") }), enviosDeConvite: envios.porta },
      carteiroFalso().carteiro,
      { ...ENTRADA, pessoaIds: ["a", "b", "c"] },
    );
    expect(envios.linha).toStrictEqual(["inicio:a", "fim:a", "inicio:b", "fim:b", "inicio:c", "fim:c"]);
  });
});

describe("a situação do e-mail no modal", () => {
  const situacao = (lido: VinculoLido, resumo: ResumoDosEnvios) =>
    situacaoDoConvitePorEmail({ enviosDeConvite: enviosFalsos({}, resumo).porta }, lido);

  it("sem e-mail é o impedimento sem-email", async () => {
    expect(
      await situacao(vinculo("p", { contatos: [] }), { ultimoEnvioEm: null, doParticipante: 0, enderecoJaRecebeuHoje: false }),
    ).toStrictEqual({ email: null, ultimoEnvioEm: null, impedimento: "sem-email" });
  });

  it("dez envios é o limite do participante", async () => {
    expect(
      (await situacao(vinculo("p"), { ultimoEnvioEm: null, doParticipante: 10, enderecoJaRecebeuHoje: false })).impedimento,
    ).toBe("limite-do-participante");
  });

  it("o do dia vem antes do do participante", async () => {
    expect(
      (await situacao(vinculo("p"), { ultimoEnvioEm: null, doParticipante: 10, enderecoJaRecebeuHoje: true })).impedimento,
    ).toBe("limite-do-dia");
  });

  it("sem impedimento, repassa o endereço e o último envio", async () => {
    expect(
      await situacao(vinculo("p"), {
        ultimoEnvioEm: "2026-10-01T12:00:00.000Z",
        doParticipante: 1,
        enderecoJaRecebeuHoje: false,
      }),
    ).toStrictEqual({ email: "p@example.com", ultimoEnvioEm: "2026-10-01T12:00:00.000Z", impedimento: null });
  });
});
