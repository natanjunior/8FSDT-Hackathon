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

describe("a página /grupo — critérios 70.1, 70.3 e 70.4", () => {
  const PAGINA = "app/grupo/page.tsx";
  const CARTAO = "src/interface/componentes/cartao-de-integrante.tsx";

  it("não lê sessão: nenhum import da resolução de contexto nem da borda HTTP", () => {
    const fonte = ler(PAGINA);
    expect(fonte).not.toMatch(/@\/interface\/http|@\/aplicacao\/contexto|force-dynamic|cookies\(|headers\(/u);
  });

  it("desenha os integrantes do dado, e não uma cópia deles", () => {
    const fonte = ler(PAGINA);
    expect(fonte).toContain("INTEGRANTES.map(");
    expect(fonte).not.toMatch(/369195|Lacerda/u);
  });

  it("a grade empilha no celular e abre em três colunas na tela grande", () => {
    expect(ler(PAGINA)).toContain("grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3");
  });

  it("o link de perfil só existe com endereço, abre em nova aba e diz de quem é", () => {
    const fonte = ler(CARTAO);
    expect(fonte).toContain("integrante.linkedin !== undefined &&");
    expect(fonte).toContain("integrante.github !== undefined &&");
    expect(fonte).toContain('target="_blank"');
    expect(fonte).toContain('rel="noreferrer"');
    expect(fonte).toContain("aria-label={`${servico} de ${nome}, abre em nova aba`}");
    expect(fonte).not.toMatch(/href="#"/u);
  });

  it("o cartão não estoura no celular: o nome encolhe e os botões quebram linha", () => {
    const fonte = ler(CARTAO);
    expect(fonte).toContain("min-w-0");
    expect(fonte).toContain("flex-wrap");
  });

  it("nenhuma cor crua e nenhum tamanho fora dos papéis da escala", () => {
    for (const caminho of [PAGINA, CARTAO]) {
      const fonte = ler(caminho);
      expect(fonte, caminho).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(/u);
      expect(fonte, caminho).not.toMatch(/\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/u);
    }
  });
});

describe("a barra lateral — critérios 70.5 e 70.7", () => {
  const NAVEGACAO = "src/interface/componentes/casca/navegacao.tsx";

  it("o grupo e a documentação moram no bloco «Além desta organização», um só, depois de Meus dados", () => {
    const fonte = ler(NAVEGACAO);
    const organizacao = fonte.indexOf('<nav aria-label="Nesta organização"');
    const alem = fonte.indexOf('<nav aria-label="Além desta organização"');
    expect(organizacao).toBeGreaterThanOrEqual(0);
    expect(alem).toBeGreaterThan(organizacao);
    // Um bloco só: quem sair primeiro, o 64 ou o 70, cria; o segundo acrescenta.
    expect([...fonte.matchAll(/<nav aria-label="Além desta organização"/gu)]).toHaveLength(1);
    const grupo = fonte.indexOf('endereco="/grupo"');
    expect(grupo).toBeGreaterThan(alem);
    // Com o 64 na base, Meus dados vem antes; sem ele, a asserção não tem o que comparar.
    const meusDados = fonte.indexOf('destino="/meus-dados"');
    if (meusDados !== -1) expect(grupo).toBeGreaterThan(meusDados);
  });

  it("as duas entradas, na ordem, abrem em nova aba e fecham a gaveta", () => {
    const fonte = ler(NAVEGACAO);
    const grupo = fonte.indexOf('endereco="/grupo"');
    const documentacao = fonte.indexOf('endereco="/documentacao"');
    expect(grupo).toBeGreaterThan(0);
    expect(documentacao).toBeGreaterThan(grupo);
    expect(fonte).toContain('rotulo="Grupo 1"');
    expect(fonte).toContain('rotulo="Documentação"');
    expect(fonte).toMatch(/target="_blank"\s+rel="noreferrer"\s+onClick=\{aoTocar\}/u);
    expect(fonte).toContain('<span className="sr-only">, abre em nova aba</span>');
    expect(fonte).toContain("<ExternalLink");
  });
});
