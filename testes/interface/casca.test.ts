import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListaDoSino, Sino } from "@/interface/componentes/casca/sino";
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
import {
  nomeDoSino,
  numeroDoSino,
  projetarSino,
  textoDoTipo,
  type SinoNaTela,
} from "@/interface/componentes/sino";

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

  it("o grupo Aparência fica entre duas réguas, depois da conta e antes do Sair (critério 114.5)", () => {
    const menu = ler(MENU);
    // Pelo `href`, e não pelo rótulo: o rótulo aparece antes no comentário do topo (`:37`), e o
    // `indexOf` pararia lá, deixando a régua nova sem guarda.
    const entrar = menu.indexOf('href="/organizacao?entrar-em-outra=true"');
    const reguaAntes = menu.indexOf("<DropdownMenuSeparator />", entrar);
    const grupo = menu.indexOf("<GrupoDeAparencia />");
    const reguaDepois = menu.indexOf("<DropdownMenuSeparator />", grupo);
    const sair = menu.indexOf("<form action={acaoDeSair}>");
    expect(entrar).toBeGreaterThan(-1);
    expect(reguaAntes).toBeGreaterThan(entrar);
    expect(grupo).toBeGreaterThan(reguaAntes);
    expect(reguaDepois).toBeGreaterThan(grupo);
    expect(sair).toBeGreaterThan(reguaDepois);
  });

  it("as duas chaves são o item marcável do catálogo, sem fundo no ligado (critérios 114.1 e 114.4)", () => {
    for (const arquivo of ["item-de-tema.tsx", "item-de-contraste.tsx"]) {
      const item = ler(`src/interface/componentes/casca/${arquivo}`);
      expect(item, arquivo).toContain("<DropdownMenuCheckboxItem");
      expect(item, arquivo).not.toContain("<Toggle");
      expect(item, arquivo).not.toMatch(/data-\[state=(?:on|checked)\]:bg-/u);
      expect(item, arquivo).toContain("min-h-11");
      expect(item, arquivo).toContain("onSelect={(evento) => evento.preventDefault()}");
    }
    const tema = ler("src/interface/componentes/casca/item-de-tema.tsx");
    // A razão do fundo apagado continua escrita, para a próxima leitura não achar que é esquecimento.
    expect(tema).toContain("achado A-7");
    // Inerte, e não desabilitado: `disabled` tira o item do teclado.
    expect(tema).not.toMatch(/\sdisabled[=\s}]/u);
    expect(tema).toContain("aria-disabled={inerte || undefined}");
    expect(tema).toContain('textValue="Tema escuro"');
  });

  it("o grupo é titulado no papel de rótulo da barra lateral, e tem lugar para o terceiro (critérios 114.5 e 114.6)", () => {
    const grupo = ler("src/interface/componentes/casca/itens-de-aparencia.tsx");
    expect(grupo).toContain("<DropdownMenuGroup aria-labelledby={idDoRotulo}>");
    expect(grupo).toMatch(/<DropdownMenuLabel[^>]*text-rotulo-coluna[^>]*font-mono[^>]*uppercase/u);
    expect(grupo.indexOf("<ItemDeContraste")).toBeGreaterThan(grupo.indexOf("<ItemDeTema"));
    // Por regex: os `.tsx` estão em CRLF na árvore de trabalho, e o comentário quebra a linha no meio.
    expect(grupo).toMatch(/bloco\s+\*?\s*V-1/u);
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

describe("o controle de aparência antes de entrar — critério 114.2", () => {
  const MOLDURA = "src/interface/componentes/moldura-de-conta.tsx";
  const CONTROLE = "src/interface/componentes/controle-de-aparencia.tsx";

  it("a moldura e a espera montam o controle, uma vez cada", () => {
    const moldura = ler(MOLDURA);
    expect(moldura.match(/<ControleDeAparencia \/>/gu)).toHaveLength(2);
    const molduraDaTela = moldura.slice(moldura.indexOf("export function MolduraDeConta"));
    const espera = moldura.slice(moldura.indexOf("export function EsperaDaMolduraDeConta"));
    expect(molduraDaTela.slice(0, molduraDaTela.indexOf("function CartaoDaTela"))).toContain(
      "<ControleDeAparencia />",
    );
    expect(espera.slice(0, espera.indexOf("function CartaoDeEspera"))).toContain("<ControleDeAparencia />");
  });

  it("o gatilho tem a palavra, e o menu abre com o grupo", () => {
    const controle = ler(CONTROLE);
    expect(controle).toContain("Aparência");
    expect(controle).toContain("<GrupoDeAparencia />");
    expect(controle).toContain('align="end"');
    expect(controle).toContain("min-h-11");
  });

  it("a documentação não o monta, e o motivo está escrito", () => {
    expect(ler("app/documentacao/layout.tsx")).not.toContain("ControleDeAparencia");
    expect(ler(CONTROLE)).toContain("/documentacao");
  });
});

/**
 * ============================================================================
 *  117 · o sino
 * ============================================================================
 *
 * **As funções puras pelo valor, e os dois componentes por `renderToStaticMarkup`**, que roda em `node` sem
 * DOM. A lista aberta vive num portal fechado e não sai na renderização do botão, e por isso o miolo,
 * `ListaDoSino`, é exportado e testado direto. As ações chegam por propriedade, e aqui são falsas.
 */
describe("o sino — item 117", () => {
  const telaCom = (n: number): SinoNaTela => ({ naoLidas: n, naoLidasNaLista: [], lidas: [], foraDaLista: 0 });
  const ACOES_FALSAS = { marcarComoLida: async () => undefined, marcarComoNaoLida: async () => undefined };

  it("o número: ausente no zero, exato até 99, teto depois", () => {
    expect(numeroDoSino(0)).toBeNull();
    expect(numeroDoSino(7)).toBe("7");
    expect(numeroDoSino(99)).toBe("99");
    expect(numeroDoSino(104)).toBe("99+");
  });

  it("o nome acessível leva o número exato, e não o teto", () => {
    expect(nomeDoSino(0)).toBe("Avisos");
    expect(nomeDoSino(1)).toBe("Avisos, 1 não lido");
    expect(nomeDoSino(104)).toBe("Avisos, 104 não lidos");
  });

  it("o texto de cada tipo — spec §3.13", () => {
    const base = {
      ocorrenciaId: "o",
      titulo: "T",
      em: "2026-10-03T11:00:00.000Z",
      por: { pessoaId: "g", nome: "G" },
      naoLida: true,
    };
    expect(textoDoTipo({ ...base, tipo: "criacao", alvo: null }, "x", null)).toBe("Nova ocorrência");
    expect(textoDoTipo({ ...base, tipo: "status", alvo: null }, "x", "Em análise")).toBe("Em análise");
    expect(textoDoTipo({ ...base, tipo: "comentario", alvo: null }, "x", null)).toBe("Comentário");
    expect(textoDoTipo({ ...base, tipo: "atribuicao", alvo: { pessoaId: "x", nome: "X" } }, "x", null)).toBe(
      "Atribuída a você",
    );
    expect(textoDoTipo({ ...base, tipo: "atribuicao", alvo: { pessoaId: "y", nome: "Y" } }, "x", null)).toBe(
      "Novo responsável",
    );
    expect(
      textoDoTipo({ ...base, tipo: "compartilhamento", alvo: { pessoaId: "x", nome: "X" } }, "x", null),
    ).toBe("Compartilhada com você");
    expect(
      textoDoTipo({ ...base, tipo: "compartilhamento", alvo: { pessoaId: "y", nome: "Yara" } }, "x", null),
    ).toBe("Compartilhada com Yara");
  });

  it("a projeção reparte em duas faixas, usa o rótulo de quem lê e conta o que ficou fora", () => {
    const novidade = (id: string, naoLida: boolean) => ({
      ocorrenciaId: id,
      titulo: `T ${id}`,
      tipo: "status" as const,
      em: "2026-10-03T10:00:00.000Z",
      por: { pessoaId: "g", nome: "Gestora" },
      statusNovo: "em_atendimento" as const,
      motivoPausa: null,
      alvo: null,
      naoLida,
    });
    const tela = projetarSino(
      { novidades: [novidade("a", true), novidade("b", false)], naoLidas: 4 },
      { pessoaId: "s", lente: { leitor: "solicitante", rotulos: {} } },
      Date.parse("2026-10-03T12:00:00.000Z"),
    );
    expect(tela.naoLidasNaLista.map((l) => l.ocorrenciaId)).toStrictEqual(["a"]);
    expect(tela.lidas.map((l) => l.ocorrenciaId)).toStrictEqual(["b"]);
    expect(tela.foraDaLista).toBe(3);
    expect(tela.naoLidasNaLista[0]).toMatchObject({ href: "/ocorrencias/a", por: "Gestora", quando: "há 2 horas" });
    // O rótulo é o do Solicitante, e não o nome do ciclo que o Gestor lê (item 100). `em_atendimento`, e
    // não `em_analise`: os dois leitores leem *Em análise*, e o caso não discriminaria.
    expect(tela.naoLidasNaLista[0]!.tipo).toBe("Em execução");
  });

  it("o botão: 44 px, pílula absoluta, nome com o número; sem pílula no zero", () => {
    const com = renderToStaticMarkup(createElement(Sino, { sino: telaCom(104), acoes: ACOES_FALSAS }));
    expect(com).toContain('aria-label="Avisos, 104 não lidos"');
    expect(com).toContain(">99+<");
    expect(com).toMatch(/class="[^"]*\babsolute\b[^"]*"[^>]*>99\+</u);
    expect(com).toMatch(/class="[^"]*\bsize-11\b/u);
    const sem = renderToStaticMarkup(createElement(Sino, { sino: telaCom(0), acoes: ACOES_FALSAS }));
    expect(sem).toContain('aria-label="Avisos"');
    expect(sem).not.toContain('data-slot="badge"');
  });

  it("durante a espera o sino aparece sem número, e nunca esqueleto", () => {
    const espera = renderToStaticMarkup(createElement(Sino, { sino: null, acoes: ACOES_FALSAS }));
    expect(espera).toContain('aria-label="Avisos"');
    expect(espera).toContain('aria-busy="true"');
    expect(espera).not.toContain("skeleton");
    // E o sino que chegou não está ocupado, nem com zero.
    expect(renderToStaticMarkup(createElement(Sino, { sino: telaCom(0), acoes: ACOES_FALSAS }))).not.toContain(
      "aria-busy",
    );
  });

  it("a lista: faixas com cabeçalho, título como link, marcar como texto, vazio e pé", () => {
    const linha = {
      ocorrenciaId: "a",
      href: "/ocorrencias/a",
      titulo: "Vazamento",
      tipo: "Comentário",
      por: "Gestora",
      quando: "há 2 horas",
    };
    const cheia = renderToStaticMarkup(
      createElement(ListaDoSino, {
        sino: {
          naoLidas: 5,
          naoLidasNaLista: [linha],
          lidas: [{ ...linha, ocorrenciaId: "b", href: "/ocorrencias/b" }],
          foraDaLista: 4,
        },
        acoes: ACOES_FALSAS,
      }),
    );
    expect(cheia).toMatch(/<h3[^>]*>Não lidas<\/h3>[\s\S]*<h3[^>]*>Lidas<\/h3>/u);
    // Cada faixa é uma região com o nome do próprio título — é o que o leitor de tela anuncia, e o que o
    // ponta a ponta localiza.
    expect(cheia).toMatch(/<section[^>]*aria-labelledby="([^"]+)"[\s\S]*?<h3[^>]*id="\1"/u);
    expect(cheia).toContain('href="/ocorrencias/a"');
    expect(cheia).toContain(">Marcar como lida<");
    expect(cheia).toContain(">Marcar como não lida<");
    expect(cheia).toContain("Mais 4 não lidas fora desta lista.");
    const vazia = renderToStaticMarkup(createElement(ListaDoSino, { sino: telaCom(0), acoes: ACOES_FALSAS }));
    expect(vazia).toContain("Nada novo por aqui.");
    expect(vazia).not.toContain("<h3");
  });

  it("no celular a lista sobe de baixo, pela gaveta do catálogo, e sem pacote novo (critério 118.5)", () => {
    const fonte = ler("src/interface/componentes/casca/sino.tsx");
    // A largura vem do mesmo gancho da barra lateral, no mesmo limiar `md`.
    expect(fonte).toContain("useIsMobile()");
    expect(fonte).toContain('<SheetContent side="bottom"');
    // **Uma raiz só**, como no `modal.tsx`: o `Dialog` com o `DialogTrigger` fica, e só o conteúdo troca.
    // É o que faz girar o aparelho com a lista aberta não perder o estado, que mora no `Sino`.
    expect(fonte.match(/<Dialog open=\{aberto\}/gu)).toHaveLength(1);
    expect(fonte.match(/<DialogTrigger asChild>/gu)).toHaveLength(1);
    // E o `Popover` continua sendo a forma de tela grande.
    expect(fonte).toContain("<PopoverContent");
    // O título é obrigatório: dele sai o nome acessível que o ponta a ponta localiza, e o `pr-14` o
    // mantém fora do X que a folha desenha.
    expect(fonte).toMatch(/<DialogTitle[^>]*pr-14[^>]*>Avisos<\/DialogTitle>/u);
    // Só o corpo rola; o título fica fora da rolagem, como nos nove modais da família.
    expect(fonte).toContain('<div className="min-h-0 flex-1 overflow-y-auto">{lista}</div>');
    // A forma da gaveta vem do `modal.tsx`, e não de uma segunda cópia da cadeia.
    expect(fonte).toContain("CONTEUDO_DO_SHEET");
    expect(fonte).toContain("max-h-[85dvh]");
    // Nem o `drawer` do shadcn nem o `vaul`: a decisão do dono de 03/10.
    expect(fonte).not.toMatch(/from "(?:vaul|@\/interface\/componentes\/ui\/drawer)"/u);
    // Sem `w-screen` e sem `h-dvh`: a folha de `side="bottom"` já é `inset-x-0`, e era o `100vw` que
    // criava a rolagem lateral que o critério 8 proíbe.
    expect(fonte).not.toContain("w-screen");
    expect(fonte).not.toContain("h-dvh");
  });

  it("a barra põe o sino entre o seletor e o menu de pessoa", () => {
    const fonte = ler("src/interface/componentes/casca/barra-superior.tsx");
    const seletor = fonte.indexOf("<SeletorDeOrganizacao");
    const sino = fonte.indexOf("{sino}");
    const menu = fonte.indexOf("<MenuDePessoa");
    expect(seletor).toBeLessThan(sino);
    expect(sino).toBeLessThan(menu);
  });

  it("o layout da casca espera o sino num Suspense, com o sino sem número de reserva", () => {
    const fonte = ler("app/(casca)/layout.tsx");
    expect(fonte).toMatch(/<Suspense fallback=\{<Sino sino=\{null\} acoes=\{ACOES_DO_SINO\} \/>\}>\s*<SinoComContagem/u);
  });

  it("a moldura de foco não monta o sino, pela razão da barra lateral", () => {
    const fonte = ler("app/(foco)/layout.tsx");
    expect(fonte).toContain("<BarraSuperior");
    expect(fonte).not.toContain("<Sino");
  });
});
