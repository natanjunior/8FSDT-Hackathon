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

describe("o critério 6, na fonte", () => {
  it("as listas fechadas do lint não ganharam linha", () => {
    const lint = ler("eslint.config.mjs");
    const inicioSemSessao = lint.indexOf("const ARQUIVOS_SEM_SESSAO");
    const semSessao = lint.slice(inicioSemSessao, lint.indexOf("];", inicioSemSessao));
    expect(semSessao.match(/"app\//gu)).toHaveLength(2);
    const inicioSemOrganizacao = lint.indexOf("const ROTAS_SEM_ORGANIZACAO");
    const semOrganizacao = lint.slice(inicioSemOrganizacao, lint.indexOf("];", inicioSemOrganizacao));
    expect(semOrganizacao.match(/"app\//gu)).toHaveLength(5);
  });
});
