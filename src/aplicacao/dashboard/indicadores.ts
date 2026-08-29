import type { AreaLida } from "@/aplicacao/organizacao";
import { STATUS } from "@/dominio/ocorrencia";

import { mesesDaJanela, resolverJanela, type Janela, type JanelaPedida } from "./janela";
import type {
  ContagemPorCategoria,
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
 * forma da resposta e os zeros. Os cinco conteúdos são dos itens 33 a 36, e chegam prontos do repositório.
 *
 * **Uma requisição, cinco leituras em paralelo.** A razão da §8.7 do contrato é de plataforma e continua
 * valendo: *"cinco requisições podem significar cinco esperas de cold start onde uma bastaria"*. Aqui são
 * cinco idas ao banco dentro de **uma** requisição HTTP, e nenhuma espera pela outra — o `Promise.all` é o
 * mesmo idioma de `verLinhaDoTempo`.
 *
 * **`pool.max` é 5** (`infraestrutura/clientes/banco.ts:44`), e as cinco consultas o ocupam por alguns
 * milissegundos. Não há impasse possível: nenhuma delas segura conexão esperando outra, então uma
 * requisição concorrente apenas enfileira. Sequenciá-las trocaria essa fila por cinco idas e voltas somadas
 * na tela mais pesada do produto.
 */

export type PontoDoMes = { mes: string; quantidade: number };
export type SerieDeCategoria = {
  categoria: { id: string; nome: string };
  porMes: readonly PontoDoMes[];
};
export type SerieDeArea = { area: AreaLida; porMes: readonly PontoDoMes[] };
export type MesDeResolucao = { mes: string; horas: number | null; resolvidas: number };
export type MediaDasAvaliacoes = { media: number | null; avaliadas: number; resolvidas: number };

/** O schema `Dashboard` do contrato, ainda sem o `statusRotulo` — quem o acrescenta é a projeção. */
export type DashboardLido = {
  periodo: Janela;
  backlogPorStatus: readonly ContagemPorStatus[];
  backlogPorCategoria: readonly ContagemPorCategoria[];
  mediaDasAvaliacoes: MediaDasAvaliacoes;
  recorrenciaPorCategoria: readonly SerieDeCategoria[];
  recorrenciaPorArea: readonly SerieDeArea[];
  tempoMedioDeResolucao: { porMes: readonly MesDeResolucao[] };
};

export async function verDashboard(
  repositorio: RepositorioEscopadoDeDashboard,
  pedido: JanelaPedida & { agora?: string } = {},
): Promise<DashboardLido> {
  const periodo = resolverJanela({ de: pedido.de, ate: pedido.ate }, pedido.agora);
  const meses = mesesDaJanela(periodo);

  const [status, categorias, porCategoria, porArea, resolucoes] = await Promise.all([
    repositorio.backlogPorStatus(),
    repositorio.backlogPorCategoria(),
    repositorio.recorrenciaPorCategoria(periodo),
    repositorio.recorrenciaPorArea(periodo),
    repositorio.resolucoesPorMes(periodo),
  ]);

  return {
    periodo,
    backlogPorStatus: comOsSeisStatus(status),
    backlogPorCategoria: categorias,
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
    tempoMedioDeResolucao: { porMes: serieDeResolucao(resolucoes, meses) },
  };
}

/** Uma casa decimal — a precisão que o `openapi.yaml` exemplifica (`52.4`, `41.5`, `4.3`). */
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
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
 * **Nenhum mês é omitido** — critério 36.2. Mês sem resolução fica na série com `horas: null` e
 * `resolvidas: 0`, e a razão é do contrato: *"buraco na série é informação"*.
 */
function serieDeResolucao(
  resolucoes: readonly LinhaDeResolucao[],
  meses: readonly string[],
): readonly MesDeResolucao[] {
  const porMes = new Map(resolucoes.map((linha) => [linha.mes, linha]));

  return meses.map((mes) => {
    const linha = porMes.get(mes);
    if (linha === undefined || linha.resolvidas === 0) return { mes, horas: null, resolvidas: 0 };
    return {
      mes,
      horas: arredondar(linha.somaDeHoras / linha.resolvidas),
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
