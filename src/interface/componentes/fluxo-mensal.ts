/**
 * ============================================================================
 *  O fluxo mensal do bloco 1 de T-07 — quanto entrou e quanto saiu
 * ============================================================================
 *
 * **Duas séries que já chegam prontas, cruzadas por mês.** A soma das séries de
 * `recorrenciaPorCategoria` num mês é quanto foi registrado naquele mês — `ocorrencias.categoria_id` é
 * `not null` e a consulta recorta a janela por `registrada_em`, então nenhuma ocorrência fica fora de uma
 * categoria. E `tempoMedioDeResolucao.porMes[].resolvidas` é quanto saiu. **Nenhuma consulta nova e
 * nenhum campo novo** — é o critério 57.1, e é o que faz deste o item mais barato da leva.
 *
 * **Módulo puro, sem um único `import`, e é por isso que ele não mora no componente.** O critério 57.1
 * diz onde a derivação mora: *"onde o teste alcança, não dentro do componente de cliente"*. O projeto
 * `unitario` roda em `environment: "node"`, e importar daqui um módulo com JSX e `"use client"` estrearia
 * esse risco sem ganho. A ilha do gráfico importa este tipo, nunca o contrário.
 *
 * **A leitura é por posição, e a Aplicação é quem a torna segura.** O eixo é um só: `mesesDaJanela` o
 * monta uma vez, `agrupar` preenche toda série de categoria sobre ele — zero onde não houve ocorrência —
 * e `serieDeResolucao` preenche a de resolução sobre o mesmo, sem omitir mês (critério 36.2). O `?? 0`
 * daqui é defesa contra série mais curta que o eixo, que é dado impossível hoje e ainda assim não pode
 * virar `undefined` dentro de uma `<Line>`.
 *
 * **Ele não ordena e não preenche mês**, pela mesma razão que o módulo anterior não ordenava: repetir na
 * tela o que a Aplicação já fez é afirmar a mesma coisa em duas camadas, e a segunda envelhece sozinha.
 *
 * **Isto NÃO é *recorrência*, e o nome é deliberado.** Recorrência é o mesmo problema voltando no mesmo
 * lugar, e é o que as duas listas do bloco respondem. Aqui a pergunta é outra — *está melhorando ou
 * piorando* —, e o qualificador `mensal` afasta a palavra *fluxo* do que `docs/fluxos-e-diagramas.md`
 * chama de fluxo.
 */

/** Uma linha do desenho e da lista: um mês do eixo, com o que entrou e o que saiu. */
export type LinhaDoFluxoMensal = {
  /** O rótulo pronto do mês — `jun`, ou `jun/26` quando a janela atravessa a virada do ano. */
  mes: string;
  registradas: number;
  resolvidas: number;
};

/**
 * Cruza as duas séries mês a mês, sobre o eixo que `rotulos` define.
 *
 * O eixo vem de fora porque quem o monta é o bloco 4: `tempoMedioDeResolucao.porMes` é a única série que
 * o contrato garante sem buraco. **O nome da categoria não entra aqui** — o que se soma é a contagem, e
 * quem responde *onde* e *o quê* são as duas listas do mesmo bloco.
 */
export function linhasDoFluxoMensal(
  series: readonly { porMes: readonly { quantidade: number }[] }[],
  resolucoes: readonly { resolvidas: number }[],
  rotulos: readonly string[],
): readonly LinhaDoFluxoMensal[] {
  return rotulos.map((mes, indice) => ({
    mes,
    registradas: series.reduce(
      (soma, serie) => soma + (serie.porMes[indice]?.quantidade ?? 0),
      0,
    ),
    resolvidas: resolucoes[indice]?.resolvidas ?? 0,
  }));
}

/**
 * `3 registradas · 5 resolvidas` — o número de cada mês em texto, que é o critério 57.5.
 *
 * **O separador é ` · `**, o mesmo que o bloco 4 usa entre a duração e o denominador: nenhum separador
 * novo entra no vocabulário da tela. **O singular vale dos dois lados**, como o bloco 4 já faz com
 * `resolvida`.
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela mesma razão do resto do módulo: é derivação, e
 * derivação dentro de um componente é derivação que nenhum teste do laço curto alcança.
 */
export function textoDoFluxoMensal(linha: LinhaDoFluxoMensal): string {
  return `${contagem(linha.registradas, "registrada")} · ${contagem(linha.resolvidas, "resolvida")}`;
}

function contagem(quantidade: number, substantivo: string): string {
  return `${String(quantidade)} ${substantivo}${quantidade === 1 ? "" : "s"}`;
}
