import type { AreaLida } from "@/aplicacao/organizacao";
import { STATUS } from "@/dominio/ocorrencia";

import { mesesDaJanela, resolverJanela, type Janela, type JanelaPedida } from "./janela";
import { AMOSTRA_PEQUENA, FAIXAS_DE_IDADE } from "./portas";
import type {
  ContagemPorCategoria,
  ContagemPorFaixaDeIdade,
  ContagemPorStatus,
  LinhaDeResolucao,
  PontoMensal,
  RepositorioEscopadoDeDashboard,
} from "./portas";

/**
 * ============================================================================
 *  `GET /dashboard` — e a estrada direta de T-07, que é a mesma função
 * ============================================================================
 *
 * **O envelope é o que o item 32 é** (`backlog.md:1387-1391`): a permissão, a janela, o eixo dos meses, a
 * forma da resposta e os zeros. Os seis conteúdos são dos itens 33 a 36 e do 59, e chegam prontos do
 * repositório.
 *
 * **Uma requisição, seis leituras em paralelo.** A razão da §8.7 do contrato é de plataforma e continua
 * valendo: *"cinco requisições podem significar cinco esperas de cold start onde uma bastaria"*. Aqui são
 * seis idas ao banco dentro de **uma** requisição HTTP, e nenhuma espera pela outra — o `Promise.all` é o
 * mesmo idioma de `verLinhaDoTempo`.
 *
 * **`pool.max` é 5** (`infraestrutura/clientes/banco.ts:44`), e as seis consultas são uma a mais do que o
 * pool tem: a sexta espera uma conexão liberar e corre em seguida. Não há impasse possível, e a razão é a
 * mesma de antes: nenhuma delas segura conexão esperando outra. O `5` é justificado pelo teto de conexões
 * do free tier e pela escala a zero; mexer nele muda toda requisição do produto, não só esta tela, e não
 * cabe num item de painel. Sequenciá-las trocaria essa espera por seis idas e voltas somadas na tela mais
 * pesada do produto.
 */

export type PontoDoMes = { mes: string; quantidade: number };
export type SerieDeCategoria = {
  categoria: { id: string; nome: string };
  porMes: readonly PontoDoMes[];
};
export type SerieDeArea = { area: AreaLida; porMes: readonly PontoDoMes[] };
/**
 * Um mês do quadro 4. **Três valores de tempo, e nunca os três preenchidos ao mesmo tempo** — a tabela da
 * spec §3.3 é o contrato:
 *
 * | Mês | `mediana` | `p90` | `amostra` |
 * |---|---|---|---|
 * | sem resolução | `null` | `null` | `null` |
 * | 1 a 3 resoluções | o valor | `null` | as durações, ordenadas |
 * | 4 ou mais | o valor | o valor | `null` |
 *
 * **A mediana é publicada sempre que houve resolução, inclusive no mês pequeno.** Ela não é percentil
 * chutado: com um ponto é aquele ponto, com dois é o ponto médio, com três é o do meio. O que o critério
 * 58.4 recusa é o p90, e é só ele que fica em `null` — com três pontos `percentile_cont` **interpola** um
 * valor entre os dois maiores, que ninguém observou.
 *
 * **`amostra` é `null` acima do teto, e não `[]`:** `null` diz *não se aplica*; `[]` diria *nenhuma
 * resolução*, que é outra coisa e já tem representação.
 */
export type MesDeResolucao = {
  mes: string;
  mediana: number | null;
  p90: number | null;
  amostra: readonly number[] | null;
  resolvidas: number;
};
export type MediaDasAvaliacoes = { media: number | null; avaliadas: number; resolvidas: number };

/**
 * Uma faixa do quadro 6, **já completa**: os dois limites em dias e quantas ocorrências em aberto caem
 * nela. `ateDias: null` é a faixa sem teto, e o `null` aqui diz *não há teto* — o mesmo uso que `amostra`
 * recebeu no item 58, onde `null` diz *não se aplica* e nunca *zero*.
 *
 * **Nenhum rótulo viaja.** `statusRotulo` existe porque o texto do status depende de quem lê; o rótulo da
 * faixa não depende de leitor nenhum — ele é os dois números escritos em português, e escrevê-los é da
 * tela. É o mesmo corte do item 55, que deixou a unidade de tempo para a tela.
 */
export type FaixaDeIdadeLida = { deDias: number; ateDias: number | null; quantidade: number };

