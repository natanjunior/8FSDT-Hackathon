"use client";

import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";

import type { LinhaDoFluxoMensal } from "@/interface/componentes/fluxo-mensal";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/interface/componentes/ui/chart";

/**
 * ============================================================================
 *  O gráfico do quadro 1 de T-07 — duas linhas, quanto entrou e quanto saiu
 * ============================================================================
 *
 * **Duas linhas, nunca área empilhada** (critério 57.2): empilhar registradas sobre saídas somaria coisas
 * que não se somam, e o topo da pilha seria um número que não existe. **Uma escala só** (57.3): as duas
 * séries contam ocorrência, e um segundo eixo faria duas escalas diferentes parecerem comparáveis. *Saíram*
 * é resolvidas mais canceladas (item 73), o mesmo número do cartão do saldo.
 *
 * **A escala fica escrita no eixo vertical** (item 73, critério 6), em inteiros, e **todo mês tem rótulo**
 * (`interval={0}`): o eixo pulava o primeiro. A legenda de baixo saiu; a identidade da série fica no rótulo
 * da ponta de cada traço, com o valor do último mês junto (`Registradas 74`).
 *
 * **Traço reto** (57.6): curva suavizada numa série de três a cinco meses inventa valor entre dois meses.
 * **E os pontos ficam visíveis**, pelo mesmo argumento um passo adiante — sem marca em cada mês, o olho lê
 * um contínuo onde há cinco medidas.
 *
 * **O afastamento dos rótulos de ponta é medido, e não é enfeite.** Na vertical, as duas palavras se
 * afastam porque nos meses em que as séries terminam no mesmo valor os pontos coincidem. Na horizontal, o
 * rótulo do mês do eixo é centrado no ponto, e a série que termina no chão do desenho põe o rótulo de ponta
 * na mesma faixa vertical dele: com 8 px o texto encostou no `set` com zero de folga (Recanto, 23/09/2026),
 * e com o ano no rótulo, na virada, a folga contra `fev/26` caiu a 4 px com 22. Trinta deixam 12. A margem
 * direita comporta `Registradas` com três dígitos.
 *
 * **Nenhuma cor semântica.** Verde para as saídas e vermelho para as registradas julgaria o número antes de
 * quem lê, e um mês de muitas registradas pode ser a organização finalmente usando o produto. As cores são
 * `--chart-1` e `--chart-2`, da paleta categórica que um teste mede.
 *
 * **A animação está desligada.** O rótulo de ponta só desenha depois que a linha termina de animar, e o
 * ponta a ponta afirma rótulos: com animação, a asserção passaria a depender de tempo.
 *
 * **O gráfico é `aria-hidden`, e a informação vive na tabela do `Ver dados`** — compromisso A-5. Por isso
 * o `accessibilityLayer` dos exemplos do catálogo fica de fora: ele torna o gráfico focável pelo teclado, e
 * conteúdo focável dentro de `aria-hidden` é o defeito que o A-5 existe para não ter.
 */
const CONFIGURACAO: ChartConfig = {
  registradas: { label: "Registradas", color: "var(--chart-1)" },
  saidas: { label: "Saíram", color: "var(--chart-2)" },
};

/** As duas séries, com o deslocamento vertical que separa os rótulos de ponta quando os pontos coincidem. */
const SERIES = [
  { chave: "registradas", rotulo: "Registradas", dy: -12 },
  { chave: "saidas", rotulo: "Saíram", dy: 16 },
] as const;

export function GraficoDoFluxoMensal({ linhas }: { linhas: readonly LinhaDoFluxoMensal[] }) {
  const ultimo = linhas.length - 1;
  const final = linhas[ultimo];

  return (
    <ChartContainer
      aria-hidden
      config={CONFIGURACAO}
      className="aspect-auto h-56 w-full [&_.recharts-cartesian-axis-tick_text]:text-meta"
    >
      <LineChart data={[...linhas]} margin={{ top: 12, right: 132, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
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
              offset={30}
              dy={serie.dy}
              className="text-meta"
              fill={`var(--color-${serie.chave})`}
              valueAccessor={(_entrada, indice) =>
                indice === ultimo && final !== undefined
                  ? `${serie.rotulo} ${String(final[serie.chave])}`
                  : null
              }
            />
          </Line>
        ))}
      </LineChart>
    </ChartContainer>
  );
}
