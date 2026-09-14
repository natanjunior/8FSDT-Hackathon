"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import type { LinhaDoGrafico } from "@/interface/componentes/recorrencia";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/interface/componentes/ui/chart";

/**
 * ============================================================================
 *  O gráfico do bloco 1 de T-07 — área empilhada, três categorias e o resto
 * ============================================================================
 *
 * **A ilha é do tamanho do gráfico.** `ChartContainer` usa `ResponsiveContainer`, que mede o nó no
 * navegador e por isso precisa de `"use client"`. Ela recebe linhas já projetadas e nomes já resolvidos:
 * não sabe de dashboard, de janela nem de repositório, e o corte em três mais *Outras* fica no servidor,
 * em `recorrencia.ts`, que é onde o teste o alcança.
 *
 * **As chaves são identificadores, e o nome viaja no rótulo.** O componente do catálogo transforma cada
 * chave da configuração em propriedade CSS `--color-<chave>`, e *"Infiltração no 3º andar"* não é nome de
 * propriedade. O balão mostra o `label`.
 *
 * **A cor vem por `color`, com o token dentro.** Quem troca de tema é o `--chart-N`, que já troca nos três
 * blocos de `globals.css`. A outra forma que o catálogo oferecia emitia seletor `.dark`, que este produto
 * não usa desde o item 44b — ela saiu do `chart.tsx` junto com o mapa de temas.
 *
 * **O gráfico é `aria-hidden`, e a informação vive na lista ao lado.** É o compromisso A-5 como o produto
 * já o aplica: toda barra vem acompanhada do número em texto. Por isso o `accessibilityLayer` dos exemplos
 * do catálogo fica de fora — ele torna o gráfico focável pelo teclado, e conteúdo focável dentro de
 * `aria-hidden` é o defeito que o A-5 existe para não ter.
 */
export function GraficoDaRecorrencia({
  linhas,
  nomes,
}: {
  linhas: readonly LinhaDoGrafico[];
  nomes: { categoria1?: string; categoria2?: string; categoria3?: string };
}) {
  const temOutras = linhas.some((linha) => linha.outras > 0);

  // A ordem aqui é a ordem da pilha, de baixo para cima: `Outras` é o chão, e as nomeadas sobem em ordem
  // decrescente de total. No claro o cinza é o tom mais pesado dos quatro, e tom pesado no meio da pilha
  // lê como a série principal — na base, o mesmo peso lê como chão.
  const faixas = [
    ...(temOutras ? [{ chave: "outras", rotulo: "Outras", cor: "var(--chart-4)" }] : []),
    { chave: "categoria1", rotulo: nomes.categoria1, cor: "var(--chart-1)" },
    { chave: "categoria2", rotulo: nomes.categoria2, cor: "var(--chart-2)" },
    { chave: "categoria3", rotulo: nomes.categoria3, cor: "var(--chart-3)" },
  ].filter((faixa): faixa is { chave: string; rotulo: string; cor: string } =>
    // Categoria que não existe no período não vira faixa de altura zero: ela seria uma série que o balão
    // anuncia e o olho não acha.
    Boolean(faixa.rotulo),
  );

  const configuracao: ChartConfig = Object.fromEntries(
    faixas.map((faixa) => [faixa.chave, { label: faixa.rotulo, color: faixa.cor }]),
  );

  return (
    <ChartContainer
      aria-hidden
      config={configuracao}
      className="aspect-auto h-56 w-full [&_.recharts-cartesian-axis-tick_text]:text-meta"
    >
      <AreaChart data={[...linhas]} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {faixas.map((faixa) => (
          <Area
            key={faixa.chave}
            dataKey={faixa.chave}
            stackId="recorrencia"
            // Curva suavizada numa série de três a quatro meses inventa valor entre dois meses.
            type="linear"
            stroke={`var(--color-${faixa.chave})`}
            fill={`var(--color-${faixa.chave})`}
            fillOpacity={1}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
