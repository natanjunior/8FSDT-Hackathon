import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// `@/interface/http` alcança `next/headers`; o que se testa aqui é puro. O mesmo arranjo de
// `credencial.test.ts`.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("cookies() não é usado neste teste");
  },
  headers: () => {
    throw new Error("headers() não é usado neste teste");
  },
}));

import {
  TEXTOS_DO_CONVITE_PESSOAL,
  conviteNoDetalhe,
  desfechoDoAceite,
  rodapeDoModal,
} from "@/interface/componentes/convite-pessoal";
import { modulosDoQr } from "@/interface/componentes/qr";
import { LoteDeEnvioInvalido } from "@/aplicacao/organizacao";
import { destinoDoConvite, linkDoConvite, linkDoConvitePessoal, problemaDe } from "@/interface/http";
import { envioDeConvitesSchema } from "@/interface/schemas";
import { projetarConvitePessoal } from "@/interface/projecoes";

/**
 * ============================================================================
 *  Unitário de INTERFACE — o convite por link (item 86)
 * ============================================================================
 *
 * O que decide mora em função pura (o destino do `?e=`, o link, a matriz do QR), e o que é ordem de
 * código vira guarda sobre a fonte, no precedente de `casca.test.ts`.
 */
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const ler = (relativo: string) => readFileSync(RAIZ + relativo, "utf8");

describe("destinoDoConvite — o ?e= do link (critério 86.6)", () => {
  it("leva o código, em maiúscula e sem espaço, para a página do convite", () => {
    expect(destinoDoConvite({ e: "K7M4QX2P" })).toBe("/convite/K7M4QX2P");
    expect(destinoDoConvite({ e: " k7m4qx2p " })).toBe("/convite/K7M4QX2P");
  });

  it("repetido pega o primeiro, e vazio ou ausente segue o caminho de hoje", () => {
    expect(destinoDoConvite({ e: ["K7M4QX2P", "OUTRO123"] })).toBe("/convite/K7M4QX2P");
    expect(destinoDoConvite({ e: "" })).toBeNull();
    expect(destinoDoConvite({ e: "   " })).toBeNull();
    expect(destinoDoConvite({})).toBeNull();
  });

  it("não deixa o valor escapar do caminho", () => {
    expect(destinoDoConvite({ e: "../../api/contexto" })).toBe("/convite/..%2F..%2FAPI%2FCONTEXTO");
  });

  it("no despachante, o ?e= vem antes da checagem de sessão", () => {
    const fonte = ler("app/page.tsx");
    const convite = fonte.indexOf("destinoDoConvite(");
    const sessao = fonte.indexOf("resolverEscopoParaTela(");
    expect(convite).toBeGreaterThan(-1);
    expect(sessao).toBeGreaterThan(convite);
  });
});

describe("linkDoConvite — o que o Gestor manda", () => {
  it("é a origem, a barra e o ?e= com o código", () => {
    expect(linkDoConvite("https://resolveai.exemplo", "K7M4QX2P")).toBe(
      "https://resolveai.exemplo/?e=K7M4QX2P",
    );
  });
});

describe("a página do convite — critérios 86.2 e 86.3 na fonte", () => {
  const PAGINA = "app/convite/[codigo]/page.tsx";

  it("lê pela estrada direta, e só por ela", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain("resolverConviteParaTela(");
    expect(fonte).not.toContain("resolverParaTela(");
    expect(fonte).not.toContain("resolverEscopoParaTela(");
  });

  it("os cinco estados têm as frases da spec, e nenhum fala de revogação", () => {
    const fonte = ler(PAGINA);
    for (const frase of [
      "Convite não encontrado",
      "Confira o link com quem enviou.",
      "Você recebeu um convite para participar desta organização.",
      "Você já participa desta organização",
      "Pedido enviado",
      "está aguardando o Gestor.",
      "Peça para entrar. Um Gestor decide.",
    ]) {
      expect(fonte, frase).toContain(frase);
    }
    expect(fonte).not.toMatch(/revog/iu);
  });

  it("sem sessão, a página não desenha nada além de nome, código e as duas saídas", () => {
    const fonte = ler(PAGINA);
    const semSessao = fonte.slice(
      fonte.indexOf("function FaceSemSessao"),
      fonte.indexOf("function FaceJaParticipa"),
    );
    expect(semSessao).toContain("<ExibicaoDeCodigo");
    expect(semSessao).toContain("/criar-conta?destino=");
    expect(semSessao).toContain("/entrar?destino=");
    expect(semSessao).not.toMatch(/\.id\b|pessoa|contagem|quantidade/u);
  });

  it("o formulário recebe o código travado, e ele vai escondido no envio", () => {
    const formulario = ler("src/interface/componentes/formulario-de-pedido-de-entrada.tsx");
    expect(formulario).toContain("codigoFixo");
    expect(formulario).toContain('<input type="hidden" name="codigo" value={codigoFixo} />');
    expect(formulario).toContain("<ExibicaoDeCodigo");
  });
});