/** O schema `Dashboard` do contrato, ainda sem o `statusRotulo` — quem o acrescenta é a projeção. */
export type DashboardLido = {
  periodo: Janela;
  backlogPorStatus: readonly ContagemPorStatus[];
  abertasPorCategoria: readonly ContagemPorCategoria[];
  abertasPorIdade: readonly FaixaDeIdadeLida[];
  mediaDasAvaliacoes: MediaDasAvaliacoes;
  recorrenciaPorCategoria: readonly SerieDeCategoria[];
  recorrenciaPorArea: readonly SerieDeArea[];
  tempoDeResolucao: { porMes: readonly MesDeResolucao[] };
};

export async function verDashboard(
  repositorio: RepositorioEscopadoDeDashboard,
  pedido: JanelaPedida & { agora?: string } = {},
): Promise<DashboardLido> {
  const periodo = resolverJanela({ de: pedido.de, ate: pedido.ate }, pedido.agora);
  const meses = mesesDaJanela(periodo);

  const [status, categorias, porCategoria, porArea, resolucoes, idades] = await Promise.all([
    repositorio.backlogPorStatus(),
    repositorio.abertasPorCategoria(),
    repositorio.recorrenciaPorCategoria(periodo),
    repositorio.recorrenciaPorArea(periodo),
    repositorio.resolucoesPorMes(periodo),
    repositorio.abertasPorIdade(),
  ]);

  return {
    periodo,
    backlogPorStatus: comOsSeisStatus(status),
    abertasPorCategoria: categorias,
    abertasPorIdade: comTodasAsFaixas(idades),
    mediaDasAvaliacoes: mediaDe(resolucoes),
    recorrenciaPorCategoria: agrupar(
      porCategoria,
      meses,
      (ponto) => ponto.categoria.id,
      (ponto, porMes) => ({ categoria: ponto.categoria, porMes }),
      (ponto) => ponto.categoria.nome,
    ),
    recorrenciaPorArea: agrupar(
      porArea,
      meses,
      (ponto) => ponto.area.id,
      (ponto, porMes) => ({ area: ponto.area, porMes }),
      (ponto) => ponto.area.nome,
    ),
    tempoDeResolucao: { porMes: serieDeResolucao(resolucoes, meses) },
  };
}

/** Uma casa decimal, e o único consumidor é a nota de 1 a 5 — o `4.3` que o `openapi.yaml` exemplifica. */
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/**
 * **Duas casas, e o critério 55.2 é quem obriga.** *"Nenhum valor maior que zero é renderizado como
 * zero"* é absoluto, e com uma casa os minutos que a tela escreve andam de seis em seis: qualquer
 * duração abaixo de três minutos voltaria a ser `0 min`.
 *
 * **A amostra é o que muda o cálculo de risco.** Ela publica a duração de **uma** resolução, e o mês com
 * uma resolução de dois minutos é comum numa organização que está começando. Com duas casas o quantum é
 * de 36 segundos, abaixo do menor texto que a tela sabe escrever.
 */
