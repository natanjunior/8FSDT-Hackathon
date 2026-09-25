"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/interface/componentes/ui/chart";

/**
 * ============================================================================
 *  A barra horizontal de T-07 — cinco quadros, uma peça
 * ============================================================================
 *
 * **Bar horizontal do catálogo, com `LabelList`** (item 73): a idade, o que está voltando, a categoria, o
 * status e as notas. Toda barra é `--chart-1`, **nenhuma cor semântica**, e o valor vem escrito à direita
 * de cada barra, então a comparação não depende de ler comprimento.
 *
 * **O que o Recharts 3 cobra, e a validação já mediu:** o `layout="vertical"` fica no `BarChart` e **não se
 * repete no `<Bar>`**, que é quebra documentada da v3; o eixo de valor é `XAxis type="number" hide`; e o
 * `ChartContainer` precisa de altura explícita, senão nasce com zero. A altura sai do número de linhas,
 * para que quatro faixas e seis status tenham barras da mesma espessura.
 *
 * **A barra de valor zero não desenha retângulo, e o `LabelList` continua escrevendo `0`**: é o 59.2, a
 * estrutura aparecendo mesmo a zero.
 *
 * **A lista para leitor de tela existe porque o SVG é `aria-hidden`.** Sem ela, quem não vê chegaria ao
 * quadro e ouviria só o título. Ela sai do **mesmo** array das barras, e por isso as duas não discordam.
 * O quadro que tem `Ver dados` a dispensa (`listaParaLeitor={false}`): a tabela do modal é a alternativa
 * textual dele.
 *
 * **Sem `accessibilityLayer`**, pela razão de `grafico-do-fluxo-mensal.tsx`: ele torna o gráfico focável,
 * e foco dentro de `aria-hidden` é defeito. **Animação desligada**, porque o ponta a ponta lê rótulos.
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

const CONFIGURACAO: ChartConfig = { valor: { label: "Quantidade", color: "var(--chart-1)" } };
const ALTURA_DA_LINHA = 36;
const ALTURA_DA_BARRA = 22;
/** Largura média de um caractere do papel `meta`, em px — é o que reserva a margem do texto de valor. */
const LARGURA_DO_CARACTERE = 7;

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
  const maiorTexto = Math.max(...barras.map((barra) => barra.texto.length), 1);
  const temDuasLinhas = barras.some((barra) => barra.rotuloDeBaixo !== undefined);
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
          data={[...barras]}
          layout="vertical"
          margin={{ top: 4, right: maiorTexto * LARGURA_DO_CARACTERE + 16, bottom: 4, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={larguraDoRotulo}
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
      <tspan x={Number(x) - 4} dy={14} className="fill-tinta-fraca">
        {barra.rotuloDeBaixo}
      </tspan>
    </text>
  );
}
