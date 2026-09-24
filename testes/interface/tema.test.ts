import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { INTEGRANTES, TOKEN_DA_COR } from "@/interface/componentes/integrantes-do-grupo";
import {
  atributoDoTema,
  cookieDoTema,
  SCRIPT_DO_TEMA,
  temaDoAtributo,
  temaDoCookie,
} from "@/interface/componentes/tema";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * **O guarda estrutural do tema.**
 *
 * Duas das exigências do item 44 não são de olho, e são exatamente as que se perdem em silêncio:
 *
 * 1. **Nenhum token pode ter definição única dentro de `@media` ou de `[data-theme]`.** Token que só
 *    exista lá dentro não se aplica no estado **não marcado** — que é o padrão de quem nunca escolheu
 *    tema. O defeito não aparece na máquina de quem implementa se ela estiver no escuro do sistema.
 * 2. **Os dois blocos escuros têm de ser idênticos.** Um está dentro de `@media` e o outro não, então
 *    **não há lista de seletores em CSS que os una** — a duplicação é estrutural e não tem saída. Se
 *    divergirem, *"escuro do sistema"* e *"escuro escolhido"* renderizam diferente, e nada percebe.
 *
 * É garantia mecânica em lugar de disciplina, como nas ADR-0001, 0003 e 0007 — aplicada à borda que ainda
 * não tinha. Na forma da ADR-0008 é **grupo 2**: não cresce com funcionalidade, cresce com token novo.
 */
/**
 * A folha **sem comentário nenhum**, e a poda não é higiene: é o que faz o guarda funcionar.
 *
 * Os blocos são achados por `indexOf` do seletor — e o cabeçalho que a Tarefa 2 escreve neste mesmo
 * arquivo **cita `:root[data-theme="dark"]` em prosa**, dezessete linhas antes do bloco de verdade. Com o
 * comentário no lugar, o `indexOf` para na citação, a contagem de chaves devolve o corpo do `:root`
 * **claro**, e o guarda passa a comparar o claro com o escuro achando que compara os dois escuros. Dois dos
 * cinco testes falham, e falham apontando para o lugar errado.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Devolve o corpo do bloco cujo seletor começa em `cabecalho`, contando chaves. */
