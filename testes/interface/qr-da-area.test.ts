import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

// `@/interface/http` alcança `next/headers`; o que se testa aqui é puro. O arranjo de `convite.test.ts`.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("cookies() não é usado neste teste");
  },
  headers: () => {
    throw new Error("headers() não é usado neste teste");
  },
}));

import {
  destinoDoQr,
  ehIdDeArea,
  lerAreaDoEndereco,
  situacaoDaAreaInicial,
} from "@/interface/componentes/qr-da-area";
import { temAlgoEscrito, VALORES_VAZIOS } from "@/interface/componentes/registro-de-ocorrencia";
import { linkDoQrDaArea } from "@/interface/http";

/**
 * ============================================================================
 *  Unitário de INTERFACE — o QR na área (item 111)
 * ============================================================================
 *
 * O que decide mora em função pura (para onde o QR leva, o que a área do endereço é), e o que é ordem de
 * código vira guarda sobre a fonte, no precedente de `convite.test.ts`.
 */
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const ler = (relativo: string) => readFileSync(RAIZ + relativo, "utf8");

const AREA = "3f1c2b4a-9d8e-4f7a-b6c5-1a2b3c4d5e6f";
const ORG_A = { organizacaoId: "org-a", codigoPublico: "K7M4QX2P" };
const ORG_B = { organizacaoId: "org-b", codigoPublico: "Q2W3E4R5" };

describe("lerAreaDoEndereco", () => {
  it("lê o primeiro, aparado e em minúscula", () => {
    expect(lerAreaDoEndereco({ area: AREA })).toBe(AREA);
    expect(lerAreaDoEndereco({ area: ` ${AREA.toUpperCase()} ` })).toBe(AREA);
    expect(lerAreaDoEndereco({ area: [AREA, "outra"] })).toBe(AREA);
  });

  it("ausente ou vazio é null", () => {
    expect(lerAreaDoEndereco({})).toBeNull();
    expect(lerAreaDoEndereco({ area: "" })).toBeNull();
    expect(lerAreaDoEndereco({ area: "  " })).toBeNull();
  });

  it("ehIdDeArea aceita só uuid", () => {
    expect(ehIdDeArea(AREA)).toBe(true);
    expect(ehIdDeArea("elevador")).toBe(false);
    expect(ehIdDeArea(`${AREA}x`)).toBe(false);
  });
});

describe("destinoDoQr — a tabela da spec §3.2", () => {
  const registro = `/ocorrencias/nova?area=${AREA}`;

  it("código que não leva a organização é QR não encontrado", () => {
    expect(destinoDoQr({ convite: null, areaId: AREA, ativaId: null, vinculos: [] })).toStrictEqual({
      tipo: "nao-encontrado",
    });
  });

  it("área fora do formato é QR não encontrado, com qualquer situação", () => {
    for (const situacao of ["sem-sessao", "pode-pedir", "ja-participa", "pedido-pendente"] as const) {
      expect(
        destinoDoQr({
          convite: { codigoPublico: ORG_A.codigoPublico, situacao },
          areaId: "elevador",
          ativaId: ORG_A.organizacaoId,
          vinculos: [ORG_A],
        }),
      ).toStrictEqual({ tipo: "nao-encontrado" });
    }
  });

  it("sem sessão é a face do QR", () => {
    expect(
      destinoDoQr({
        convite: { codigoPublico: ORG_A.codigoPublico, situacao: "sem-sessao" },
        areaId: AREA,
        ativaId: null,
        vinculos: [],
      }),
    ).toStrictEqual({ tipo: "sem-sessao" });
  });

  it("sem vínculo, pedindo ou com pedido pendente, vai ao convite sem a área (critério 5)", () => {
    for (const situacao of ["pode-pedir", "pedido-pendente"] as const) {
      expect(
        destinoDoQr({
          convite: { codigoPublico: ORG_A.codigoPublico, situacao },
          areaId: AREA,
          ativaId: ORG_B.organizacaoId,
          vinculos: [ORG_B],
        }),
      ).toStrictEqual({ tipo: "convite", para: `/convite/${ORG_A.codigoPublico}` });
    }
  });

  it("participa e está nela: registro direto (critério 2)", () => {
    expect(
      destinoDoQr({
        convite: { codigoPublico: ORG_A.codigoPublico, situacao: "ja-participa" },
        areaId: AREA,
        ativaId: ORG_A.organizacaoId,
        vinculos: [ORG_A, ORG_B],
      }),
    ).toStrictEqual({ tipo: "registro", para: registro });
  });

  it("participa e está noutra: troca (critério 3)", () => {
    expect(
      destinoDoQr({
        convite: { codigoPublico: ORG_A.codigoPublico, situacao: "ja-participa" },
        areaId: AREA,
        ativaId: ORG_B.organizacaoId,
        vinculos: [ORG_A, ORG_B],
      }),
    ).toStrictEqual({ tipo: "trocar", organizacaoId: ORG_A.organizacaoId, para: registro });
  });

  it("participa de duas e não escolheu nenhuma: troca, e não convite", () => {
    expect(
      destinoDoQr({
        convite: { codigoPublico: ORG_A.codigoPublico, situacao: "ja-participa" },
        areaId: AREA,
        ativaId: null,
        vinculos: [ORG_A, ORG_B],
      }),
    ).toStrictEqual({ tipo: "trocar", organizacaoId: ORG_A.organizacaoId, para: registro });
  });

  it("ja-participa sem o vínculo na lista é corrida, e cai no convite", () => {
    expect(
      destinoDoQr({
        convite: { codigoPublico: ORG_A.codigoPublico, situacao: "ja-participa" },
        areaId: AREA,
        ativaId: ORG_B.organizacaoId,
        vinculos: [ORG_B],
      }),
    ).toStrictEqual({ tipo: "convite", para: `/convite/${ORG_A.codigoPublico}` });
  });
});

