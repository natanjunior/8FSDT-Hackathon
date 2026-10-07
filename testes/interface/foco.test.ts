/** @vitest-environment jsdom */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { GraficoDeBarras } from "@/interface/componentes/grafico-de-barras";
import { GraficoDoFluxoMensal } from "@/interface/componentes/grafico-do-fluxo-mensal";
import { GraficoDoTempoDeResolucao } from "@/interface/componentes/grafico-do-tempo-de-resolucao";
import { ID_DO_CONTEUDO, PularParaOConteudo } from "@/interface/componentes/pular-para-o-conteudo";
import { SAI_SEM_ACUSAR, saidaConta, useFormularioTocado } from "@/interface/ganchos/use-formulario-tocado";

/**
 * **O guarda do foco de teclado — item 94.**
 *
 * O catálogo chega do `shadcn add` com `outline-none` e anel de foco a 50%, e isso apaga o contorno que o
 * `@layer base` de `app/globals.css` declara (compromisso A-4: foco visível não removido). O defeito volta
 * em silêncio a cada componente novo, então a regra é de máquina, como a do ponteiro no `tema.test.ts`.
 *
 * `jsdom` porque os gráficos (critério 94.4) são renderizados aqui; as guardas de fonte não dependem dele.
 */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const UI = "src/interface/componentes/ui";
const COMPONENTES = "src/interface/componentes";

function ler(relativo: string): string {
  return readFileSync(join(RAIZ, relativo), "utf8");
}

