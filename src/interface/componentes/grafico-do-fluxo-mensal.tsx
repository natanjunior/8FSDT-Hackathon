"use client";

import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";

import type { LinhaDoFluxoMensal } from "@/interface/componentes/fluxo-mensal";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/interface/componentes/ui/chart";

/**
 * ============================================================================
 *  O gráfico do bloco 1 de T-07 — duas linhas, quanto entrou e quanto saiu
 * ============================================================================
 *
 * **Duas linhas, nunca área empilhada** (critério 57.2): empilhar registradas sobre resolvidas somaria
 * coisas que não se somam, e o topo da pilha seria um número que não existe. **Uma escala só** (57.3):
 * as duas séries contam ocorrência, e um segundo eixo faria duas escalas diferentes parecerem
 * comparáveis.
 *
 * **Traço reto** (57.6), com a razão que o componente anterior já escrevia: curva suavizada numa série de
 * três a cinco meses inventa valor entre dois meses. **E os pontos ficam visíveis**, pelo mesmo
 * argumento um passo adiante — sem marca em cada mês, o olho lê um contínuo onde há cinco medidas.
 *
 * **A identidade da série existe em palavra duas vezes** (57.4): na legenda, embaixo, e num rótulo na
 * ponta direita de cada traço. Os dois se afastam na vertical porque nos meses em que as séries terminam
 * no mesmo valor os pontos coincidem, e sem o afastamento as duas palavras cairiam uma sobre a outra. A
 * margem direita abre o espaço.
 *
 * **Nenhuma cor semântica.** Verde para resolvidas e vermelho para registradas julgaria o número antes de
 * quem lê, e um mês de muitas registradas pode ser a organização finalmente usando o produto. As cores
 * são `--chart-1` e `--chart-2`, da paleta categórica que um teste mede.
 *
 * **A animação está desligada.** O rótulo de ponta só desenha depois que a linha termina de animar, e o
 * ponta a ponta afirma os dois rótulos: com animação, a asserção passaria a depender de tempo.
 *
 * **O gráfico é `aria-hidden`, e a informação vive na lista ao lado** — compromisso A-5, como o produto
 * já o aplica. Por isso o `accessibilityLayer` dos exemplos do catálogo fica de fora: ele torna o
 * gráfico focável pelo teclado, e conteúdo focável dentro de `aria-hidden` é o defeito que o A-5 existe
 * para não ter.
 */
const CONFIGURACAO: ChartConfig = {
  registradas: { label: "Registradas", color: "var(--chart-1)" },
  resolvidas: { label: "Resolvidas", color: "var(--chart-2)" },
};

/** As duas séries, com o deslocamento vertical que separa os rótulos de ponta quando os pontos coincidem. */
const SERIES = [
  { chave: "registradas", rotulo: "Registradas", dy: -12 },
  { chave: "resolvidas", rotulo: "Resolvidas", dy: 16 },
] as const;

export function GraficoDoFluxoMensal({ linhas }: { linhas: readonly LinhaDoFluxoMensal[] }) {
  const ultimo = linhas.length - 1;

  return (
    <ChartContainer
      aria-hidden
      config={CONFIGURACAO}
      className="aspect-auto h-56 w-full [&_.recharts-cartesian-axis-tick_text]:text-meta"
    >
      <LineChart data={[...linhas]} margin={{ top: 12, right: 78, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {SERIES.map((serie) => (
          <Line
            key={serie.chave}
            dataKey={serie.chave}
            type="linear"
            stroke={`var(--color-${serie.chave})`}
            strokeWidth={2}
            dot={{ r: 3, fill: `var(--color-${serie.chave})`, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          >
            {/* Sem `dataKey`: o valor sai do `valueAccessor`, e ele só escreve no último ponto. */}
            <LabelList
              position="right"
              offset={8}
              dy={serie.dy}
              className="text-meta"
              fill={`var(--color-${serie.chave})`}
              valueAccessor={(_entrada, indice) => (indice === ultimo ? serie.rotulo : null)}
            />
          </Line>
        ))}
      </LineChart>
    </ChartContainer>
  );
}
