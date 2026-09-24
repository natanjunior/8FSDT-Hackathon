/**
 * ============================================================================
 *  O fluxo mensal do quadro 1 de T-07 — quanto entrou e quanto saiu
 * ============================================================================
 *
 * **Três séries que já chegam prontas, cruzadas por mês.** A soma das séries de
 * `recorrenciaPorCategoria` num mês é quanto foi registrado naquele mês — `ocorrencias.categoria_id` é
 * `not null` e a consulta recorta a janela por `registrada_em`, então nenhuma ocorrência fica fora de uma
 * categoria. **O que saiu é resolvidas mais canceladas** (item 73): `tempoDeResolucao.porMes[].resolvidas`
 * e `canceladasPorMes`, as duas ancoradas no instante da transição. Com as canceladas de fora, o saldo do
 * cartão e a coluna *Saldo* da tabela discordariam na mesma tela.
 *
 * **Módulo puro, sem um único `import`, e é por isso que ele não mora no componente.** O critério 57.1
 * diz onde a derivação mora: *"onde o teste alcança, não dentro do componente de cliente"*. O projeto
 * `unitario` roda em `environment: "node"`, e importar daqui um módulo com JSX e `"use client"` estrearia
 * esse risco sem ganho. A ilha do gráfico importa este tipo, nunca o contrário. **É por isso que os nomes
 * dos meses moram aqui**, e `blocos-do-dashboard.tsx` os reexporta.
 *
 * **A leitura é por mês, e não por posição.** O eixo é `tempoDeResolucao.porMes`, a série que o contrato
 * garante sem buraco; as séries de categoria e as canceladas são lidas pela chave `mes`, com zero onde
 * faltar.
 *
 * **Ele não ordena e não preenche mês**, pela mesma razão que o módulo anterior não ordenava: repetir na
 * tela o que a Aplicação já fez é afirmar a mesma coisa em duas camadas, e a segunda envelhece sozinha.
 *
 * **Isto NÃO é *recorrência*, e o nome é deliberado.** Recorrência é o mesmo problema voltando no mesmo
 * lugar, e é o que o quadro 4 responde. Aqui a pergunta é outra, *está melhorando ou piorando*, e o
 * qualificador `mensal` afasta a palavra *fluxo* do que `docs/fluxos-e-diagramas.md` chama de fluxo.
 */

const NOMES_DOS_MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const NOMES_COMPLETOS_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/**
 * `2026-06` vira `jun` — **e vira `jun/26` quando a janela atravessa a virada do ano**.
 *
 * Sem isso, uma janela de 90 dias aberta em janeiro mostraria `nov · dez · jan` sem dizer que os dois
 * primeiros são do ano passado, e a série leria como se subisse quando desce. A decisão é do eixo inteiro,
 * não de cada rótulo: ou todos levam ano, ou nenhum leva.
 */
export function rotulosDosMeses(meses: readonly string[]): readonly string[] {
  const comAno = atravessaAVirada(meses);
  return meses.map((mes) => {
    const nome = NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
    return comAno ? `${nome}/${mes.slice(2, 4)}` : nome;
  });
}

/** Se o eixo tem meses de mais de um ano. É a regra de `rotulosDosMeses`, e o veredito a reusa. */
export function atravessaAVirada(meses: readonly string[]): boolean {
  return new Set(meses.map((mes) => mes.slice(0, 4))).size > 1;
}

/**
 * `2026-08` vira `agosto`, e `agosto de 2026` quando `comAno` — que é quando o eixo atravessa a virada,
 * pela mesma regra de `rotulosDosMeses`. O eixo escreve abreviado; a frase do veredito escreve inteiro.
 */
export function nomeCompletoDoMes(mes: string, comAno: boolean): string {
  const nome = NOMES_COMPLETOS_DOS_MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
  return comAno ? `${nome} de ${mes.slice(0, 4)}` : nome;
}

/** Uma linha do desenho e da tabela: um mês do eixo, com o que entrou, o que saiu e a diferença. */
export type LinhaDoFluxoMensal = {
  /** `YYYY-MM`. É a chave da linha. */
  mes: string;
  /** O rótulo pronto do mês — `jun`, `jun/26` na virada, e com `*` quando o período corta o mês. */
  rotulo: string;
  parcial: boolean;
  registradas: number;
  resolvidas: number;
  canceladas: number;
  /** Resolvidas mais canceladas. */
  saidas: number;
  /** Registradas menos saídas. A soma da coluna é o saldo do cartão. */
  saldo: number;
};