describe("situacaoDaAreaInicial — os caminhos do critério 7 depois do login", () => {
  const INATIVA = "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b";
  const areas = [
    { id: AREA, ativa: true },
    { id: INATIVA, ativa: false },
  ];

  it("ausente é ausente", () => {
    expect(situacaoDaAreaInicial(areas, null)).toStrictEqual({ tipo: "ausente" });
  });

  it("ativa vem escolhida", () => {
    expect(situacaoDaAreaInicial(areas, AREA)).toStrictEqual({ tipo: "ativa", areaId: AREA });
  });

  it("inativa, inexistente, de outra organização ou fora do formato dão o mesmo resultado (7 e 7a)", () => {
    // Decisão 12 do dono (30/09): id inexistente abre sem área, com o aviso, como a desativada. Um texto só,
    // para que a tela não confirme que aquele id é uma área real desta organização.
    for (const id of [INATIVA, "99999999-9999-4999-8999-999999999999", "elevador"]) {
      expect(situacaoDaAreaInicial(areas, id)).toStrictEqual({ tipo: "indisponivel" });
    }
  });
});

describe("linkDoQrDaArea", () => {
  it("é a página do convite com a área no parâmetro", () => {
    expect(linkDoQrDaArea("https://resolveai.exemplo", "K7M4QX2P", AREA)).toBe(
      `https://resolveai.exemplo/convite/K7M4QX2P?area=${AREA}`,
    );
  });
});

describe("a página do convite com ?area= — critérios 4, 5 e 6 na fonte", () => {
  const PAGINA = "app/convite/[codigo]/page.tsx";
  const faceDoQr = () => {
    const fonte = ler(PAGINA);
    return fonte.slice(fonte.indexOf("function FaceQrDaArea"), fonte.indexOf("function FaceQrNaoEncontrado"));
  };

  it("continua lendo só pela estrada direta do convite, e decide pelo destinoDoQr", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain("resolverConviteParaTela(");
    expect(fonte).not.toContain("resolverEscopoParaTela(");
    expect(fonte).not.toContain("listarAreas(");
    expect(fonte).toContain("destinoDoQr(");
  });

  it("a face do QR tem Entrar, o ou, o apoio e Pedir para entrar, e não mostra o código", () => {
    const face = faceDoQr();
    expect(face).toContain("/entrar?destino=");
    expect(face).toContain("<ReguaDoOu deitada");
    expect(face).toContain("TEXTOS_DO_QR.semSessao.apoio");
    expect(face).toContain("/convite/${");
    expect(face).not.toContain("<ExibicaoDeCodigo");
    expect(face).not.toContain("/criar-conta");
    expect(face.indexOf("TEXTOS_DO_QR.semSessao.principal")).toBeLessThan(
      face.indexOf("TEXTOS_DO_QR.semSessao.secundario"),
    );
  });

  it("o destino do Entrar é esta mesma página com a área, e não o registro", () => {
    const face = faceDoQr();
    expect(face).toMatch(/encodeURIComponent\(`\/convite\/\$\{[^}]+\}\?area=\$\{[^}]+\}`\)/u);
    expect(face).not.toContain("/ocorrencias/nova");
  });

  it("a troca chama o PUT de sempre, uma vez, e substitui o endereço", () => {
    const troca = ler("src/interface/componentes/troca-pelo-qr.tsx");
    expect(troca).toContain("trocarOrganizacao(");
    expect(troca).toContain("useRef(");
    expect(troca).toContain("router.replace(");
    expect(troca).not.toContain("router.push(");
  });

  it("a face sem sessão do convite ganhou o ou e o apoio, e mantém Criar conta como principal (critério 8)", () => {
    const fonte = ler(PAGINA);
    const face = fonte.slice(fonte.indexOf("function FaceSemSessao"), fonte.indexOf("function FaceJaParticipa"));
    expect(face).toContain("<ReguaDoOu deitada");
    expect(face).toContain("Já tem conta?");
    expect(face.indexOf("Criar conta")).toBeLessThan(face.indexOf(">Entrar<"));
  });
});