function corpoDoBloco(cabecalho: string): string {
  const inicio = CSS.indexOf(cabecalho);
  if (inicio === -1) throw new Error(`Seletor não encontrado em app/globals.css: ${cabecalho}`);

  const abre = CSS.indexOf("{", inicio + cabecalho.length - 1);
  if (abre === -1) throw new Error(`Bloco sem abertura: ${cabecalho}`);

  let profundidade = 0;
  for (let i = abre; i < CSS.length; i += 1) {
    if (CSS[i] === "{") profundidade += 1;
    else if (CSS[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return CSS.slice(abre + 1, i);
    }
  }
  throw new Error(`Bloco sem fechamento: ${cabecalho}`);
}

/** Lê as declarações `--token: valor` de um corpo de bloco, com o espaço em branco normalizado. */
function tokensDe(corpo: string): Map<string, string> {
  const mapa = new Map<string, string>();

  // Sem poda de comentário aqui: ela já aconteceu em `CSS`, uma vez e para o arquivo inteiro.
  for (const pedaco of corpo.split(";")) {
    const encontrado = /(--[\w-]+)\s*:\s*([\s\S]+)/.exec(pedaco);
    const nome = encontrado?.[1];
    const valor = encontrado?.[2];
    if (nome !== undefined && valor !== undefined) {
      mapa.set(nome, valor.trim().replace(/\s+/g, " "));
    }
  }
  return mapa;
}

describe("app/globals.css — a estrutura de três estados", () => {
  const claro = tokensDe(corpoDoBloco(":root {"));
  const sistema = tokensDe(corpoDoBloco(':root:not([data-theme="light"])'));
  const escolhido = tokensDe(corpoDoBloco(':root[data-theme="dark"]'));

  it("acha e lê os três blocos", () => {
    // Sem isto, renomear um seletor faria TODAS as asserções abaixo passarem por vacuidade —
    // um mapa vazio satisfaz "nenhum token sem piso" e "os dois blocos são iguais".
    expect(claro.size).toBeGreaterThan(10);
    expect(sistema.size).toBeGreaterThan(10);
    expect(escolhido.size).toBeGreaterThan(10);
  });

  it("não tem token com definição única dentro de media ou de [data-theme]", () => {
    const semPisoNoClaro = [...sistema.keys(), ...escolhido.keys()]
      .filter((token) => !claro.has(token))
      .sort();

    expect(semPisoNoClaro).toEqual([]);
  });

  it("os dois blocos escuros declaram os mesmos tokens, com os mesmos valores", () => {
    expect(Object.fromEntries([...escolhido].sort())).toEqual(
      Object.fromEntries([...sistema].sort()),
    );
  });

  it("tipografia e raio são declarados uma vez, fora dos blocos escuros", () => {
    // O `.dark` do Meridian troca as TRÊS tipografias e o raio das bordas junto com a cor. É resíduo
    // do editor: ninguém decide que a tipografia e o cantinho dos botões mudam ao trocar o esquema de
    // cor — e o layout dele carrega só as três do claro, então no escuro o navegador cairia no que
    // houvesse. Só cor muda.
    for (const token of ["--font-sans", "--radius"]) {
      expect(claro.has(token)).toBe(true);
      expect(sistema.has(token)).toBe(false);
      expect(escolhido.has(token)).toBe(false);
    }
  });

  it("não declara a família serifada, que o produto não carrega", () => {
    // O Meridian traz três. A serifada não tem consumidor nenhum, e declará-la aqui convida a
    // carregá-la — cada família pesa no build.
    for (const mapa of [claro, sistema, escolhido]) {
      expect(mapa.has("--font-serif")).toBe(false);
    }
  });

  it("a monoespaçada é declarada uma vez, fora dos blocos escuros", () => {
    // A `Geist Mono` passou a ser carregada em 13/09/2026 (resposta P1 do item 44b): a trilha de
    // auditoria tem oito usos de `font-mono`, e o guia dá à monoespaçada o sétimo papel da escala.
    // Ela é tipografia, então segue a regra de `--font-sans`: só cor muda entre claro e escuro.
    expect(claro.has("--font-mono")).toBe(true);
    expect(sistema.has("--font-mono")).toBe(false);
    expect(escolhido.has("--font-mono")).toBe(false);
  });

  it("a tinta da marca é declarada uma vez, fora dos blocos escuros", () => {
    // `--accent` é laranja de meia-luz nos DOIS temas — 0.6031 no claro, 0.6940 no escuro —, então os
    // dois querem tinta escura por cima. Um token que invertesse daria branco sobre laranja no claro,
    // que mede 4,07:1. Este mede 4,61:1 no claro e 6,64:1 no escuro. Item 44d, critério 8.
    expect(claro.has("--marca-foreground")).toBe(true);
    expect(sistema.has("--marca-foreground")).toBe(false);
    expect(escolhido.has("--marca-foreground")).toBe(false);
  });

  it("os oito tokens da barra lateral seguem o vocabulário, e por isso não se repetem no escuro", () => {
    // Item 44f, critério 7. Eles vieram do autor do tema Meridian e nunca foram escolhidos por nós:
    // `--sidebar` era mais escuro que `--ground` nos dois temas, e `--sidebar-primary` era azul (matiz
    // 255) num produto de marca laranja. Como fiação — `var(…)` — eles herdam o escuro de graça, que é o
    // mesmo regime de `--background` e `--border`.
    const OITO = [
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
    ] as const;

    for (const token of OITO) {
      expect(claro.get(token)).toMatch(/^var\(--[\w-]+\)$/u);
      expect(sistema.has(token)).toBe(false);
      expect(escolhido.has(token)).toBe(false);
    }
  });

  it("a barra lateral é o chão da página, e o realce dela é a marca", () => {
    // Guia §1: "onde a tentação for pôr uma caixa, ponha uma pauta". Um trilho com preenchimento próprio
    // é a primeira caixa da tela, e a lateral já foi validada sem ele em 14/09/2026.
    expect(claro.get("--sidebar")).toBe("var(--ground)");
    expect(claro.get("--sidebar-border")).toBe("var(--line)");
    expect(claro.get("--sidebar-primary")).toBe("var(--accent)");
  });
});

describe("o `cn` conhece os sete papéis da escala — item 44d", () => {
  it("não deixa um papel da escala apagar a cor da tinta", () => {
    // Sem `extendTailwindMerge`, `text-interface` era lido como COR e derrubava
    // `text-marca-foreground`, deixando o botão principal sem a tinta pensada para o laranja — e com o
    // `text-sm` do catálogo, que está fora da escala. Os dois avessos do que se queria.
    expect(cn("bg-marca text-marca-foreground text-sm", "text-interface")).toBe(
      "bg-marca text-marca-foreground text-interface",
    );
  });

  it("um papel da escala ainda substitui outro", () => {
    expect(cn("text-corpo", "text-meta")).toBe("text-meta");
  });

  it("conhece o oitavo papel, nas duas direções (item 44q, critério 3)", () => {
    // Sem a extensão, `text-rotulo-peca` cairia no grupo de COR e apagaria a tinta do selo — o mesmo
    // defeito que o 44d achou com `text-interface`.
    expect(cn("text-tinta text-xs", "text-rotulo-peca")).toBe("text-tinta text-rotulo-peca");
    expect(cn("text-rotulo-peca", "text-meta")).toBe("text-meta");
  });
});

describe("app/globals.css — os oito papéis carregam o papel inteiro (item 44q, critério 1)", () => {
  /** O `@theme inline` não é bloco de `:root`, então é lido pelo próprio seletor. */
  const tema = tokensDe(corpoDoBloco("@theme inline {"));
  const raiz = tokensDe(corpoDoBloco(":root {"));

  const PAPEIS = {
    "titulo-pagina": { tamanho: "1.625rem", entrelinha: "1.9375rem", peso: "600", entreletra: "-0.021em" },
    "titulo-bloco": { tamanho: "1.1875rem", entrelinha: "1.5625rem", peso: "600", entreletra: "-0.012em" },
    "titulo-linha": { tamanho: "0.9375rem", entrelinha: "1.3125rem", peso: "500", entreletra: null },
    corpo: { tamanho: "0.90625rem", entrelinha: "1.375rem", peso: "400", entreletra: null },
    interface: { tamanho: "0.84375rem", entrelinha: "1.1875rem", peso: "400", entreletra: null },
    meta: { tamanho: "0.78125rem", entrelinha: "1.0625rem", peso: "400", entreletra: null },
    "rotulo-coluna": { tamanho: "0.625rem", entrelinha: null, peso: "500", entreletra: "0.11em" },
    "rotulo-peca": { tamanho: "0.71875rem", entrelinha: "1.0625rem", peso: "600", entreletra: "0.02em" },
  } as const;

  it("são oito, e nenhum outro `--texto-` existe", () => {
    const tamanhos = [...raiz.keys()].filter((token) => /^--texto-[\w-]+$/u.test(token)).sort();
    expect(tamanhos).toStrictEqual(Object.keys(PAPEIS).map((papel) => `--texto-${papel}`).sort());
  });

  for (const [papel, esperado] of Object.entries(PAPEIS)) {
    it(`${papel}: tamanho, entrelinha, peso e entreletra chegam ao utilitário`, () => {
      expect(raiz.get(`--texto-${papel}`)).toBe(esperado.tamanho);
      expect(tema.get(`--text-${papel}`)).toBe(`var(--texto-${papel})`);
      expect(tema.get(`--text-${papel}--font-weight`)).toBe(esperado.peso);
      expect(tema.get(`--text-${papel}--line-height`)).toBe(esperado.entrelinha ?? undefined);
      expect(tema.get(`--text-${papel}--letter-spacing`)).toBe(esperado.entreletra ?? undefined);
    });
  }
});

/**
 * **A paleta categórica, medida — item 44e, critérios 3 e 4.**
 *
 * O gráfico de T-07 se liga a `var(--chart-1)` e `var(--chart-2)` desde o item 57, e duas séries num
 * mesmo desenho só informam se o olho as separa. **Os quatro continuam medidos**, porque a paleta é
 * inventário do tema e não do consumidor do dia. Os valores que o autor do tema escolheu não separavam:
 * `--chart-3` tinha croma 0,0599 no escuro, abaixo do piso categórico, e ficava a 5,17° de matiz de
 * `--chart-1` — a mesma cor em duas luminosidades.
 *
 * **O piso, nunca o dígito.** As asserções afirmam o que o item promete — croma acima do piso, separação
 * perceptual, contraste com a superfície —, e não o número medido: `toBe(9.21)` reprovaria por
 * arredondamento na próxima vez que alguém trocasse a ordem das conversões. Os números medidos saem
 * impressos, para o relatório do item copiar deles.
 *
 * Na forma da ADR-0008 é **grupo 2**: não cresce com funcionalidade, cresce com token novo.
 */
type Lab = { L: number; a: number; b: number };

/** `oklch(L C H)` como o CSS o escreve, em OKLab. Fora disso o teste não sabe ler, e diz. */
function oklabDe(valor: string): Lab {
  const encontrado = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(valor);
  if (encontrado === null) throw new Error(`Não é um oklch legível: ${valor}`);

  const L = Number(encontrado[1]);
  const C = Number(encontrado[2]);
  const H = (Number(encontrado[3]) * Math.PI) / 180;
  return { L, a: C * Math.cos(H), b: C * Math.sin(H) };
}

/** O croma é o raio do par (a, b) — a distância do eixo acromático. */
function croma({ a, b }: Lab): number {
  return Math.hypot(a, b);
}

/** Distância euclidiana em OKLab: é para isso que o espaço foi construído. */
function deltaEok(um: Lab, outro: Lab): number {
  return Math.hypot(um.L - outro.L, um.a - outro.a, um.b - outro.b);
}

/** OKLab → LMS → sRGB linear. O recorte em [0, 1] é o gamut, e é o que a tela mostraria. */
function sRGBLinearDe({ L, a, b }: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const recortar = (canal: number): number => Math.min(1, Math.max(0, canal));
  return [
    recortar(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    recortar(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    recortar(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** O hex que o navegador pintaria, para a tabela do relatório. */
function hexDe(cor: Lab): string {
  const gama = (canal: number): number =>
    canal <= 0.0031308 ? 12.92 * canal : 1.055 * canal ** (1 / 2.4) - 0.055;

  return `#${sRGBLinearDe(cor)
    .map((canal) => Math.round(gama(canal) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Luminância relativa da WCAG, que já pede sRGB linear — o mesmo que a conversão acima devolve. */
function luminancia(cor: Lab): number {
  const [r, g, b] = sRGBLinearDe(cor);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste da WCAG entre duas cores, na ordem que der: a fórmula ordena sozinha. */
function contraste(uma: Lab, outra: Lab): number {
  const [clara, escura] = [luminancia(uma), luminancia(outra)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (clara + 0.05) / (escura + 0.05);
}

describe("app/globals.css — a paleta categórica de T-07, medida", () => {
  const SERIES = ["--chart-1", "--chart-2", "--chart-3", "--chart-4"] as const;

  /** Lê os quatro tokens de série e a superfície do mesmo bloco — do CSS, nunca escritos à mão. */
  function paletaDe(cabecalho: string): { series: Lab[]; superficie: Lab } {
    const tokens = tokensDe(corpoDoBloco(cabecalho));
    const valorDe = (token: string): string => {
      const valor = tokens.get(token);
      if (valor === undefined) throw new Error(`${token} não está declarado em ${cabecalho}`);
      return valor;
    };

    return {
      series: SERIES.map((token) => oklabDe(valorDe(token))),
      // A superfície do cartão é `--surface`. O nome em português mora no `@theme inline`, fora dos
      // blocos que o `corpoDoBloco` lê, e vale `var(--surface)` — sem `oklch` para converter.
      superficie: oklabDe(valorDe("--surface")),
    };
  }

  const MODOS = [
    { nome: "claro", cabecalho: ":root {" },
    { nome: "escuro", cabecalho: ':root[data-theme="dark"]' },
  ] as const;

  it("imprime a medição, que é o que o relatório do item copia", () => {
    for (const { nome, cabecalho } of MODOS) {
      const { series, superficie } = paletaDe(cabecalho);

      console.info(`\n[44e] paleta categórica — modo ${nome}, superfície ${hexDe(superficie)}`);
      series.forEach((cor, indice) => {
        console.info(
          `  ${SERIES[indice]}  ${hexDe(cor)}  croma ${croma(cor).toFixed(4)}  ` +
            `contraste ${contraste(cor, superficie).toFixed(2)}:1`,
        );
      });

      for (let i = 0; i < series.length; i += 1) {
        for (let j = i + 1; j < series.length; j += 1) {
          const um = series[i] as Lab;
          const outro = series[j] as Lab;
          console.info(`  ΔEok ${i + 1} × ${j + 1}  ${deltaEok(um, outro).toFixed(3)}`);
        }
      }
    }

    expect(SERIES).toHaveLength(4);
  });

  for (const { nome, cabecalho } of MODOS) {
    describe(`modo ${nome}`, () => {
      it("as três séries nomeadas têm croma de categoria, e não leem como cinza", () => {
        const { series } = paletaDe(cabecalho);
        for (const cor of series.slice(0, 3)) {
          expect(croma(cor)).toBeGreaterThanOrEqual(0.1);
        }
      });

      it("a quarta série lê como cinza, que é o que uma série de resto precisa ser", () => {
        const { series } = paletaDe(cabecalho);
        const cinza = series[3] as Lab;
        expect(croma(cinza)).toBeLessThanOrEqual(0.02);
      });

      it("os seis pares se separam perceptualmente", () => {
        // Croma baixo sozinho não resolve o cinza: na mesma faixa de luminosidade das três coloridas
        // ele fica a ΔEok 0,117 do azul no escuro. O que o separa é a luminosidade, na direção da
        // tinta do modo — mais claro que as três no escuro, mais escuro no claro.
        const { series } = paletaDe(cabecalho);
        for (let i = 0; i < series.length; i += 1) {
          for (let j = i + 1; j < series.length; j += 1) {
            const um = series[i] as Lab;
            const outro = series[j] as Lab;
            expect(deltaEok(um, outro)).toBeGreaterThanOrEqual(0.15);
          }
        }
      });

      it("cada série contrasta com a superfície do próprio modo", () => {
        // 3:1 é o piso de objeto gráfico da WCAG 1.4.11 — faixa de área é objeto, não texto.
        const { series, superficie } = paletaDe(cabecalho);
        for (const cor of series) {
          expect(contraste(cor, superficie)).toBeGreaterThanOrEqual(3);
        }
      });
    });
  }
});

/**
 * **As cores dos seis estados, medidas — item 44q, critérios 10 e 11.**
 *
 * O selo aparece sobre três fundos: `--surface` no cartão, `--ground` na linha zebrada de T-03 e
 * `--sunken` no apagado. Texto sobre fundo pede 4,5:1, e a asserção usa o **pior** dos três — o selo
 * em linha zebrada é o caso que ninguém testaria de propósito.
 *
 * **`--ink-faint` sobre `--sunken` reprova** (2,57:1 no escuro), e é por isso que *Cancelada* e
 * *Inativa* usam `--ink-soft` (desvio D1 do plano do 44q).
 */
describe("app/globals.css — as cores dos seis estados, medidas (item 44q)", () => {
  const MODOS = [
    { nome: "claro", cabecalho: ":root {" },
    { nome: "escuro", cabecalho: ':root[data-theme="dark"]' },
  ] as const;

  const claro = tokensDe(corpoDoBloco(":root {"));

  for (const { nome, cabecalho } of MODOS) {
    describe(`modo ${nome}`, () => {
      const bloco = tokensDe(corpoDoBloco(cabecalho));
      /** O token do modo, e o do claro quando o modo não o redeclara — é a cascata. */
      const cor = (token: string): Lab => {
        const valor = bloco.get(token) ?? claro.get(token);
        if (valor === undefined) throw new Error(`${token} não está declarado`);
        return oklabDe(valor);
      };
      const fundos = ["--surface", "--ground", "--sunken"].map(cor);
      const piorFundo = (tinta: Lab): number => Math.min(...fundos.map((fundo) => contraste(tinta, fundo)));

      it("imprime a medição, que é o que o relatório do item copia", () => {
        for (const token of ["--ok", "--info", "--ink-soft", "--ink-faint"]) {
          console.info(`[44q] ${nome} ${token} ${hexDe(cor(token))} pior fundo ${piorFundo(cor(token)).toFixed(2)}:1`);
        }
      });

      it("o texto de sucesso, de informação e o neutro passam em qualquer dos três fundos", () => {
        for (const token of ["--ok", "--info", "--ink-soft"]) {
          expect(piorFundo(cor(token)), token).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("a tinta escura passa sobre o sólido de marca e sobre o de atenção", () => {
        expect(contraste(cor("--marca-foreground"), cor("--accent"))).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cor("--marca-foreground"), cor("--atencao"))).toBeGreaterThanOrEqual(4.5);
      });

      it("a borda de todo contorno passa 3:1 contra a superfície (spec §3.11)", () => {
        // Em análise (`--ink-soft`), Em atendimento (`--info`) e Ativa (`--ok`, cheio — desvio D6: a 55%
        // da prancheta mede 2,34:1 no claro e 2,50:1 no escuro).
        for (const token of ["--ink-soft", "--info", "--ok"]) {
          expect(contraste(cor(token), cor("--surface")), token).toBeGreaterThanOrEqual(3);
        }
      });

      it("a tinta fraca reprova no apagado, e é por isso que ele não a usa", () => {
        expect(contraste(cor("--ink-faint"), cor("--sunken"))).toBeLessThan(4.5);
      });
    });
  }

  it("o `--atencao` é declarado uma vez, porque é fundo com tinta escura nos dois temas", () => {
    expect(claro.has("--atencao")).toBe(true);
    expect(tokensDe(corpoDoBloco(':root[data-theme="dark"]')).has("--atencao")).toBe(false);
  });
});

/**
 * **O avatar da página do grupo, medido — item 70, critério 2 e resposta P2 da spec.**
 *
 * A inicial é texto, e texto pede 4,5:1 contra o que está atrás dele. Na forma `clara` o que está atrás é
 * a cor a 12% **composta sobre `--surface`**, que é o fundo do cartão: o `bg-ok/12` do Tailwind vira
 * `color-mix(in oklab, … 12%, transparent)`, e o navegador compõe a transparência em sRGB com gama. Na
 * forma `cheia` é a cor inteira, com `--marca-foreground` por cima.
 *
 * **A forma é declarada por tema no dado**, e este teste é quem a decide: o `--ok` reprova na clara no
 * escuro e na cheia no claro, e só passa com uma forma em cada tema.
 */
describe("app/globals.css — o avatar da página do grupo, medido (item 70)", () => {
  const claro = tokensDe(corpoDoBloco(":root {"));
  const MODOS = [
    { nome: "claro", cabecalho: ":root {" },
    { nome: "escuro", cabecalho: ':root[data-theme="dark"]' },
  ] as const;

  const gama = (canal: number): number =>
    canal <= 0.0031308 ? 12.92 * canal : 1.055 * canal ** (1 / 2.4) - 0.055;
  const semGama = (canal: number): number =>
    canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;

  /** A luminância da cor com alfa composta sobre o fundo, como o navegador pinta. */
  function luminanciaComposta(cor: Lab, fundo: Lab, alfa: number): number {
    const frente = sRGBLinearDe(cor).map(gama);
    const atras = sRGBLinearDe(fundo).map(gama);
    const [r, g, b] = frente.map((canal, i) => semGama(canal * alfa + (atras[i] as number) * (1 - alfa))) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const razao = (uma: number, outra: number): number =>
    (Math.max(uma, outra) + 0.05) / (Math.min(uma, outra) + 0.05);

  for (const { nome, cabecalho } of MODOS) {
    describe(`modo ${nome}`, () => {
      const bloco = tokensDe(corpoDoBloco(cabecalho));
      const cor = (token: string): Lab => {
        const valor = bloco.get(token) ?? claro.get(token);
        if (valor === undefined) throw new Error(`${token} não está declarado`);
        return oklabDe(valor);
      };

      for (const integrante of INTEGRANTES) {
        const forma = integrante.forma[nome];
        it(`${integrante.nome}: a inicial passa 4,5:1 na forma ${forma}`, () => {
          const propria = cor(TOKEN_DA_COR[integrante.cor]);
          const tinta = forma === "clara" ? propria : cor("--marca-foreground");
          const fundo =
            forma === "clara" ? luminanciaComposta(propria, cor("--surface"), 0.12) : luminancia(propria);
          const medido = razao(luminancia(tinta), fundo);
          console.info(`[70] ${nome} ${integrante.nome} ${forma} ${hexDe(propria)} ${medido.toFixed(2)}:1`);
          expect(medido).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }
});

/**
 * **O ponteiro dos elementos pressionáveis — item 44f, critério 2.**
 *
 * O Tailwind 4 não dá `cursor: pointer` a `<button>` e nenhum `cva` do catálogo o declara, então até
 * 14/09/2026 todo botão do produto mostrava a seta. **A correção não pode ser por componente:** o próximo
 * `shadcn add` escreve um `cva` novo sem a classe, e o defeito volta sem que nada reprove. A regra vive no
 * `@layer base`, uma vez, e este guarda é o que a mantém lá.
 */
describe("app/globals.css — o ponteiro dos elementos pressionáveis", () => {
  const base = corpoDoBloco("@layer base");
  const PASTA_UI = fileURLToPath(new URL("../../src/interface/componentes/ui/", import.meta.url));

  /**
   * Os arquivos do catálogo **sem comentário de bloco**, e a poda é a mesma de `CSS` acima, pela mesma
   * razão: a pergunta é *"algum componente declara a classe?"*, e comentário não declara nada. O
   * cabeçalho de divergência que `dropdown-menu.tsx` e `select.tsx` passaram a ter **cita a classe pelo
   * nome** — é o que torna o cabeçalho útil ao próximo `shadcn add` —, e sem a poda ele se acusaria.
   */
  function componentesQueDeclaram(classe: string): string[] {
    return readdirSync(PASTA_UI)
      .filter((arquivo) => arquivo.endsWith(".tsx"))
      .filter((arquivo) =>
        readFileSync(PASTA_UI + arquivo, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .includes(classe),
      )
      .sort();
  }

  it("declara `cursor: pointer` uma vez só, e no @layer base", () => {
    expect(base.match(/cursor:\s*pointer/gu) ?? []).toHaveLength(1);
    expect(CSS.match(/cursor:\s*pointer/gu) ?? []).toHaveLength(1);
  });

  it("a regra alcança o elemento e os três papéis que o Radix desenha em `div`", () => {
    // `DropdownMenuItem` é `<div role="menuitem">` quando não recebe `asChild`, e `SelectItem` é sempre
    // `<div role="option">`: sem estes dois seletores, toda opção de `select` e todo item de menu que não
    // envolva um botão continuariam com a seta.
    const regra = /([^{}]*)\{[^{}]*cursor:\s*pointer[^{}]*\}/u.exec(base)?.[1] ?? "";
    for (const alvo of ["button", '[role="button"]', '[role="menuitem"]', '[role="option"]']) {
      expect(regra).toContain(alvo);
    }
  });

  it("nenhum componente do catálogo declara o ponteiro por conta própria", () => {
    expect(componentesQueDeclaram("cursor-pointer")).toEqual([]);
  });

  it("nenhum componente do catálogo declara `cursor-default`, que venceria a regra pela camada", () => {
    // **A regra vive no `@layer base` e `cursor-default` é utilitário**, que o Tailwind emite no
    // `@layer utilities` — camada declarada depois, e camada posterior vence sem olhar especificidade.
    // `dropdown-menu.tsx` e `select.tsx` declaravam a classe em sete lugares, entre eles os dois alvos
    // que a regra existe para alcançar: o item do menu de pessoa e a opção do seletor de organização.
    // A classe também não descrevia nada — `default` é o valor inicial de `cursor` nesses elementos.
    expect(componentesQueDeclaram("cursor-default")).toEqual([]);
  });
});

/**
 * **Item 72 — o escuro como padrão, e a escolha em cookie.**
 *
 * Duas cópias da mesma regra existem, e é por isso que este bloco existe: `temaDoCookie` roda no
 * componente, e `SCRIPT_DO_TEMA` roda **antes do React**, como texto dentro do `<head>`. O script não
 * pode importar a função, então a garantia de que as duas dizem a mesma coisa é esta tabela, aplicada às
 * duas.
 */
describe("o tema do produto — item 72", () => {
  const CASOS: ReadonlyArray<[string, "claro" | "escuro"]> = [
    ["", "escuro"],
    ["tema=claro", "claro"],
    ["tema=escuro", "escuro"],
    ["organizacao=abc; tema=claro", "claro"],
    ["tema=claro; organizacao=abc", "claro"],
    ["xtema=claro", "escuro"],
    ["outro_tema=claro", "escuro"],
    ["tema=CLARO", "escuro"],
    ["tema=claroX", "escuro"],
    ["tema=", "escuro"],
  ];

  /** Roda o script contra um documento de mentira e devolve o `data-theme` que ficou. */
  function rodarOScript(cookie: string | (() => never)): string {
    let atributo = "dark";
    const documento = {
      get cookie() {
        return typeof cookie === "function" ? cookie() : cookie;
      },
      documentElement: {
        setAttribute(nome: string, valor: string) {
          if (nome === "data-theme") atributo = valor;
        },
      },
    };
    new Function("document", SCRIPT_DO_TEMA)(documento);
    return atributo;
  }

  it.each(CASOS)("o cookie «%s» dá %s, na função e no script", (cookie, esperado) => {
    expect(temaDoCookie(cookie)).toBe(esperado);
    expect(rodarOScript(cookie)).toBe(atributoDoTema(esperado));
  });

  it("o script não quebra quando o cookie é inacessível, e deixa escuro", () => {
    expect(
      rodarOScript(() => {
        throw new Error("SecurityError");
      }),
    ).toBe("dark");
  });

  it("o atributo volta a tema, e só `light` é claro", () => {
    expect(temaDoAtributo("light")).toBe("claro");
    expect(temaDoAtributo("dark")).toBe("escuro");
    expect(temaDoAtributo(null)).toBe("escuro");
  });

  it("o cookie gravado dura um ano, vale no site todo e não leva `Secure`", () => {
    const gravado = cookieDoTema("claro");
    expect(gravado).toBe("tema=claro; path=/; max-age=31536000; samesite=lax");
    // Sem `Secure`: o Chromium o descarta sobre `http://` em host que não é loopback (achado A-10).
    expect(gravado.toLowerCase()).not.toContain("secure");
    expect(temaDoCookie(cookieDoTema("escuro").split(";")[0] ?? "")).toBe("escuro");
  });
});
