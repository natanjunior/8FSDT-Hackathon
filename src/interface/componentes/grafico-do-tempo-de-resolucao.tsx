"use client";

import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";

import type { UnidadeDoEixo } from "@/interface/componentes/tempo-de-resolucao";
import { ChartContainer, type ChartConfig } from "@/interface/componentes/ui/chart";

/**
 * ============================================================================
 *  O gráfico do quadro 3 de T-07 — a mediana e o p90, mês a mês
 * ============================================================================
 *
 * **Duas linhas, no molde do fluxo** (item 73): a mediana diz como foi o caso do meio, e o p90 como foi o
 * décimo pior atendimento. **Mês sem resolução é buraco nas duas** (`connectNulls={false}`), e mês de
 * amostra pequena tem mediana e não tem p90, então o buraco é só na do p90: juntar os pontos inventaria um
 * valor que ninguém mediu.
 *
 * **O eixo tem uma unidade só**, escolhida pela magnitude do maior valor desenhado (`unidadeDoEixo`), e os
 * pontos chegam já nela. Os rótulos de ponta chegam escritos por `duracaoEmTexto`, a mesma função que
 * escreve toda duração do produto.
 *
 * **`aria-hidden`, sem legenda e sem animação**, pelas razões do gráfico do fluxo. A alternativa textual
 * é a tabela do `Ver dados`.
 *
 * **`accessibilityLayer={false}` escrito à mão**, pela razão de `grafico-do-fluxo-mensal.tsx`: no
 * Recharts 3 a camada vem ligada e torna o `svg` focável, e foco dentro de `aria-hidden` é defeito.
 */

export type PontoDoTempo = { rotulo: string; mediana: number | null; p90: number | null };

const CONFIGURACAO: ChartConfig = {
  p90: { label: "p90", color: "var(--chart-1)" },
  mediana: { label: "Mediana", color: "var(--chart-2)" },
};

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const SERIES = [
  { chave: "p90", rotulo: "p90", dy: -12 },
  { chave: "mediana", rotulo: "mediana", dy: 16 },
] as const;

/**
 * O índice do último ponto não nulo de uma série. **Não é `findLastIndex`**: ele é ES2023, e o
 * `tsconfig.json` declara `ES2022`.
 */
function ultimoNaoNulo(pontos: readonly PontoDoTempo[], chave: "mediana" | "p90"): number {
  for (let i = pontos.length - 1; i >= 0; i -= 1) {
    if (pontos[i]?.[chave] !== null && pontos[i]?.[chave] !== undefined) return i;
  }
  return -1;
}

export function GraficoDoTempoDeResolucao({
  pontos,
  unidade,
  pontas,
}: {
  /** Já na unidade do eixo. */
  pontos: readonly PontoDoTempo[];
  unidade: UnidadeDoEixo;
  /** Os textos de ponta, já escritos por `duracaoEmTexto`: `{ mediana: "3,2 dias", p90: "9,9 dias" }`. */
  pontas: { mediana: string | null; p90: string | null };
}) {
  return (
    <ChartContainer
      aria-hidden
      config={CONFIGURACAO}
      className="aspect-auto h-56 w-full [&_.recharts-cartesian-axis-tick_text]:text-meta"
    >
      <LineChart accessibilityLayer={false} data={[...pontos]} margin={{ top: 24, right: 120, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(valor: number) => `${NUMERO.format(valor)} ${unidade.sufixo}`}
        />
        {SERIES.map((serie) => {
          const indice = ultimoNaoNulo(pontos, serie.chave);
          const texto = pontas[serie.chave];
          return (
            <Line
              key={serie.chave}
              dataKey={serie.chave}
              type="linear"
              connectNulls={false}
              stroke={`var(--color-${serie.chave})`}
              strokeWidth={2}
              dot={{ r: 3, fill: `var(--color-${serie.chave})`, strokeWidth: 0 }}
              isAnimationActive={false}
            >
              <LabelList
                position="right"
                offset={16}
                dy={serie.dy}
                className="text-meta"
                fill={`var(--color-${serie.chave})`}
                valueAccessor={(_entrada, i) =>
                  i === indice && texto !== null ? `${serie.rotulo} ${texto}` : null
                }
              />
            </Line>
          );
        })}
      </LineChart>
    </ChartContainer>
  );
}