describe("o QR do convite", () => {
  /** O padrão de localização: 7 × 7, borda escura, anel claro, miolo 3 × 3 escuro. */
  function temLocalizador(m: boolean[][], linha: number, coluna: number): boolean {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const borda = i === 0 || i === 6 || j === 0 || j === 6;
        const miolo = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        if (m[linha + i]![coluna + j] !== (borda || miolo)) return false;
      }
    }
    return true;
  }

  it("é uma matriz quadrada com os três localizadores nos cantos, sem borda embutida", () => {
    const m = modulosDoQr("https://resolveai.exemplo/?e=K7M4QX2P");
    const n = m.length;
    expect(m.every((linha) => linha.length === n)).toBe(true);
    expect((n - 17) % 4).toBe(0); // 21, 25, 29…: tamanho de QR de versão válida
    expect(temLocalizador(m, 0, 0)).toBe(true);
    expect(temLocalizador(m, 0, n - 7)).toBe(true);
    expect(temLocalizador(m, n - 7, 0)).toBe(true);
  });

  it("links diferentes dão matrizes diferentes", () => {
    expect(modulosDoQr("https://a.exemplo/?e=K7M4QX2P")).not.toStrictEqual(
      modulosDoQr("https://a.exemplo/?e=K7M4QX2Q"),
    );
  });
});

describe("o convite mora na configuração — critérios 120.21 e 120.22", () => {
  it("a página /convidar não existe mais, e o menu não a oferece", () => {
    expect(() => ler("app/(casca)/convidar/page.tsx")).toThrow();
    const menu = ler("src/interface/componentes/casca/navegacao.tsx");
    expect(menu).not.toContain('destino="/convidar"');
    expect(menu).not.toContain('rotulo="Convidar pessoas"');
  });

  it("criar a organização leva à aba de participantes da configuração, com o aviso", () => {
    const fonte = ler("src/interface/componentes/formulario-de-nova-organizacao.tsx");
    expect(fonte).toContain('router.push("/configuracao?aba=participantes")');
    expect(fonte).not.toContain('router.push("/convidar")');
    // O destino de antes do 116 também não volta (era a guarda de `convite.test.ts:166`).
    expect(fonte).not.toContain('router.push("/ocorrencias")');
    expect(fonte).toContain('avisarSucesso("Organização criada")');
  });

  it("o cartão tem três colunas: o código como na Identidade, o link que se copia, e o QR", () => {
    const cartao = ler("src/interface/componentes/convite-da-organizacao.tsx");
    const codigo = cartao.indexOf("<CodigoDaOrganizacao codigo={organizacao.codigoPublico} />");
    const link = cartao.indexOf("<CopiaDoLink link={link} />");
    const qr = cartao.indexOf("<QrDoLink");
    expect(codigo).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(codigo);
    expect(qr).toBeGreaterThan(link);
    // Três colunas só a partir de `xl`: o código pede até 398 px e o QR 224, e a `lg` cada terço dá ~210.
    expect(cartao).toContain("xl:grid-cols-[minmax(0,24.875rem)_minmax(0,1fr)_auto]");
    expect(cartao).not.toMatch(/\blg:grid-cols-3\b/u);
  });

  it("Copiar link copia o link, e o link não aparece escrito fora da falha", () => {
    const fonte = ler("src/interface/componentes/link-do-convite.tsx");
    expect(fonte).toContain("useCopiar(link)");
    expect(fonte).toContain('{desfecho === "copiado" ? "Copiado" : "Copiar link"}');
    expect(fonte).not.toContain("<code");
    // Na falha da área de transferência, o link aparece selecionado para Ctrl+C.
    expect(fonte).toContain("select-all");
  });

  it("a página guarda o cartão por vinculo.gerir, como a aba", () => {
    const pagina = ler("app/(casca)/configuracao/page.tsx");
    const participantes = pagina.slice(pagina.indexOf("participantes: geriVinculos"), pagina.indexOf("historico: ("));
    expect(participantes).toContain("<ConviteDaOrganizacao");
    expect(pagina.indexOf("montarLinkDoConvite(")).toBeGreaterThan(pagina.indexOf("const geriVinculos"));
  });
});

describe("o convite pessoal, do lado do Gestor (item 121, critérios 1 e 9)", () => {
  it("as duas rotas do Gestor existem, exportam só POST, e exigem vinculo.gerir", () => {
    for (const rota of [
      "app/api/vinculos/[pessoaId]/convite/route.ts",
      "app/api/vinculos/[pessoaId]/convite/renovacao/route.ts",
    ]) {
      const fonte = ler(rota);
      expect(fonte.match(/^export const (GET|POST|PUT|PATCH|DELETE) /gmu), rota).toStrictEqual(["export const POST "]);
      expect(fonte, rota).toContain('comContexto({ exige: "vinculo.gerir" }');
    }
  });
});