describe("temAlgoEscrito — Cancelar no registro aberto pelo QR", () => {
  const inicial = { ...VALORES_VAZIOS, areaId: AREA };

  it("a área do QR, sozinha, não é algo escrito", () => {
    expect(temAlgoEscrito(inicial, false, inicial)).toBe(false);
  });

  it("trocar a área ou escrever é", () => {
    expect(temAlgoEscrito({ ...inicial, areaId: "outra" }, false, inicial)).toBe(true);
    expect(temAlgoEscrito({ ...inicial, titulo: "Lâmpada" }, false, inicial)).toBe(true);
  });

  it("sem inicial, compara com o vazio, como antes", () => {
    expect(temAlgoEscrito(VALORES_VAZIOS, false)).toBe(false);
    expect(temAlgoEscrito({ ...VALORES_VAZIOS, titulo: "   " }, false)).toBe(false);
    expect(temAlgoEscrito(inicial, false)).toBe(true);
  });
});

describe("o registro com ?area=, na fonte (critérios 7 e 7b)", () => {
  const PAGINA = "app/(foco)/ocorrencias/nova/page.tsx";

  it("a área é procurada dentro do funil escopado, depois da resolução, e com inativas só quando há área", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain("lerAreaDoEndereco(");
    expect(fonte).toContain("incluirInativas: areaDoQr !== null");
    expect(fonte.indexOf("situacaoDaAreaInicial(")).toBeGreaterThan(
      fonte.indexOf('resolverEscopoParaTela("ocorrencia.registrar")'),
    );
    expect(fonte).toContain("listarAreas(escopo.repos.areas");
  });

  it("um aviso só para os casos que não abrem a área (7a)", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain('areaIndisponivel={daArea.tipo === "indisponivel"}');
    expect(fonte).not.toContain("QR não encontrado");
  });

  it("o formulário recebe a área como valor inicial, e o tipo continua apurado no servidor", () => {
    const formulario = ler("src/interface/componentes/formulario-de-ocorrencia.tsx");
    expect(formulario).toContain("areaInicial");
    expect(formulario).toContain("TEXTOS_DO_QR.areaIndisponivel");
    expect(formulario).toContain(
      'temAlgoEscrito(valores, anexo.nome !== "vazio" && anexo.nome !== "falhou", inicial)',
    );
    expect(formulario).not.toMatch(/tipo:\s*area/u);
  });
});

describe("o QR da área para quem configura — critério 1 na fonte", () => {
  const PAGINA = "app/(casca)/configuracao/areas/[areaId]/qr/page.tsx";

  it("exige organizacao.configurar, e o QR só existe depois da recusa", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain('resolverEscopoParaTela("organizacao.configurar")');
    expect(fonte).toContain('permissao="organizacao.configurar"');
    const recusa = fonte.indexOf("<SemAcesso");
    expect(fonte.indexOf("montarLinkDoQrDaArea(")).toBeGreaterThan(recusa);
    expect(fonte.indexOf("<QrDoLink")).toBeGreaterThan(recusa);
  });

  it("lê pela porta escopada, com inativas, e área de fora é 404", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain("listarAreas(escopo.repos.areas, { incluirInativas: true })");
    expect(fonte).toContain("notFound()");
  });

  it("cada linha da tabela de áreas leva ao QR, e a de categorias não", () => {
    const tabela = ler("src/interface/componentes/tabela-de-areas.tsx");
    expect(tabela).toContain("acaoExtra=");
    expect(tabela).toContain("/configuracao/areas/${area.id}/qr");
    expect(ler("src/interface/componentes/tabela-de-categorias.tsx")).not.toContain("acaoExtra");
  });
});

describe("o critério 6, na fonte", () => {
  it("as listas fechadas do lint só crescem pelos dois convites", () => {
    // O QR da área (item 111) não ganhou arquivo próprio em lista nenhuma. Os dois que entram na lista sem
    // sessão são do convite pessoal (item 121, ADR-0021), e o que entra na sem organização é o aceite dele.
    const lint = ler("eslint.config.mjs");
    const inicioSemSessao = lint.indexOf("const ARQUIVOS_SEM_SESSAO");
    const semSessao = lint.slice(inicioSemSessao, lint.indexOf("];", inicioSemSessao));
    expect(semSessao.match(/"app\//gu)).toHaveLength(4);
    const inicioSemOrganizacao = lint.indexOf("const ROTAS_SEM_ORGANIZACAO");
    const semOrganizacao = lint.slice(inicioSemOrganizacao, lint.indexOf("];", inicioSemOrganizacao));
    expect(semOrganizacao.match(/"app\//gu)).toHaveLength(6);
  });
});
