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

/**
 * O arquivo linha a linha, com o comentário apagado e as linhas no lugar — inclusive o comentário de
 * bloco que atravessa várias linhas.
 *
 * `COMENTARIO` olha uma linha por vez, e o miolo de um bloco não tem como se declarar: a linha do meio
 * de um comentário de JSX começa com a palavra e não com marca nenhuma. Quem procura uma palavra no
 * produto inteiro precisa ler o bloco como bloco, e é o que esta função faz. O que sai daqui não é
 * TypeScript válido, é o texto que sobra quando o comentário sai.
 */
function linhasSemComentario(caminho: string): string[] {
  let dentroDeBloco = false;
  return ler(caminho)
    .split(/\r?\n/u)
    .map((bruta) => {
      let resto = bruta;
      let codigo = "";
      while (resto.length > 0) {
        if (dentroDeBloco) {
          const fecha = resto.indexOf("*/");
          if (fecha === -1) return codigo;
          dentroDeBloco = false;
          resto = resto.slice(fecha + 2);
          continue;
        }
        const abreBloco = resto.indexOf("/*");
        const abreLinha = resto.indexOf("//");
        if (abreLinha !== -1 && (abreBloco === -1 || abreLinha < abreBloco)) {
          return codigo + resto.slice(0, abreLinha);
        }
        if (abreBloco === -1) return codigo + resto;
        codigo += resto.slice(0, abreBloco);
        dentroDeBloco = true;
        resto = resto.slice(abreBloco + 2);
      }
      return codigo;
    });
}