describe("o convite pessoal, nas telas (item 121)", () => {
  it("o detalhe mostra o botão só para quem pode receber convite", () => {
    expect(conviteNoDetalhe({ papel: "solicitante", temConta: false })).toBe("botao");
    expect(conviteNoDetalhe({ papel: "gestor", temConta: false })).toBe("botao");
    expect(conviteNoDetalhe({ papel: "encarregado", temConta: false })).toBe("encarregado");
    expect(conviteNoDetalhe({ papel: "solicitante", temConta: true })).toBe("com-conta");
  });

  it("o botão Entrar segue, refaz a página ou diz que não foi possível (critério 4)", () => {
    expect(desfechoDoAceite(200)).toBe("ir");
    expect(desfechoDoAceite(404)).toBe("refazer");
    expect(desfechoDoAceite(409)).toBe("refazer");
    expect(desfechoDoAceite(500)).toBe("falha");
    expect(desfechoDoAceite(0)).toBe("falha");
  });

  it("o link pessoal é a página do convite sobre a origem do pedido", () => {
    const token = "T".repeat(43);
    expect(linkDoConvitePessoal("https://x.example", token)).toBe(`https://x.example/convite-pessoal/${token}`);
  });

  it("o rodapé do modal diz quando e quem gerou, em dd/mm", () => {
    expect(rodapeDoModal("2026-10-02T15:00:00.000Z", "Ana Lima")).toBe("Gerado em 02/10 por Ana Lima");
  });

  it("a resposta sem sessão leva só os nomes e o papel, e nao-vale vai sozinho (critério 8)", () => {
    expect(projetarConvitePessoal(null)).toStrictEqual({ situacao: "nao-vale" });
    expect(
      projetarConvitePessoal({
        situacao: "sem-sessao",
        pessoa: { nome: "Maria Souza" },
        organizacao: { id: "org-jardim", nome: "Jardim das Acácias" },
        papel: "solicitante",
      }),
    ).toStrictEqual({
      situacao: "sem-sessao",
      pessoa: { nome: "Maria Souza" },
      organizacao: { nome: "Jardim das Acácias" },
      papel: "solicitante",
    });
  });

  it("a página lê só pela estrada direta, tem as quatro faces e não marca gênero", () => {
    const pagina = ler("app/convite-pessoal/[token]/page.tsx");
    expect(pagina).toContain("resolverConvitePessoalParaTela(token)");
    expect(pagina).not.toContain("@/composicao");
    for (const situacao of ['"sem-sessao"', '"pode-aceitar"', '"ja-participa"']) expect(pagina).toContain(situacao);
    expect(pagina).toContain("TEXTOS.naoVale");
    // A face sem sessão monta o cadastro com o token e o nome, e nunca com o e-mail.
    expect(pagina).toContain("<FormularioDeCadastro convite={token} nomeInicial={convite.pessoa.nome}");
    expect(pagina).not.toMatch(/email/iu);
    // A face de quem tem conta diz em que conta a pessoa está, e dá o caminho de sair.
    expect(pagina).toContain("contaEmUso(contexto.pessoa.nome)");
    expect(pagina).toContain("<CaminhoDeSair />");
    expect(pagina).not.toMatch(/convidad[ao]/iu);
    expect(JSON.stringify(TEXTOS_DO_CONVITE_PESSOAL)).not.toMatch(/convidad[ao]/iu);
  });

  it("o detalhe monta o modal só quando o convite cabe", () => {
    const detalhe = ler("app/(casca)/vinculos/[pessoaId]/editar/page.tsx");
    expect(detalhe).toContain('convite === "botao" ? (');
    expect(detalhe).toContain("<ConvidarParticipante");
    expect(detalhe).toContain("TEXTOS_DO_CONVITE_PESSOAL.semConviteEncarregado");
  });
});

describe("o envio por e-mail (item 122)", () => {
  const UUID = "4f6c1d6e-2b7a-4c1e-9f3a-1c2d3e4f5a6b";

  it("a rota existe, exporta só POST, exige vinculo.gerir e lê o corpo pelo schema", () => {
    const fonte = ler("app/api/convites-pessoais/envios/route.ts");
    expect(fonte.match(/^export const (GET|POST|PUT|PATCH|DELETE) /gmu)).toStrictEqual(["export const POST "]);
    expect(fonte).toContain('{ exige: "vinculo.gerir", corpo: envioDeConvitesSchema }');
  });

  it("a rota não está em lista fechada nenhuma: roda com sessão e organização", () => {
    const lint = ler("eslint.config.mjs");
    expect(lint).not.toContain("convites-pessoais/envios");
  });

  it("o schema confere só a forma: lista de UUID, sem campo a mais", () => {
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: "x" }).success).toBe(false);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: ["nao-e-uuid"] }).success).toBe(false);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: [UUID], extra: 1 }).success).toBe(false);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: [] }).success).toBe(true);
    expect(envioDeConvitesSchema.safeParse({ pessoaIds: Array.from({ length: 25 }, () => UUID) }).success).toBe(true);
  });

  it("o lote inválido é 422, com o código próprio", () => {
    const { status, corpo } = problemaDe(new LoteDeEnvioInvalido("Envie até 20 por vez."), "/api/convites-pessoais/envios");
    expect(status).toBe(422);
    expect(corpo.codigo).toBe("LOTE_DE_ENVIO_INVALIDO");
  });
});
