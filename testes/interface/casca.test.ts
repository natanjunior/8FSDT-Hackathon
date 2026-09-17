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

/** Linha de comentário: `*`, `//`, `/*` ou `{/*` no começo. A mesma poda de `formulario.test.ts`. */
const COMENTARIO = /^\s*(?:\*|\/\/|\/\*|\{\/\*)/u;

/** As linhas de código, fora de comentário, que contêm o trecho. */
function linhasDeCodigoCom(caminho: string, trecho: string): string[] {
  return ler(caminho)
    .split(/\r?\n/u)
    .filter((linha) => linha.includes(trecho) && !COMENTARIO.test(linha));
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

/** As onze páginas que recusam sem redirecionar, com o título da face normal e a permissão. */
const PAGINAS_QUE_RECUSAM: Readonly<Record<string, readonly [string, string]>> = {
  "app/(casca)/configuracao/page.tsx": ["Configuração da organização", "organizacao.configurar"],
  "app/(casca)/configuracao/categorias/page.tsx": ["Categorias", "organizacao.configurar"],
  "app/(casca)/configuracao/categorias/nova/page.tsx": ["Criar categoria", "organizacao.configurar"],
  "app/(casca)/configuracao/categorias/[categoriaId]/editar/page.tsx": [
    "Corrigir categoria",
    "organizacao.configurar",
  ],
  "app/(casca)/configuracao/areas/page.tsx": ["Áreas", "organizacao.configurar"],
  "app/(casca)/configuracao/areas/nova/page.tsx": ["Criar área", "organizacao.configurar"],
  "app/(casca)/configuracao/areas/[areaId]/editar/page.tsx": ["Corrigir área", "organizacao.configurar"],
  "app/(casca)/dashboard/page.tsx": ["Dashboard", "dashboard.ler"],
  "app/(casca)/vinculos/page.tsx": ["Participantes", "vinculo.gerir"],
  "app/(casca)/vinculos/nova/page.tsx": ["Cadastrar pessoa sem conta", "vinculo.gerir"],
  "app/(casca)/vinculos/[pessoaId]/editar/page.tsx": ["Editar participante", "vinculo.gerir"],
};

describe("o estado sem acesso nas páginas — critérios 3 e 4", () => {
  it("as páginas da casca que recusam sem redirecionar são as onze", () => {
    const recusam = arquivosDe("app/(casca)")
      .filter((caminho) => caminho.endsWith("/page.tsx"))
      .filter((caminho) =>
        linhasDeCodigoCom(caminho, '=== "sem-permissao"').some((linha) => !linha.includes("redirect(")),
      );
    expect(recusam).toStrictEqual(Object.keys(PAGINAS_QUE_RECUSAM).sort());
  });

  it.each(Object.entries(PAGINAS_QUE_RECUSAM))(
    "%s devolve o SemAcesso do lugar único, com o título e a permissão dela",
    (caminho, [titulo, permissao]) => {
      const fonte = ler(caminho);
      expect(fonte).toContain('import { SemAcesso } from "@/interface/componentes/sem-acesso";');
      expect(fonte).toContain(`return <SemAcesso titulo="${titulo}" permissao="${permissao}" />;`);
    },
  );

  it("nenhuma página declara a própria recusa", () => {
    const declaram = arquivosDe("app").filter((caminho) =>
      /function (?:SemAcesso|SemPermissao)\b/u.test(ler(caminho)),
    );
    expect(declaram).toStrictEqual([]);
  });

  it("a recusa e a saída existem uma vez só no produto, fora de comentário", () => {
    const codigo = [...arquivosDe("app"), ...arquivosDe("src")];
    for (const trecho of ["não dá acesso a esta página", "Ir para Ocorrências"]) {
      const ocorrencias = codigo.flatMap((caminho) =>
        linhasDeCodigoCom(caminho, trecho).map(() => caminho),
      );
      expect(ocorrencias, trecho).toStrictEqual(["src/interface/componentes/rotulos.ts"]);
    }
  });

  it("o componente usa o vazio do catálogo, o cadeado, a saída como link e nenhuma região viva", () => {
    const fonte = ler("src/interface/componentes/sem-acesso.tsx");
    expect(fonte).toContain('from "@/interface/componentes/ui/empty"');
    expect(fonte).toContain("<LockKeyhole");
    expect(fonte).toContain("<Link");
    expect(fonte).toContain('href="/ocorrencias"');
    expect(fonte).toContain("min-h-11");
    expect(fonte).not.toContain("role=");
    expect(fonte).not.toContain("use client");
  });
});

/**
 * ============================================================================
 *  Item 44i — o menu de pessoa diz de quem é a conta
 * ============================================================================
 *
 * **Guardas sobre o código-fonte**, no precedente das de cima: o cabeçalho é o rótulo do menu (que o
 * teclado não visita), *Meus dados* é item com ícone e não imprime o nome, e os dois layouts que montam
 * a barra superior passam o e-mail da sessão.
 */
describe("o menu de pessoa — critério 7 do 44i", () => {
  const MENU = "src/interface/componentes/casca/menu-de-pessoa.tsx";

  it("abre com um cabeçalho que não é alvo, com o nome e o e-mail quando há e-mail", () => {
    const fonte = ler(MENU);
    expect(fonte).toContain("<DropdownMenuLabel");
    expect(fonte).toContain("emailDaPessoa !== null");
    expect(fonte).toContain("{emailDaPessoa}");
  });

  it("Meus dados é item com ícone, e o item não imprime o nome", () => {
    const fonte = ler(MENU);
    const inicio = fonte.indexOf('href="/meus-dados"');
    const item = fonte.slice(inicio, fonte.indexOf("</DropdownMenuItem>", inicio));
    expect(inicio).toBeGreaterThan(-1);
    expect(item).toContain("<UserRound");
    expect(item).toContain("Meus dados");
    expect(item).not.toContain("nomeDaPessoa");
  });

  it("Sair continua formulário com botão de envio, agora com ícone", () => {
    const fonte = ler(MENU);
    expect(fonte).toContain("<form action={acaoDeSair}>");
    expect(fonte).toContain('type="submit"');
    expect(fonte).toContain("<LogOut");
  });

  it("os dois layouts que montam a barra superior passam o e-mail da sessão", () => {
    for (const layout of ["app/(casca)/layout.tsx", "app/(foco)/layout.tsx"]) {
      expect(ler(layout), layout).toMatch(/emailDaPessoa=\{[^}]*sessao\.email\}/u);
    }
  });
});