describe("a marca da barra lateral — critério 1", () => {
  it.each([
    ["/ocorrencias", "/ocorrencias"],
    ["/ocorrencias/0b9d5c1e-6f7a-4c3b-9a2d-1e2f3a4b5c6d", "/ocorrencias"],
    ["/ocorrencias/0b9d5c1e-6f7a-4c3b-9a2d-1e2f3a4b5c6d/auditoria", "/ocorrencias"],
    ["/configuracao", "/configuracao"],
    ["/configuracao/", "/configuracao"],
    ["/configuracao/categorias", "/configuracao/categorias"],
    ["/configuracao/areas", "/configuracao/areas"],
    ["/vinculos", "/vinculos"],
    ["/vinculos/nova", "/vinculos"],
    ["/vinculos/abc/editar", "/vinculos"],
    ["/dashboard", "/dashboard"],
    ["/meus-dados", "/meus-dados"],
  ])("%s marca %s", (caminho, destino) => {
    expect(destinoAtual(caminho)).toBe(destino);
  });

  it.each(["/", "", "/ocorrenciasx", "/configuracaox/categorias", "/entrar", "/meus-dadosx"])(
    "'%s' não marca nada",
    (caminho) => {
      expect(destinoAtual(caminho)).toBeNull();
    },
  );

  it("o destino mais longo leva a marca, e o curto não a recebe mesmo que o longo não esteja desenhado", () => {
    // `/vinculos/nova` existe e **não** é destino da barra: é o caso que o título promete, e as quatro
    // rotas de criar e editar de T-09 e T-14, que o serviam antes, saíram com o item 44k.
    expect(estaMarcado("/vinculos", "/vinculos/nova")).toBe(true);
    expect(estaMarcado("/configuracao", "/vinculos/nova")).toBe(false);
    expect(estaMarcado("/configuracao", "/configuracao")).toBe(true);
    expect(estaMarcado("/ocorrencias", "/meus-dados")).toBe(false);
    // Desde o item 64 `/meus-dados` está na barra, e a premissa do 44h ("não marca nada, porque não está
    // na barra") caiu com ela.
    expect(estaMarcado("/meus-dados", "/meus-dados")).toBe(true);
  });

  it("a lista tem os oito destinos da barra, sem repetição", () => {
    expect([...DESTINOS_DA_BARRA].sort()).toStrictEqual([
      "/configuracao",
      "/configuracao/areas",
      "/configuracao/categorias",
      "/convidar",
      "/dashboard",
      "/meus-dados",
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

  it("o item marcado ganha uma régua de 2 px na cor da marca, além do fundo (critério 106.9)", () => {
    const sidebar = ler("src/interface/componentes/ui/sidebar.tsx");
    const base = /const sidebarMenuButtonVariants = cva\(\s*"([^"]*)"/u.exec(sidebar)?.[1] ?? "";
    const classes = base.split(/\s+/u);
    for (const classe of [
      "relative",
      "before:absolute",
      "before:inset-y-1.5",
      "before:left-0",
      "before:w-0.5",
      "before:rounded-full",
      "data-[active=true]:before:bg-marca",
      "data-[active=true]:bg-sidebar-accent",
    ]) {
      expect(classes, classe).toContain(classe);
    }
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
    // `pt-6` no grupo do painel é respiro vertical, no lugar da régua sem título (critério 106.16).
    expect(grupos).toStrictEqual(["p-0", "p-0", "p-0 pt-6", "p-0"]);
  });

  it("dentro de «Nesta organização» a régua só fica acima de grupo com título (critério 106.16)", () => {
    const fonte = ler(NAVEGACAO);
    // Até o `</nav>` do primeiro marco: a régua entre os dois marcos fica fora por construção, e ela
    // separa marcos, não grupos (o caso do item 64 a guarda).
    const marco = fonte.slice(
      fonte.indexOf('<nav aria-label="Nesta organização"'),
      fonte.lastIndexOf("</nav>", fonte.indexOf('<nav aria-label="Além desta organização"')),
    );
    const blocos = marco.split("<SidebarSeparator").slice(1);
    expect(blocos.length).toBeGreaterThan(0);
    for (const bloco of blocos) {
      const grupo = bloco.slice(0, bloco.indexOf("</SidebarGroup>"));
      expect(grupo).toContain("<SidebarGroupLabel");
    }
  });

  it("Meus dados mora num segundo marco, fora de «Nesta organização», depois de uma régua (item 64)", () => {
    const fonte = ler(NAVEGACAO);
    const organizacao = fonte.indexOf('<nav aria-label="Nesta organização"');
    const alem = fonte.indexOf('<nav aria-label="Além desta organização"');
    const meusDados = fonte.indexOf('destino="/meus-dados"');
    expect(organizacao).toBeGreaterThan(-1);
    expect(alem).toBeGreaterThan(organizacao);
    // O item está dentro do segundo marco, e não do primeiro.
    expect(meusDados).toBeGreaterThan(alem);
    expect(fonte.slice(organizacao, alem)).not.toContain('destino="/meus-dados"');
    // A régua fica fora de qualquer condição: o Solicitante, sem Dashboard, também a vê (Review Focus 2).
    const entreOsMarcos = fonte.slice(fonte.lastIndexOf("</nav>", alem), alem);
    expect(entreOsMarcos).toContain("<SidebarSeparator");
    expect(entreOsMarcos).not.toContain("&&");
    expect(fonte.slice(alem)).toContain("Icone={UserRound}");
  });
});

/**
 * As nove páginas que recusam sem redirecionar, com o título da face normal e a permissão.
 *
 * **A nona é o QR da área** (item 111), debaixo de T-14 e com a mesma permissão.
 *
 * **Eram onze até o item 44k**, que apagou as quatro rotas próprias de criar e editar de T-09 e T-14: as
 * duas listas passaram a criar e editar em modal, e o estado sem acesso das duas telas ficou sendo a
 * única saída de conteúdo da casca por lá.
 */
const PAGINAS_QUE_RECUSAM: Readonly<Record<string, readonly [string, string]>> = {
  "app/(casca)/configuracao/page.tsx": ["Configuração da organização", "organizacao.configurar"],
  "app/(casca)/convidar/page.tsx": ["Convidar pessoas", "vinculo.gerir"],
  "app/(casca)/configuracao/categorias/page.tsx": ["Categorias", "organizacao.configurar"],
  "app/(casca)/configuracao/areas/page.tsx": ["Áreas", "organizacao.configurar"],
  "app/(casca)/configuracao/areas/[areaId]/qr/page.tsx": ["QR da área", "organizacao.configurar"],
  "app/(casca)/dashboard/page.tsx": ["Painel", "dashboard.ler"],
  "app/(casca)/vinculos/page.tsx": ["Participantes", "vinculo.gerir"],
  "app/(casca)/vinculos/nova/page.tsx": ["Cadastrar pessoa sem conta", "vinculo.gerir"],
  "app/(casca)/vinculos/[pessoaId]/editar/page.tsx": ["Editar participante", "vinculo.gerir"],
};

describe("o estado sem acesso nas páginas — critérios 3 e 4", () => {
  it("as páginas da casca que recusam sem redirecionar são as nove", () => {
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

  it("o tema e o contraste são dois `Toggle` do catálogo, entre «Entrar em outra organização» e o Sair (itens 72 e 85)", () => {
    const menu = ler(MENU);
    const pai = ler("src/interface/componentes/casca/itens-de-aparencia.tsx");

    const entrar = menu.indexOf("Entrar em outra organização");
    const aparencia = menu.indexOf("<ItensDeAparencia />");
    const sair = menu.indexOf("<form action={acaoDeSair}>");
    expect(entrar).toBeGreaterThan(-1);
    expect(aparencia).toBeGreaterThan(entrar);
    expect(sair).toBeGreaterThan(aparencia);

    // O tema vem antes do contraste.
    expect(pai.indexOf("<ItemDeTema")).toBeGreaterThan(-1);
    expect(pai.indexOf("<ItemDeContraste")).toBeGreaterThan(pai.indexOf("<ItemDeTema"));

    // Os dois são item marcável, e não botão pressionado: `aria-pressed` não vale em item de menu.
    for (const arquivo of ["item-de-tema.tsx", "item-de-contraste.tsx"]) {
      const item = ler(`src/interface/componentes/casca/${arquivo}`);
      expect(item, arquivo).toContain("<Toggle");
      expect(item, arquivo).toContain('role="menuitemcheckbox"');
      expect(item, arquivo).toContain("aria-pressed={undefined}");
      expect(item, arquivo).toContain("<DropdownMenuItem asChild");
    }
    expect(ler("src/interface/componentes/casca/item-de-contraste.tsx")).toContain("Alto contraste");
    expect(ler("src/interface/componentes/casca/item-de-tema.tsx")).toContain("Tema escuro");
  });

  it("os dois layouts que montam a barra superior passam o e-mail da sessão", () => {
    for (const layout of ["app/(casca)/layout.tsx", "app/(foco)/layout.tsx"]) {
      expect(ler(layout), layout).toMatch(/emailDaPessoa=\{[^}]*sessao\.email\}/u);
    }
  });
});

/**
 * ============================================================================
 *  Critério 31.5 — a palavra "síndico" não chega à tela, em lugar nenhum
 * ============================================================================
 *
 * A decisão **D3** diz que a organização é o local, e condomínio é um local entre outros: empresa,
 * bairro, escola. Uma palavra de condomínio num rótulo trava o produto num tipo de cliente, e é por isso
 * que o critério existe.
 *
 * **O que já estava provado:** `ocorrencia.test.ts` percorre as três tabelas de rótulo de status e
 * nenhuma tem a palavra. **O que falta é o resto do produto** — botão, título, frase de vazio, texto de
 * erro, `aria-label`, o que for. Esta guarda lê `app/` e `src/` inteiros e pergunta uma coisa só: a
 * palavra aparece fora de comentário?
 *
 * **O comentário fica de fora de propósito.** A palavra aparece hoje em comentário de sete arquivos, e
 * é onde ela deve mesmo estar: explicar o Gestor que mora no prédio é o que faz o código de
 * `lista-de-ocorrencias` ser legível. Comentário não chega ao navegador. Por isso a guarda precisa do
 * coador de bloco, e por isso o coador é testado antes de ser acreditado.
 */
describe("a palavra do condomínio — critério 31.5", () => {
  const SINDICO = /s[ií]ndico/iu;
  const PRODUTO = [...arquivosDe("app"), ...arquivosDe("src")];

  it("o coador guarda o código e apaga o comentário, inclusive o bloco de JSX em três linhas", () => {
    const lista = linhasSemComentario("src/interface/componentes/lista-de-ocorrencias.tsx");
    // O comentário de JSX em três linhas da célula do título: a linha do meio é a que escapa de
    // `COMENTARIO`, e é o caso que justifica esta função existir. Até o item 76 o caso era o comentário
    // da marca do convite, que saiu com ele.
    expect(lista.filter((linha) => SINDICO.test(linha))).toStrictEqual([]);
    expect(lista.some((linha) => linha.includes("texto livre de até 120 caracteres"))).toBe(false);
    expect(
      lista.some((linha) => linha.includes("segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo)")),
    ).toBe(true);

    // E o coador não pode comer texto que chega à tela: a frase da recusa continua, a tabela que só
    // existe no comentário de `rotulos.ts` some.
    const rotulos = linhasSemComentario("src/interface/componentes/rotulos.ts");
    expect(rotulos.some((linha) => linha.includes(RECUSA_DE_ACESSO))).toBe(true);
    expect(rotulos.some((linha) => linha.includes("**Gestor autor**"))).toBe(false);
  });

  it("nenhuma linha de código de app/ e src/ escreve a palavra", () => {
    expect(PRODUTO.length).toBeGreaterThan(100);
    const onde = PRODUTO.flatMap((caminho) =>
      linhasSemComentario(caminho)
        .map((linha, indice) => (SINDICO.test(linha) ? `${caminho}:${indice + 1}` : null))
        .filter((achado) => achado !== null),
    );
    expect(onde).toStrictEqual([]);
  });
});
