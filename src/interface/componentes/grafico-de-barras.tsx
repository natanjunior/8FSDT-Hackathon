"use client";

import { Bar, BarChart, LabelList, Rectangle, XAxis, YAxis, type RectangleProps } from "recharts";

import { ChartContainer, type ChartConfig } from "@/interface/componentes/ui/chart";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

/**
 * ============================================================================
 *  A barra horizontal de T-07 — cinco quadros, uma peça
 * ============================================================================
 *
 * **Bar horizontal do catálogo, com `LabelList`** (item 73): a idade, o que está voltando, a categoria, o
 * status e as notas. Toda barra é `--chart-4`, o cinza medido da paleta, **nenhuma cor semântica**, e o
 * valor vem escrito à direita de cada barra, então a comparação não depende de ler comprimento. **Não é
 * `--chart-1`** (item 105): o laranja da série tem a matiz da marca, e vinte barras dele faziam da cor da
 * ação uma textura. O `--chart-1` fica nas duas linhas, onde precisa de identidade contra o `--chart-2`.
 *
 * **O que o Recharts 3 cobra, e a validação já mediu:** o `layout="vertical"` fica no `BarChart` e **não se
 * repete no `<Bar>`**, que é quebra documentada da v3; o eixo de valor é `XAxis type="number" hide`; e o
 * `ChartContainer` precisa de altura explícita, senão nasce com zero. A altura sai do número de linhas,
 * para que quatro faixas e seis status tenham barras da mesma espessura.
 *
 * **A barra de valor zero não desenha retângulo, e o `LabelList` continua escrevendo `0`**: é o 59.2, a
 * estrutura aparecendo mesmo a zero. **O `shape` próprio é o que garante isso**, e não é enfeite: o
 * Recharts 3 descarta a barra de dimensão zero antes do rótulo, a menos que ela tenha forma própria
 * (`cartesian/Bar.js`, *"Filter out 0-dimension rectangles early"*). A forma é o `Rectangle` de sempre,
 * que não desenha nada com largura zero; o rótulo fica. Medido na captura de 24/09/2026: sem ela,
 * *Vazamentos*, *Nota 2* e *Nota 1* apareciam sem número.
 *
 * **A lista para leitor de tela existe porque o SVG é `aria-hidden`.** Sem ela, quem não vê chegaria ao
 * quadro e ouviria só o título. Ela sai do **mesmo** array das barras, e por isso as duas não discordam.
 * O quadro que tem `Ver dados` a dispensa (`listaParaLeitor={false}`): a tabela do modal é a alternativa
 * textual dele.
 *
 * **`accessibilityLayer={false}` escrito à mão**, pela razão de `grafico-do-fluxo-mensal.tsx`: no
 * Recharts 3 a camada vem ligada e torna o `svg` focável, e foco dentro de `aria-hidden` é defeito.
 * **Animação desligada**, porque o ponta a ponta lê rótulos.
 */

export type BarraDoGrafico = {
  chave: string;
  rotulo: string;
  /** Segunda linha do rótulo, embaixo. Só a dupla usa: área em cima, categoria embaixo. */
  rotuloDeBaixo?: string;
  valor: number;
  /** O que o `LabelList` escreve à direita da barra. */
  texto: string;
};

const CONFIGURACAO: ChartConfig = { valor: { label: "Quantidade", color: "var(--chart-4)" } };
const ALTURA_DA_LINHA = 36;
const ALTURA_DA_BARRA = 22;
/** Largura média de um caractere do papel `meta`, em px — é o que reserva a margem do texto de valor. */
const LARGURA_DO_CARACTERE = 6.2;
/**
 * O teto da coluna de rótulos no celular. Com os 176 px da categoria e a margem do texto de valor, o
 * quadro 5 a 390 px ficava sem largura nenhuma para a barra (captura de 24/09/2026); o rótulo quebra em
 * mais linhas, e a barra aparece.
 */
const ROTULO_NO_CELULAR = 96;

export function GraficoDeBarras({
  barras,
  larguraDoRotulo,
  listaParaLeitor = true,
}: {
  barras: readonly BarraDoGrafico[];
  /** Largura da coluna de rótulos, em px. */
  larguraDoRotulo: number;
  /** Sem `Ver dados`, o quadro precisa da lista para leitor de tela. Padrão: `true`. */
  listaParaLeitor?: boolean;
}) {
  const celular = useIsMobile();
  const maiorTexto = Math.max(...barras.map((barra) => barra.texto.length), 1);
  const temDuasLinhas = barras.some((barra) => barra.rotuloDeBaixo !== undefined);
  // O rótulo em duas linhas é SVG sem quebra, e cortá-lo é o que ele existe para evitar: fica fora do teto.
  const larguraDaColuna =
    celular && !temDuasLinhas ? Math.min(larguraDoRotulo, ROTULO_NO_CELULAR) : larguraDoRotulo;
  const alturaDaLinha = temDuasLinhas ? ALTURA_DA_LINHA + 12 : ALTURA_DA_LINHA;

  return (
    <>
      <ChartContainer
        aria-hidden
        config={CONFIGURACAO}
        style={{ height: barras.length * alturaDaLinha + 8 }}
        className="aspect-auto w-full [&_.recharts-cartesian-axis-tick_text]:text-meta"
      >
        <BarChart
          accessibilityLayer={false}
          data={[...barras]}
          layout="vertical"
          margin={{ top: 4, right: maiorTexto * LARGURA_DO_CARACTERE + 16, bottom: 4, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={larguraDaColuna}
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={
              temDuasLinhas
                ? (props: { x: number | string; y: number | string; index: number }) => (
                    <RotuloEmDuasLinhas x={props.x} y={props.y} barra={barras[props.index]} />
                  )
                : true
            }
          />
          <Bar
            dataKey="valor"
            fill="var(--color-valor)"
            radius={4}
            barSize={ALTURA_DA_BARRA}
            isAnimationActive={false}
            shape={(props: RectangleProps) => <Rectangle {...props} radius={4} />}
          >
            <LabelList
              dataKey="texto"
              position="right"
              offset={8}
              className="fill-tinta-suave text-meta"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      {listaParaLeitor ? (
        <ul className="sr-only">
          {barras.map((barra) => (
            <li key={barra.chave}>
              <span>
                {barra.rotuloDeBaixo === undefined
                  ? barra.rotulo
                  : `${barra.rotulo} · ${barra.rotuloDeBaixo}`}
              </span>{" "}
              <span>{barra.texto}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/**
 * **O rótulo em duas linhas, área em cima e categoria embaixo.** O eixo de categoria do Recharts trunca,
 * e a spec do 60 recusou o `Medidor` justamente por truncar: cortar o rótulo da dupla cortaria a metade
 * que o quadro existe para mostrar.
 */
function RotuloEmDuasLinhas({
  x,
  y,
  barra,
}: {
  x: number | string;
  y: number | string;
  barra: BarraDoGrafico | undefined;
}) {
  if (barra === undefined) return null;
  return (
    <text x={Number(x)} y={Number(y)} textAnchor="end" className="text-meta">
      <tspan x={Number(x) - 4} dy={-6} className="fill-tinta">
        {barra.rotulo}
      </tspan>
      <tspan x={Number(x) - 4} dy={14} className="fill-tinta-suave">
        {barra.rotuloDeBaixo}
      </tspan>
    </text>
  );
}
