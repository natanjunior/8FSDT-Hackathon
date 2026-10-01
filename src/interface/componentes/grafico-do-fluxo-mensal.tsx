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
 * direita comporta `Registradas` com três dígitos, e a de cima comporta o rótulo que sobe 12 px quando o
 * último mês é o maior valor do desenho (com 12 px de margem, `Registradas 8` saía cortado ao meio).
 *
 * O texto vai em tinta e o ponto na cor da série (item 110): a cor da série passa a régua de objeto
 * gráfico, 3:1, e reprova como texto. O texto anda `RECUO_DO_TEXTO` à direita do ponto, e a margem
 * direita cresceu o mesmo tanto.
 *
 * **Nenhuma cor semântica.** Verde para as saídas e vermelho para as registradas julgaria o número antes de
 * quem lê, e um mês de muitas registradas pode ser a organização finalmente usando o produto. As cores são
 * `--chart-1` e `--chart-2`, da paleta categórica que um teste mede.
 *
 * **A animação está desligada.** O rótulo de ponta só desenha depois que a linha termina de animar, e o
 * ponta a ponta afirma rótulos: com animação, a asserção passaria a depender de tempo.
 *
 * **O gráfico é `aria-hidden`, e a informação vive na tabela do `Ver dados`** — compromisso A-5.
 *
 * **`accessibilityLayer={false}`, escrito, porque no Recharts 3 ele vem ligado.** O `CartesianChart` o
 * liga por padrão (`recharts/es6/chart/CartesianChart.js:24`), e ligado ele põe `role="application"` e
 * `tabIndex={0}` no `svg` (`RootSurface.js:40-51`). Não passar a propriedade deixava os sete gráficos do
 * painel focáveis dentro de um contêiner `aria-hidden`, que é o defeito que o A-5 existe para não ter
 * (achado D-01 da auditoria de 26/09/2026). A frase antiga, "fica de fora", descrevia o Recharts 2.
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

/** A distância do ponto ao texto, em px: o `●` em `meta` tem cerca de 8 px, e o resto é respiro. */
const RECUO_DO_TEXTO = 12;

export function GraficoDoFluxoMensal({ linhas }: { linhas: readonly LinhaDoFluxoMensal[] }) {
  const ultimo = linhas.length - 1;
  const final = linhas[ultimo];

  return (
    <ChartContainer
      aria-hidden
      config={CONFIGURACAO}
      className="aspect-auto h-56 w-full [&_.recharts-cartesian-axis-tick_text]:text-meta"
    >
      <LineChart accessibilityLayer={false} data={[...linhas]} margin={{ top: 24, right: 132 + RECUO_DO_TEXTO, bottom: 0, left: 4 }}>
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
            {/* Sem `dataKey`: o valor sai do `valueAccessor`, e eles só escrevem no último ponto. */}
            {/* O ponto: objeto gráfico, na cor da série (3:1). É ele que diz qual linha é qual. */}
            <LabelList
              position="right"
              offset={30}
              dy={serie.dy}
              className="text-meta"
              fill={`var(--color-${serie.chave})`}
              valueAccessor={(_entrada, indice) =>
                indice === ultimo && final !== undefined ? "●" : null
              }
            />
            {/* O texto: tinta cheia (4,5:1). Na cor da série ele media 3,82:1 no escuro (A-008). */}
            <LabelList
              position="right"
              offset={30 + RECUO_DO_TEXTO}
              dy={serie.dy}
              className="fill-tinta text-meta"
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
