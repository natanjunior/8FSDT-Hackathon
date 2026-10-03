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

describe("o código no desfecho da criação — critério 116.7", () => {
  it("criar a organização leva a Convidar pessoas, com o aviso", () => {
    const fonte = ler("src/interface/componentes/formulario-de-nova-organizacao.tsx");
    expect(fonte).toContain('router.push("/convidar")');
    expect(fonte).not.toContain('router.push("/ocorrencias")');
    expect(fonte).toContain('avisarSucesso("Organização criada")');
  });

  it("o cartão do código se copia, e os dois botões dizem o que copiam", () => {
    const pagina = ler("app/(casca)/convidar/page.tsx");
    expect(pagina).toContain("<CodigoComCopia codigo={organizacao.codigoPublico} />");
    const codigo = ler("src/interface/componentes/codigo-da-organizacao.tsx");
    expect(codigo).toContain('<span className="sr-only"> o código</span>');
    expect(codigo).toContain("useCopiar(codigo)");
    const link = ler("src/interface/componentes/link-do-convite.tsx");
    expect(link).toContain('<span className="sr-only"> o link</span>');
  });

  it("o Código vem antes do QR, os dois em meia largura a partir de lg, e a razão escrita é a nova (critérios 118.2 e 118.3)", () => {
    const fonte = ler("app/(casca)/convidar/page.tsx");
    const link = fonte.indexOf('tituloId="link"');
    const codigo = fonte.indexOf('tituloId="codigo"');
    const qr = fonte.indexOf('tituloId="qr"');
    expect(link).toBeGreaterThan(-1);
    // **O código é o que se dita por telefone ou se digita; o QR é para o cartaz.** Quem convida alcança
    // primeiro o que vai usar na conversa.
    expect(codigo).toBeGreaterThan(link);
    expect(qr).toBeGreaterThan(codigo);
    // Os dois dentro de uma grade de duas colunas que só vale a partir de `lg`: a `md` o miolo dá cerca
    // de 242 px por coluna, e o QR pede 272. Abaixo disso, coluna. E alturas independentes, que é o
    // `items-start`: uma pílula de oito caracteres contra um quadrado de 224 px.
    const grade = fonte.lastIndexOf('<div className="grid', codigo);
    expect(grade).toBeGreaterThan(link);
    const abertura = fonte.slice(grade, fonte.indexOf(">", grade));
    expect(abertura).toContain("lg:grid-cols-2");
    expect(abertura).toContain("items-start");
    // O QR está na mesma grade, e não num terceiro bloco: nada fecha a grade antes dele. A grade fecha
    // com seis espaços de recuo; os divs de dentro dos cartões, com dez.
    expect(fonte.slice(grade, qr)).not.toContain("\n      </div>");
    // A razão escrita no cabeçalho deixou de afirmar a ordem antiga.
    expect(fonte).not.toContain("ordem é a de quem abre para mandar");
    expect(fonte).toContain("se dita por telefone ou se digita");
  });
});
