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

import { modulosDoQr } from "@/interface/componentes/qr";
import { destinoDoConvite, linkDoConvite } from "@/interface/http";

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

describe("a tela do Gestor — critério 86.1 na fonte", () => {
  it("exige vinculo.gerir e recusa com o SemAcesso da casca", () => {
    const fonte = ler("app/(casca)/convidar/page.tsx");
    expect(fonte).toContain('resolverEscopoParaTela("vinculo.gerir")');
    expect(fonte).toContain('return <SemAcesso titulo="Convidar pessoas" permissao="vinculo.gerir" />;');
    // O link e o QR só existem depois da recusa: nada deles no ramo sem permissão.
    const recusa = fonte.indexOf("<SemAcesso");
    expect(fonte.indexOf("montarLinkDoConvite(")).toBeGreaterThan(recusa);
  });

  it("o item do menu só existe para quem gere vínculos, abaixo de Participantes", () => {
    const fonte = ler("src/interface/componentes/casca/navegacao.tsx");
    const participantes = fonte.indexOf('destino="/vinculos"');
    const convidar = fonte.indexOf('destino="/convidar"');
    expect(convidar).toBeGreaterThan(participantes);
    const trecho = fonte.slice(fonte.lastIndexOf("{podeGerirVinculos && (", convidar), convidar);
    expect(trecho).toContain("podeGerirVinculos");
    expect(fonte).toContain('rotulo="Convidar pessoas"');
  });
});