/** Sem comentários de bloco (inclusive `{/* … *\/}`) e sem linhas `//`: prosa não conta como código. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
}

function arquivos(pasta: string): string[] {
  return readdirSync(join(RAIZ, pasta), { recursive: true, encoding: "utf8" })
    .filter((nome) => /\.tsx?$/u.test(nome))
    .map((nome) => `${pasta}/${nome.replaceAll("\\", "/")}`);
}

/** O anel fracionário sob variante de foco: `focus-visible:ring-ring/50`, `data-[active=true]:ring-marca/40`. */
function aneisFracionariosDeFoco(fonte: string): string[] {
  return semComentarios(fonte)
    .split(/[\s"'`]+/u)
    .filter((classe) => /:ring-[\w-]+\/(?:\d+|\[[\d.]+%\])$/u.test(classe))
    .filter((classe) => /focus|focused|active=true/u.test(classe.slice(0, classe.lastIndexOf(":"))));
}

const AVISO = "um `shadcn add` trouxe o foco do catálogo de volta";

describe("o contorno da base volta a valer — critérios 94.1, 94.2 e 94.3", () => {
  it("nenhum componente de ui/ apaga o contorno", () => {
    const culpados = arquivos(UI).filter((caminho) => /\boutline-(?:none|hidden)\b/u.test(semComentarios(ler(caminho))));
    expect(culpados, AVISO).toEqual([]);
  });

  it("nenhum componente desenha anel de foco em opacidade fracionária", () => {
    const culpados = arquivos(COMPONENTES).flatMap((caminho) =>
      aneisFracionariosDeFoco(ler(caminho)).map((classe) => `${caminho}: ${classe}`),
    );
    expect(culpados, AVISO).toEqual([]);
  });

  it("o halo de erro do 44g fica, porque não é foco (resposta à P3)", () => {
    expect(ler(`${UI}/input.tsx`)).toContain("aria-invalid:ring-destructive/[16%]");
  });

  it("a regra base do tema pinta o contorno em cor cheia", () => {
    const css = ler("app/globals.css");
    expect(css).toMatch(/@apply border-border outline-ring;/u);
    expect(css).not.toContain("outline-ring/50");
  });

  it("a linha clicável continua a exceção legítima, fora de ui/ (D-02)", () => {
    expect(ler(`${COMPONENTES}/linha-clicavel.ts`)).toContain("focus-visible:outline-none");
  });

  it("nenhuma peça de ui/ recolore a própria borda ao focar, porque o contorno já é a marca (critério 134.2)", () => {
    // O 94 manteve a borda recolorida (spec do 94, §4.1); o 134 a tira: com o contorno a 2 px de recuo,
    // eram duas linhas. No `input-otp` e no `calendar` o anel da casa e do envoltório é a marca, e fica.
    const RECOLORE = /\b(?:focus-visible|has-\[:focus-visible\]|data-\[active=true\]):border-ring\b/u;
    const culpados = arquivos(UI).filter((caminho) => RECOLORE.test(semComentarios(ler(caminho))));
    expect(culpados, AVISO).toEqual([]);
  });

  it("o input-otp e o calendar guardam o anel, que é a marca deles (critério 134.2)", () => {
    expect(semComentarios(ler(`${UI}/input-otp.tsx`))).toContain("data-[active=true]:ring-2 data-[active=true]:ring-ring");
    expect(semComentarios(ler(`${UI}/calendar.tsx`))).toContain("has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring");
  });
});

describe("a gaveta do celular — critério 94.7", () => {
  const sheet = semComentarios(ler(`${UI}/sheet.tsx`));
  const sidebar = semComentarios(ler(`${UI}/sidebar.tsx`));

  it("o X padrão é o botão de 44 px da casa, com nome em pt-BR", () => {
    expect(sheet).toMatch(/<SheetPrimitive\.Close asChild>\s*<Button[^>]*size="icon"[^>]*aria-label="Fechar"/su);
    expect(sheet).not.toContain(">Close<");
  });

  it("a gaveta deixa o X aparecer, e devolve o foco ao gatilho", () => {
    expect(sidebar).not.toContain("[&>button]:hidden");
    expect(sidebar).toMatch(
      /onCloseAutoFocus=\{\(evento\) => \{\s*evento\.preventDefault\(\);?\s*document\.querySelector<HTMLElement>\('\[data-sidebar="trigger"\]'\)\?\.focus\(\)/u,
    );
  });

  it("o gatilho diz se a gaveta está aberta, e qual ela é", () => {
    expect(sidebar).toContain("aria-expanded={isMobile ? openMobile : undefined}");
    expect(sidebar).toContain("aria-controls={isMobile ? ID_DA_GAVETA : undefined}");
    expect(sidebar).toMatch(/id=\{ID_DA_GAVETA\}/u);
  });

  it("o compartilhar reserva a faixa do X, que agora tem 44 px", () => {
    expect(semComentarios(ler(`${COMPONENTES}/compartilhamento-da-ocorrencia.tsx`))).toMatch(
      /<SheetHeader className="[^"]*pr-14/u,
    );
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("os sete gráficos não recebem foco — critério 94.4", () => {
  beforeAll(() => {
    // O `jsdom` não tem os dois; o Recharts e o `useIsMobile` pedem.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((consulta: string) => ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    /**
     * **O `jsdom` não faz leiaute, e devolve 0 × 0 em `getBoundingClientRect`.** O `ResponsiveContainer`
     * do Recharts 3 mede o contêiner no primeiro efeito e guarda o que leu
     * (`recharts/es6/component/ResponsiveContainer.js`); com zero ele **não renderiza o `svg`**, e o
     * teste do critério 94.4 mediria uma árvore vazia. A medida abaixo é a `initialDimension` de
     * `ui/chart.tsx`.
     */
    Element.prototype.getBoundingClientRect = function medida(this: Element): DOMRect {
      const caixa = { x: 0, y: 0, width: 320, height: 200, top: 0, left: 0, right: 320, bottom: 200 };
      return { ...caixa, toJSON: () => caixa } as DOMRect;
    };
  });

  const CASOS = [
    [
      "barras",
      createElement(GraficoDeBarras, {
        barras: [
          { chave: "a", rotulo: "Hidráulica", valor: 3, texto: "3" },
          { chave: "b", rotulo: "Elétrica", valor: 1, texto: "1" },
        ],
        larguraDoRotulo: 120,
      }),
    ],
    [
      "fluxo mensal",
      createElement(GraficoDoFluxoMensal, {
        linhas: [
          { mes: "2026-08", rotulo: "ago", parcial: false, registradas: 4, resolvidas: 2, canceladas: 1, saidas: 3, saldo: 1 },
          { mes: "2026-09", rotulo: "set", parcial: true, registradas: 2, resolvidas: 1, canceladas: 0, saidas: 1, saldo: 1 },
        ],
      }),
    ],
    [
      "tempo de resolução",
      createElement(GraficoDoTempoDeResolucao, {
        pontos: [
          { rotulo: "ago", mediana: 2, p90: 5 },
          { rotulo: "set", mediana: 3, p90: 6 },
        ],
        unidade: { divisor: 1, sufixo: "d" },
        pontas: { mediana: "3 dias", p90: "6 dias" },
      }),
    ],
  ] as const;

  for (const [nome, elemento] of CASOS) {
    it(`${nome}: nada focável dentro, e o contêiner segue aria-hidden`, async () => {
      const conteiner = document.createElement("div");
      document.body.append(conteiner);
      const raiz = createRoot(conteiner);
      await act(async () => raiz.render(elemento));
      expect(conteiner.querySelector("[aria-hidden]"), nome).not.toBeNull();
      expect(conteiner.querySelector("svg"), `${nome}: o Recharts não desenhou`).not.toBeNull();
      expect(conteiner.querySelectorAll('[tabindex="0"], [role="application"]'), nome).toHaveLength(0);
      act(() => raiz.unmount());
      conteiner.remove();
    });
  }

  it("os três desligam a camada à mão, e o comentário diz o padrão do Recharts 3", () => {
    for (const arquivo of ["grafico-de-barras", "grafico-do-fluxo-mensal", "grafico-do-tempo-de-resolucao"]) {
      const fonte = ler(`${COMPONENTES}/${arquivo}.tsx`);
      expect(semComentarios(fonte), arquivo).toContain("accessibilityLayer={false}");
      expect(fonte, arquivo).toMatch(/Recharts 3/u);
    }
  });
});

describe("a ordem de foco segue a vista — critérios 94.5 e 94.8", () => {
  it("a entrada de arquivo de T-04 sai da tabulação, e o rótulo continua ligado", () => {
    const foto = semComentarios(ler(`${COMPONENTES}/controle-de-foto.tsx`));
    expect(foto).toMatch(/<input\s+ref=\{entrada\}\s+id="foto"\s+type="file"[\s\S]*?tabIndex=\{-1\}/u);
    expect(foto).toContain('<label htmlFor="foto" className="sr-only">');
  });

  it("nenhum rodapé empilha ao contrário no celular (resposta à P2)", () => {
    for (const arquivo of [`${COMPONENTES}/campo.tsx`, `${UI}/dialog.tsx`, `${UI}/alert-dialog.tsx`]) {
      expect(semComentarios(ler(arquivo)), arquivo).not.toContain("flex-col-reverse");
    }
  });

  it("/organizacao/criar continua com o cartão primeiro no documento (resposta à P1)", () => {
    // Desde o item 103 a ordem mora em duas constantes que a moldura e a espera dividem: com o convite à
    // esquerda, o cartão vai para a terceira trilha só a partir de `lg`, e continua primeiro no documento.
    expect(ler(`${COMPONENTES}/moldura-de-conta.tsx`)).toContain(
      'const ORDEM_DO_CARTAO = { direita: "lg:order-1", esquerda: "lg:order-3" } as const;',
    );
  });
});

describe("o link de salto — critério 94.6", () => {
  it("aponta para o conteúdo, e só aparece com foco", async () => {
    const conteiner = document.createElement("div");
    document.body.append(conteiner);
    const raiz = createRoot(conteiner);
    await act(async () => raiz.render(createElement(PularParaOConteudo)));
    const link = conteiner.querySelector("a");
    expect(link?.textContent).toBe("Pular para o conteúdo");
    expect(link?.getAttribute("href")).toBe(`#${ID_DO_CONTEUDO}`);
    expect(link?.className).toMatch(/\bsr-only\b/u);
    expect(link?.className).toMatch(/\bfocus:not-sr-only\b/u);
    expect(link?.className).toMatch(/\bfocus:min-h-11\b/u);
    act(() => raiz.unmount());
    conteiner.remove();
  });

  it("é o primeiro elemento da casca, e o destino é o <main> sem contorno", () => {
    const casca = semComentarios(ler("app/(casca)/layout.tsx"));
    expect(casca).toMatch(/<SidebarProvider[^>]*>\s*<PularParaOConteudo \/>/u);
    expect(casca).toMatch(/<SidebarInset id=\{ID_DO_CONTEUDO\} tabIndex=\{-1\} className="[^"]*\boutline-none\b/u);
  });

  it("é o primeiro elemento da documentação, e o destino abre o artigo", () => {
    expect(semComentarios(ler("app/documentacao/layout.tsx"))).toMatch(
      /<RootProvider[\s\S]*?>\s*<PularParaOConteudo \/>\s*<DocsLayout/u,
    );
    expect(semComentarios(ler("app/documentacao/[[...slug]]/page.tsx"))).toMatch(
      /<div id=\{ID_DO_CONTEUDO\} tabIndex=\{-1\} className="outline-none">\s*<DocsTitle>/u,
    );
  });
});

describe("a documentação mostra o foco — critério 94.9", () => {
  const css = ler("app/documentacao/documentacao.css");
  const COPIAR = 'button[aria-label="Copiar o link desta seção"]';

  it("o botão de copiar aparece com foco, com foco no cabeçalho, e sempre no toque", () => {
    expect(css).toContain(`${COPIAR}:focus-visible`);
    expect(css).toContain(`:is(h1, h2, h3, h4, h5, h6):focus-within > ${COPIAR}`);
    expect(css.replace(/\r\n/gu, "\n")).toContain(`@media (hover: none) {\n  ${COPIAR} {\n    opacity: 1;`);
  });

  it("a moldura do Fumadocs devolve o contorno, e o gatilho do sumário o recebe por dentro", () => {
    expect(css).toMatch(/#nd-docs-layout :focus-visible [{]\s*outline: 2px solid var\(--accent\);\s*outline-offset: 2px;/u);
    expect(css).toMatch(/#nd-docs-layout \[data-toc-popover-trigger\]:focus-visible [{]\s*outline-offset: -2px;/u);
    expect(css.indexOf("#nd-docs-layout [data-toc-popover-trigger]")).toBeGreaterThan(css.indexOf("#nd-docs-layout :focus-visible"));
  });

  it("o nome do botão é o da tradução do projeto", () => {
    expect(ler("src/interface/documentacao/traducoes.ts")).toContain('"Copiar o link desta seção"');
  });
});

describe("o foco da recusa chega com a descrição pronta — critério 116.6", () => {
  function Formulario() {
    const formulario = useFormularioTocado({ campos: { titulo: "titulo" }, erros: { titulo: "Escreva o título." } });
    const erro = formulario.erroDe("titulo");
    return createElement(
      "form",
      { onSubmit: (evento: { preventDefault: () => void }) => { evento.preventDefault(); formulario.tentarEnviar(); } },
      createElement("input", { id: "titulo", "aria-describedby": erro === undefined ? undefined : "titulo-erro" }),
      erro === undefined ? null : createElement("p", { id: "titulo-erro" }, erro),
      createElement("button", { type: "submit" }, "Enviar"),
    );
  }

  it("no instante do foco, o campo já aponta para a mensagem, e ela existe", async () => {
    const elemento = document.createElement("div");
    document.body.append(elemento);
    const raiz = createRoot(elemento);
    await act(async () => raiz.render(createElement(Formulario)));

    let descricaoNoFoco: string | null = "não focou";
    let mensagemNoFoco = false;
    elemento.querySelector("#titulo")?.addEventListener("focus", (evento) => {
      descricaoNoFoco = (evento.target as HTMLElement).getAttribute("aria-describedby");
      mensagemNoFoco = document.getElementById("titulo-erro") !== null;
    });

    await act(async () => elemento.querySelector<HTMLButtonElement>("button")?.click());

    expect(descricaoNoFoco).toBe("titulo-erro");
    expect(mensagemNoFoco).toBe(true);
    await act(async () => raiz.unmount());
    elemento.remove();
  });
});

describe("a saída só conta depois de a pessoa agir — item 130", () => {
  /** Um grupo de dois rádios, o diálogo em volta, e fora dele o que o menu deixa aberto atrás. */
  function montarCena() {
    const dialogo = document.createElement("div");
    dialogo.setAttribute("role", "dialog");
    const grupo = document.createElement("fieldset");
    const primeiro = document.createElement("input");
    primeiro.type = "radio";
    const segundo = document.createElement("input");
    segundo.type = "radio";
    grupo.append(primeiro, segundo);
    const voltar = document.createElement("button");
    voltar.setAttribute(SAI_SEM_ACUSAR, "");
    const observacao = document.createElement("textarea");
    dialogo.append(grupo, observacao, voltar);
    const menuAtras = document.createElement("div");
    menuAtras.setAttribute("role", "menu");
    document.body.append(dialogo, menuAtras);
    return { dialogo, grupo, segundo, voltar, observacao, menuAtras };
  }

  it("antes do gesto, o foco que sai sem destino logo depois de a janela montar não conta (critério 130.4)", () => {
    const { grupo, dialogo, menuAtras } = montarCena();
    expect(saidaConta(grupo, null, false)).toBe(false);
    dialogo.remove();
    menuAtras.remove();
  });

  it("antes do gesto, o foco que vai para o menu deixado atrás também não conta (achado A1)", () => {
    const { grupo, dialogo, menuAtras } = montarCena();
    expect(saidaConta(grupo, menuAtras, false)).toBe(false);
    dialogo.remove();
    menuAtras.remove();
  });

  it("antes do gesto, nem o foco para o próximo campo conta", () => {
    const { grupo, observacao, dialogo, menuAtras } = montarCena();
    expect(saidaConta(grupo, observacao, false)).toBe(false);
    dialogo.remove();
    menuAtras.remove();
  });

  it("depois do gesto, o próximo campo conta, e o fundo da página também (a regra do 75)", () => {
    const { grupo, observacao, dialogo, menuAtras } = montarCena();
    expect(saidaConta(grupo, observacao, true)).toBe(true);
    expect(saidaConta(grupo, null, true)).toBe(true);
    dialogo.remove();
    menuAtras.remove();
  });

  it("depois do gesto, o vizinho do grupo e o botão de saída continuam não contando (critério 130.5)", () => {
    const { grupo, segundo, voltar, dialogo, menuAtras } = montarCena();
    expect(saidaConta(grupo, segundo, true)).toBe(false);
    expect(saidaConta(grupo, voltar, true)).toBe(false);
    dialogo.remove();
    menuAtras.remove();
  });
});

describe("o gesto, ligado ao gancho — item 130", () => {
  function Formulario({ aoMontar }: { aoMontar: (recomecar: () => void) => void }) {
    const formulario = useFormularioTocado({ campos: { motivo: "motivo" }, erros: { motivo: "Escolha o motivo." } });
    aoMontar(formulario.recomecar);
    const erro = formulario.erroDe("motivo");
    return createElement(
      "div",
      null,
      createElement("fieldset", { id: "motivo", onBlur: formulario.aoSair("motivo") }, createElement("input", { type: "radio", id: "primeiro" })),
      createElement("textarea", { id: "observacao" }),
      erro === undefined ? null : createElement("p", { id: "erro" }, erro),
    );
  }

  async function montar() {
    const elemento = document.createElement("div");
    document.body.append(elemento);
    const raiz = createRoot(elemento);
    let recomecar: () => void = () => undefined;
    await act(async () => raiz.render(createElement(Formulario, { aoMontar: (funcao) => { recomecar = funcao; } })));
    const sairDoGrupo = async () => {
      await act(async () => document.getElementById("primeiro")?.focus());
      await act(async () => document.getElementById("observacao")?.focus());
    };
    const desmontar = async () => {
      await act(async () => raiz.unmount());
      elemento.remove();
    };
    return { sairDoGrupo, recomecar: () => act(async () => recomecar()), desmontar };
  }

  const gesto = (tipo: "pointerdown" | "keydown") =>
    act(async () => {
      document.dispatchEvent(tipo === "keydown" ? new KeyboardEvent("keydown", { key: "Tab" }) : new Event("pointerdown"));
    });

  it("o foco que se move sozinho, sem gesto, não acende o erro", async () => {
    const cena = await montar();
    await cena.sairDoGrupo();
    expect(document.getElementById("erro")).toBeNull();
    await cena.desmontar();
  });

  it("depois de uma tecla, sair do grupo acende o erro (critério 130.3)", async () => {
    const cena = await montar();
    await gesto("keydown");
    await cena.sairDoGrupo();
    expect(document.getElementById("erro")?.textContent).toBe("Escolha o motivo.");
    await cena.desmontar();
  });

  it("depois de um toque, sair do grupo acende o erro", async () => {
    const cena = await montar();
    await gesto("pointerdown");
    await cena.sairDoGrupo();
    expect(document.getElementById("erro")?.textContent).toBe("Escolha o motivo.");
    await cena.desmontar();
  });

  it("o gesto que abre a janela não vale dentro dela: recomeçar zera o gesto", async () => {
    const cena = await montar();
    await gesto("keydown");
    await cena.recomecar();
    await cena.sairDoGrupo();
    expect(document.getElementById("erro")).toBeNull();
    await cena.desmontar();
  });

  it("desmontado, o gancho larga os dois ouvintes do documento", async () => {
    const remover = vi.spyOn(document, "removeEventListener");
    const cena = await montar();
    await cena.desmontar();
    const tipos = remover.mock.calls.map(([tipo]) => tipo);
    expect(tipos).toContain("pointerdown");
    expect(tipos).toContain("keydown");
    remover.mockRestore();
  });
});
