import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  classeDoAvatar,
  INTEGRANTES,
  TOKEN_DA_COR,
} from "@/interface/componentes/integrantes-do-grupo";

/**
 * ============================================================================
 *  Item 70 — a página pública do grupo, e as portas para ela
 * ============================================================================
 *
 * **O projeto não tem biblioteca de teste de componente** (ver `casca.test.ts`). O que decide mora no
 * dado dos integrantes, e é o que se testa aqui; o que é forma vira guarda sobre o código-fonte.
 */

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function ler(relativo: string): string {
  return readFileSync(RAIZ + relativo, "utf8");
}

describe("os integrantes — critérios 70.2 e 70.3", () => {
  it("são os cinco, na ordem, com nome e RM corretos", () => {
    expect(INTEGRANTES.map(({ nome, rm }) => `${nome} ${rm}`)).toStrictEqual([
      "Dario Lacerda 369195",
      "Larissa Kramer 370062",
      "Mirian Storino 369489",
      "Natanael Dias 369334",
      "Tiago Victor 370117",
    ]);
  });

  it("as iniciais são as do primeiro e do último nome", () => {
    expect(INTEGRANTES.map(({ iniciais }) => iniciais)).toStrictEqual(["DL", "LK", "MS", "ND", "TV"]);
  });

  it("a cor é distinta em cada um, e todas têm token", () => {
    const cores = INTEGRANTES.map(({ cor }) => cor);
    expect(new Set(cores).size).toBe(5);
    for (const cor of cores) expect(TOKEN_DA_COR[cor]).toMatch(/^--[a-z-]+$/u);
  });

  it("nenhum endereço de perfil é vazio, `#` ou relativo: link sem endereço não existe", () => {
    for (const { linkedin, github } of INTEGRANTES) {
      if (linkedin !== undefined) expect(linkedin).toMatch(/^https:\/\/www\.linkedin\.com\/in\/[^/]+\/?$/u);
      if (github !== undefined) expect(github).toMatch(/^https:\/\/github\.com\/[^/]+$/u);
    }
  });

  it("só Larissa e Natanael têm perfil, e os dois têm os dois", () => {
    const comPerfil = INTEGRANTES.filter((i) => i.linkedin !== undefined || i.github !== undefined);
    expect(comPerfil.map(({ nome }) => nome)).toStrictEqual(["Larissa Kramer", "Natanael Dias"]);
    for (const i of comPerfil) {
      expect(i.linkedin).toBeDefined();
      expect(i.github).toBeDefined();
    }
  });

  it("a classe do avatar pinta nos dois temas, e usa `marca`, nunca `accent`", () => {
    for (const integrante of INTEGRANTES) {
      const classe = classeDoAvatar(integrante);
      expect(classe).toMatch(/(?:^| )bg-/u);
      expect(classe).toMatch(/(?:^| )dark:bg-/u);
      expect(classe).not.toMatch(/accent/u);
    }
  });
});

// As guardas da página, da barra e do pé entram nas Tarefas 2, 3 e 4. `ler` é usado por elas.
void ler;
