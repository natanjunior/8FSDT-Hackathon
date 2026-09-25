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

  it("os cartões têm a mesma altura, e a régua fica sempre, na mesma altura (critério 76.6)", () => {
    const fonte = ler(CARTAO);
    expect(fonte).toMatch(/<Cartao tituloId=\{tituloId\} className="[^"]*\bh-full\b[^"]*\bflex-col\b/u);
    // A fileira existe com ou sem perfil: sai a condição que a escondia.
    expect(fonte).not.toContain("{temPerfil && (");
    // `mt-auto` a empurra para o pé; a altura mínima é a do botão que ela contém (44) mais o `py-3` (24),
    // para a régua do cartão sem perfil cair na mesma linha da dos vizinhos.
    expect(fonte).toMatch(/className="[^"]*\bmt-auto\b[^"]*\bmin-h-\[68px\][^"]*\bborder-t\b/u);
    expect(fonte).toContain("aria-hidden={temPerfil ? undefined : true}");
    expect(ler("src/interface/componentes/cartao.tsx")).toContain("className?: string");
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

describe("a barra lateral — critérios 70.5, 70.7, 76.1 e 76.2", () => {
  const NAVEGACAO = "src/interface/componentes/casca/navegacao.tsx";
  const PE = "src/interface/componentes/casca/pe-da-barra.tsx";
  const LAYOUT = "app/(casca)/layout.tsx";

  it("o grupo e a documentação saem do corpo e moram no pé, num marco próprio (critério 76.2)", () => {
    const corpo = ler(NAVEGACAO);
    expect(corpo).not.toContain('endereco="/grupo"');
    expect(corpo).not.toContain('endereco="/documentacao"');

    const pe = ler(PE);
    expect(pe).toContain("<SidebarFooter");
    const separador = pe.indexOf("<SidebarSeparator");
    const marco = pe.indexOf('<nav aria-label="Sobre o projeto"');
    expect(separador).toBeGreaterThan(-1);
    expect(marco).toBeGreaterThan(separador);

    // O pé é irmão do corpo, dentro do `Sidebar`: é o que o põe no fim da coluna nas duas larguras.
    const layout = ler(LAYOUT);
    const posicaoDoPe = layout.indexOf("<PeDaBarra />");
    expect(posicaoDoPe).toBeGreaterThan(layout.indexOf("</SidebarContent>"));
    expect(posicaoDoPe).toBeLessThan(layout.indexOf("</Sidebar>"));
  });

  it("Documentação vem antes de Grupo 1, e as duas abrem em nova aba e fecham a gaveta", () => {
    const pe = ler(PE);
    const documentacao = pe.indexOf('endereco="/documentacao"');
    const grupo = pe.indexOf('endereco="/grupo"');
    expect(documentacao).toBeGreaterThan(0);
    expect(grupo).toBeGreaterThan(documentacao);
    expect(pe).toContain('rotulo="Grupo 1"');
    expect(pe).toContain('rotulo="Documentação"');
    expect(pe).toMatch(/target="_blank"\s+rel="noreferrer"/u);
    expect(pe).toContain("onClick={aoTocar}");
    expect(pe).toContain('<span className="sr-only">, abre em nova aba</span>');
    expect(pe).toContain("<ExternalLink");
  });

  it("o corpo da barra não rola na horizontal, e o item externo pode encolher (critério 76.1)", () => {
    expect(ler(LAYOUT)).toMatch(/<SidebarContent className="[^"]*\boverflow-x-hidden\b/u);
    expect(ler(PE)).toMatch(/className="min-w-0"/u);
  });
});

describe("o pé de /entrar — critério 70.5", () => {
  const ENTRAR = "app/entrar/page.tsx";
  const MOLDURA = "src/interface/componentes/moldura-de-conta.tsx";

  it("a moldura aceita um pé, fora da linha das colunas", () => {
    const fonte = ler(MOLDURA);
    expect(fonte).toContain("rodape?: ReactNode;");
    expect(fonte).toMatch(/const PAGINA =\s*"relative /u);
    expect(fonte).toContain('<footer className="absolute inset-x-0 bottom-0 flex justify-center">');
  });

  it("só T-01 passa o pé", () => {
    // As outras seis que usam a moldura (`grep -rl MolduraDeConta app`).
    const telas = [
      "app/criar-conta/page.tsx",
      "app/redefinir-senha/page.tsx",
      "app/definir-senha/page.tsx",
      "app/page.tsx",
      "app/organizacao/page.tsx",
      "app/organizacao/criar/page.tsx",
    ];
    for (const caminho of telas) expect(ler(caminho), caminho).not.toContain("rodape=");
    expect(ler(ENTRAR)).toContain("rodape=");
  });

  it("os dois links, na ordem, com o texto decidido, em nova aba, e o ponto mudo", () => {
    const fonte = ler(ENTRAR);
    const grupo = fonte.indexOf('href="/grupo"');
    const documentacao = fonte.indexOf('href="/documentacao"');
    expect(grupo).toBeGreaterThan(0);
    expect(documentacao).toBeGreaterThan(grupo);
    expect(fonte).toContain("Feito pelo Grupo 1");
    expect(fonte).not.toMatch(/Created by/iu);
    expect([...fonte.matchAll(/target="_blank" rel="noreferrer"/gu)]).toHaveLength(2);
    expect([...fonte.matchAll(/<span className="sr-only">, abre em nova aba<\/span>/gu)]).toHaveLength(2);
    expect(fonte).toContain('<span aria-hidden="true">·</span>');
  });
});
