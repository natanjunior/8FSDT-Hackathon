import { describe, expect, it } from "vitest";

import {
  DESTINOS_DA_BARRA,
  destinoAtual,
  estaMarcado,
} from "@/interface/componentes/casca/destino-atual";

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
