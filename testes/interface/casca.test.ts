import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DESTINOS_DA_BARRA,
  destinoAtual,
  estaMarcado,
} from "@/interface/componentes/casca/destino-atual";
import {
  fraseDePedidosPendentes,
  PERMISSOES_DE_TELA,
  QUEM_USA_A_TELA,
  RECUSA_DE_ACESSO,
  SAIDA_DO_SEM_ACESSO,
} from "@/interface/componentes/rotulos";

/**
 * ============================================================================
 *  Item 44h — a casca marca onde você está, e o beco tem uma forma só
 * ============================================================================
 *
 * **O projeto não tem biblioteca de teste de componente**, e esta pasta roda com `environment: "node"`.
 * O que decide mora em função pura (a marca, a contagem, as frases), e é o que se testa aqui. **O que é
 * regra de forma vira guarda sobre o código-fonte**, no precedente de `formulario.test.ts`: onze páginas
 * devolvem o mesmo componente, e nenhuma escreve a recusa por conta própria.
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function ler(relativo: string): string {
  return readFileSync(RAIZ + relativo, "utf8");
}

/** Os `.ts` e `.tsx` de uma pasta, com o caminho lógico a partir da raiz e separador `/`. */
function arquivosDe(pasta: string): string[] {
  return readdirSync(RAIZ + pasta, { recursive: true, encoding: "utf8" })
    .map((caminho) => `${pasta}/${caminho.replace(/\\/gu, "/")}`)
    .filter((caminho) => /\.tsx?$/u.test(caminho))
    .sort();
}

describe("a marca da barra lateral — critério 1", () => {
  it.each([
    ["/ocorrencias", "/ocorrencias"],
    ["/ocorrencias/0b9d5c1e-6f7a-4c3b-9a2d-1e2f3a4b5c6d", "/ocorrencias"],
    ["/ocorrencias/0b9d5c1e-6f7a-4c3b-9a2d-1e2f3a4b5c6d/auditoria", "/ocorrencias"],
    ["/configuracao", "/configuracao"],
    ["/configuracao/", "/configuracao"],
    ["/configuracao/categorias", "/configuracao/categorias"],
    ["/configuracao/categorias/nova", "/configuracao/categorias"],
    ["/configuracao/categorias/abc/editar", "/configuracao/categorias"],
    ["/configuracao/areas", "/configuracao/areas"],
    ["/configuracao/areas/nova", "/configuracao/areas"],
    ["/configuracao/areas/abc/editar", "/configuracao/areas"],
    ["/vinculos", "/vinculos"],
    ["/vinculos/nova", "/vinculos"],
    ["/vinculos/abc/editar", "/vinculos"],
    ["/dashboard", "/dashboard"],
  ])("%s marca %s", (caminho, destino) => {
    expect(destinoAtual(caminho)).toBe(destino);
  });

  it.each(["/meus-dados", "/", "", "/ocorrenciasx", "/configuracaox/categorias", "/entrar"])(
    "'%s' não marca nada",
    (caminho) => {
      expect(destinoAtual(caminho)).toBeNull();
    },
  );

  it("o destino mais longo leva a marca, e o curto não a recebe mesmo que o longo não esteja desenhado", () => {
    expect(estaMarcado("/configuracao/categorias", "/configuracao/categorias/nova")).toBe(true);
    expect(estaMarcado("/configuracao", "/configuracao/categorias/nova")).toBe(false);
    expect(estaMarcado("/configuracao", "/configuracao")).toBe(true);
    expect(estaMarcado("/ocorrencias", "/meus-dados")).toBe(false);
  });

  it("a lista tem os seis destinos da barra, sem repetição", () => {
    expect([...DESTINOS_DA_BARRA].sort()).toStrictEqual([
      "/configuracao",
      "/configuracao/areas",
      "/configuracao/categorias",
      "/dashboard",
      "/ocorrencias",
      "/vinculos",
    ]);
  });
});

describe("a contagem de pedidos — critério 2", () => {
  it.each([
    [0, "nenhum pedido pendente"],
    [1, "1 pedido pendente"],
    [2, "2 pedidos pendentes"],
    [12, "12 pedidos pendentes"],
    [200, "200 pedidos pendentes"],
  ])("%i vira '%s'", (pendentes, frase) => {
    expect(fraseDePedidosPendentes(pendentes)).toBe(frase);
  });
});

describe("as frases do estado sem acesso — critério 3", () => {
  it("as três permissões de tela têm a frase de quem usa a tela", () => {
    expect(QUEM_USA_A_TELA).toStrictEqual({
      "organizacao.configurar": "Esta página é de quem configura a organização.",
      "vinculo.gerir": "Esta página é de quem decide quem participa da organização.",
      "dashboard.ler": "Esta página é de quem acompanha os indicadores da organização.",
    });
    expect(Object.keys(QUEM_USA_A_TELA).sort()).toStrictEqual([...PERMISSOES_DE_TELA].sort());
  });

  it("a recusa e a saída são as do critério", () => {
    expect(RECUSA_DE_ACESSO).toBe("Seu papel nesta organização não dá acesso a esta página.");
    expect(SAIDA_DO_SEM_ACESSO).toBe("Ir para Ocorrências");
  });

  it("nenhuma frase do estado usa palavra do projeto", () => {
    const frases = [...Object.values(QUEM_USA_A_TELA), RECUSA_DE_ACESSO, SAIDA_DO_SEM_ACESSO];
    for (const frase of frases) {
      expect(frase).not.toMatch(/entrega|vers[aã]o|etapa/iu);
    }
  });
});

describe("a barra lateral — critérios 1 e 2 no componente", () => {
  const NAVEGACAO = "src/interface/componentes/casca/navegacao.tsx";

  it("desenha cada destino da lista uma vez, e só eles", () => {
    const desenhados = [...ler(NAVEGACAO).matchAll(/destino="([^"]+)"/gu)]
      .map((achado) => achado[1])
      .sort();
    expect(desenhados).toStrictEqual([...DESTINOS_DA_BARRA].sort());
  });

  it("lê o caminho, e o item marcado leva isActive e aria-current no link", () => {
    const fonte = ler(NAVEGACAO);
    expect(fonte.startsWith('"use client";')).toBe(true);
    expect(fonte).toContain("usePathname()");
    expect(fonte).toContain("isActive={marcado}");
    expect(fonte).toContain('aria-current={marcado ? "page" : undefined}');
  });

  it("a palavra anterior da contagem não sobra na casca", () => {
    const comAPalavra = arquivosDe("src/interface/componentes/casca").filter((caminho) =>
      ler(caminho).includes("aguardando"),
    );
    expect(comAPalavra).toStrictEqual([]);
  });

  it("os grupos da barra não têm recuo próprio, que é o que faz a contagem caber", () => {
    const grupos = [...ler(NAVEGACAO).matchAll(/<SidebarGroup className="([^"]*)"/gu)].map(
      (achado) => achado[1],
    );
    expect(grupos).toStrictEqual(["p-0", "p-0", "p-0"]);
  });
});