function arredondarHoras(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * **Os seis, sempre, na ordem do ciclo** — que é a ordem de `STATUS` (`StatusOcorrencia.ts:8`).
 *
 * O critério 32.3 pede a estrutura com zeros, e o exemplo do `openapi.yaml:2134` mostra quatro status —
 * é exemplo, não schema (achado A-32-6 do plano). A tela desenha os seis, inclusive os terminais.
 */
function comOsSeisStatus(lidas: readonly ContagemPorStatus[]): readonly ContagemPorStatus[] {
  const porStatus = new Map(lidas.map((linha) => [linha.status, linha.quantidade]));
  return STATUS.map((status) => ({ status, quantidade: porStatus.get(status) ?? 0 }));
}

/**
 * **As quatro, sempre, na ordem crescente** — que é a ordem de `FAIXAS_DE_IDADE` (`portas.ts`).
 *
 * O critério 59.2 pede a estrutura com zeros, e a consulta não a produz: um `group by` não inventa grupo
 * sem linha. É o mesmo par de `comOsSeisStatus` com `STATUS`, e pela mesma razão de portão — a regra de
 * produto mora aqui, onde o `npm run verificar` a confere.
 *
 * **A ordem cai de graça:** ela é a da constante, e o `order by 1` da consulta deixa de importar para a
 * resposta.
 */
function comTodasAsFaixas(
  lidas: readonly ContagemPorFaixaDeIdade[],
): readonly FaixaDeIdadeLida[] {
  const porFaixa = new Map(lidas.map((linha) => [linha.faixa, linha.quantidade]));
  return FAIXAS_DE_IDADE.map((faixa, i) => ({
    deDias: faixa.deDias,
    ateDias: faixa.ateDias,
    quantidade: porFaixa.get(i) ?? 0,
  }));
}

/**
 * Agrupa pontos soltos em séries, **preenchendo todo mês do eixo**.
 *
 * **Categoria sem nenhum ponto não vira série de zeros** — ela simplesmente não está aqui, porque o
 * repositório não a trouxe. É o que faz o critério 35.2 ser alcançável: sem ocorrência na janela, as duas
 * listas são vazias, e a tela escreve *"A recorrência aparece a partir do segundo mês de uso."*
 *
 * **A ordem é o total do período, decrescente, com desempate alfabético em pt-BR.** A API não corta nada
 * (`openapi.yaml:3205` não tem parâmetro de limite); quem corta é a tela, e ela corta **as primeiras** —
 * então a ordem precisa ser a de quem mais aparece.
 */
function agrupar<P extends PontoMensal, S>(
  pontos: readonly P[],
  meses: readonly string[],
  chave: (ponto: P) => string,
  montar: (ponto: P, porMes: readonly PontoDoMes[]) => S,
  nome: (ponto: P) => string,
): readonly S[] {
  const porChave = new Map<
    string,
    { primeiro: P; quantidades: Map<string, number>; total: number }
  >();

  for (const ponto of pontos) {
    const grupo = porChave.get(chave(ponto)) ?? {
      primeiro: ponto,
      quantidades: new Map<string, number>(),
      total: 0,
    };
    grupo.quantidades.set(ponto.mes, (grupo.quantidades.get(ponto.mes) ?? 0) + ponto.quantidade);
    grupo.total += ponto.quantidade;
    porChave.set(chave(ponto), grupo);
  }

  return [...porChave.values()]
    .sort((a, b) => b.total - a.total || nome(a.primeiro).localeCompare(nome(b.primeiro), "pt-BR"))
    .map((grupo) =>
      montar(
        grupo.primeiro,
        meses.map((mes) => ({ mes, quantidade: grupo.quantidades.get(mes) ?? 0 })),
      ),
    );
}

/**
 * **Nenhum mês é omitido** — critério 36.2. Mês sem resolução fica na série com os três valores de tempo
 * em `null` e `resolvidas: 0`, e a razão é do contrato: *"buraco na série é informação"*.
 *
 * **A regra do critério 58.4 mora aqui, e não no SQL**: `npm run verificar` não roda o projeto de
 * integração, então uma regra de produto que só vivesse na consulta seria uma regra que o portão nunca
 * confere. O `case` do SQL usa a **mesma** constante e existe só para não transportar duzentos números
 * que ninguém vai ler.
 */
function serieDeResolucao(
  resolucoes: readonly LinhaDeResolucao[],
  meses: readonly string[],
): readonly MesDeResolucao[] {
  const porMes = new Map(resolucoes.map((linha) => [linha.mes, linha]));

  return meses.map((mes) => {
    const linha = porMes.get(mes);
    if (linha === undefined || linha.resolvidas === 0) {
      return { mes, mediana: null, p90: null, amostra: null, resolvidas: 0 };
    }

    const pequena = linha.resolvidas <= AMOSTRA_PEQUENA;
    return {
      mes,
      mediana: arredondarHoras(linha.medianaDeHoras),
      p90: pequena ? null : arredondarHoras(linha.p90DeHoras),
      amostra: pequena ? linha.amostraEmHoras.map((horas) => arredondarHoras(horas)) : null,
      resolvidas: linha.resolvidas,
    };
  });
}

/**
 * **A média sai das MESMAS linhas do bloco 4, e é isso que torna o critério 34.5 verdadeiro por
 * construção**: `resolvidas` aqui é a soma dos mesmos números que a série mensal mostra, então a mesma
 * palavra não pode dar dois valores na mesma tela.
 *
 * **`media` é `null`, nunca `0`, quando ninguém avaliou** (critério 34.2) — e `resolvidas` continua
 * contando, porque a frase da tela é *"0 de 0 resolvidas"*, não *"sem dados"*.
 */
function mediaDe(resolucoes: readonly LinhaDeResolucao[]): MediaDasAvaliacoes {
  let resolvidas = 0;
  let avaliadas = 0;
  let somaDasNotas = 0;

  for (const linha of resolucoes) {
    resolvidas += linha.resolvidas;
    avaliadas += linha.avaliadas;
    somaDasNotas += linha.somaDasNotas;
  }

  return {
    media: avaliadas === 0 ? null : arredondar(somaDasNotas / avaliadas),
    avaliadas,
    resolvidas,
  };
}
