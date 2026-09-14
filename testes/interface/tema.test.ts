import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
});

/**
 * **A paleta categórica, medida — item 44e, critérios 3 e 4.**
 *
 * O gráfico de área empilhada de T-07 se liga a `var(--chart-1)` até `var(--chart-4)`, e quatro faixas
 * empilhadas só informam se o olho as separa. Os valores que o autor do tema escolheu não separavam:
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

      it("a quarta série lê como cinza, que é o que `Outras` precisa ser", () => {
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