/**
 * **O período corta o mês** quando `de` cai depois do dia 1 dele ou `ate` antes do último dia. Mês cortado
 * não se compara com mês inteiro, e sem a marca a série exagera a rampa sem avisar.
 *
 * O último dia sai de `Date.UTC(ano, mes, 0)`, o dia zero do mês seguinte. A comparação é de texto
 * `YYYY-MM-DD`, que ordena como data.
 */
export function mesParcial(mes: string, periodo: { de: string; ate: string }): boolean {
  const ano = Number(mes.slice(0, 4));
  const numero = Number(mes.slice(5, 7));
  const ultimoDia = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  const primeiro = `${mes}-01`;
  const ultimo = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
  return periodo.de > primeiro || periodo.ate < ultimo;
}

/** O rodapé do quadro 1, escrito só quando algum mês é parcial. */
export const NOTA_DO_MES_PARCIAL =
  "* Mês parcial: o período corta esse mês, e o número dele não se compara com o de um mês inteiro.";

/**
 * Cruza as três séries mês a mês, sobre o eixo de `resolucoes`.
 *
 * **O nome da categoria não entra aqui**: o que se soma é a contagem, e quem responde *onde* é o quadro
 * 5.
 */
export function linhasDoFluxoMensal(
  series: readonly { porMes: readonly { mes: string; quantidade: number }[] }[],
  resolucoes: readonly { mes: string; resolvidas: number }[],
  canceladas: readonly { mes: string; quantidade: number }[],
  periodo: { de: string; ate: string },
): readonly LinhaDoFluxoMensal[] {
  const meses = resolucoes.map((linha) => linha.mes);
  const rotulos = rotulosDosMeses(meses);
  const canceladasPorMes = new Map(canceladas.map((ponto) => [ponto.mes, ponto.quantidade]));

  return resolucoes.map((linha, indice) => {
    const parcial = mesParcial(linha.mes, periodo);
    const registradas = series.reduce(
      (soma, serie) => soma + (serie.porMes.find((ponto) => ponto.mes === linha.mes)?.quantidade ?? 0),
      0,
    );
    const cancelada = canceladasPorMes.get(linha.mes) ?? 0;
    const saidas = linha.resolvidas + cancelada;
    return {
      mes: linha.mes,
      rotulo: `${rotulos[indice] ?? linha.mes}${parcial ? "*" : ""}`,
      parcial,
      registradas,
      resolvidas: linha.resolvidas,
      canceladas: cancelada,
      saidas,
      saldo: registradas - saidas,
    };
  });
}

export type SaldoDoPeriodo = { entraram: number; sairam: number; saldo: number };

/** Os três números do cartão *Saldo do período* — a soma das linhas, e por isso a coluna fecha com ele. */
export function saldoDoPeriodo(linhas: readonly LinhaDoFluxoMensal[]): SaldoDoPeriodo {
  const entraram = linhas.reduce((soma, linha) => soma + linha.registradas, 0);
  const sairam = linhas.reduce((soma, linha) => soma + linha.saidas, 0);
  return { entraram, sairam, saldo: entraram - sairam };
}

/**
 * **O veredito fala do último mês completo do período.** Os totais já estão no cartão do saldo, na mesma
 * fileira, e repeti-los aqui seria o mesmo número duas vezes. Sem mês completo, a frase diz isso, e nunca
 * fala de um mês cortado como se fosse inteiro.
 */
export function vereditoDoFluxo(linhas: readonly LinhaDoFluxoMensal[]): string {
  const completo = [...linhas].reverse().find((linha) => !linha.parcial);
  if (completo === undefined) return "O período não tem mês completo.";

  const nome = nomeCompletoDoMes(
    completo.mes,
    atravessaAVirada(linhas.map((linha) => linha.mes)),
  );
  const entrou = completo.registradas === 1 ? "entrou" : "entraram";
  const saiu = completo.saidas === 1 ? "saiu" : "saíram";
  return `Em ${nome}, o último mês completo, ${entrou} ${String(completo.registradas)} e ${saiu} ${String(completo.saidas)}.`;
}
