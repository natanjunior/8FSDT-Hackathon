import type { DashboardLido } from "@/aplicacao/dashboard";

import { rotuloDeStatus } from "./ocorrencia";
import { projetarArea, type AreaProjetada } from "./organizacao";

/**
 * ============================================================================
 *  O schema `Dashboard` do `openapi.yaml`
 * ============================================================================
 *
 * **Ela existe pela razão da §5 do contrato:** há **duas estradas** para esta leitura — o `route.ts` e o
 * Server Component de T-07 —, e uma projeção escrita dentro do handler não existiria para a tela. Se as
 * duas montassem a resposta por conta própria, elas divergiriam.
 *
 * **O `statusRotulo` sai de `rotuloDeStatus` na lente do Gestor, desde o item 31** — e a troca **não
 * mudou uma única string**: `testes/interface/dashboard.test.ts:67-77` fixa as seis palavras uma a uma e
 * não foi tocado. O campo se chama `statusRotulo`, e a função que produz rótulo de leitor é
 * `rotuloDeStatus`; `nomeDoStatus` fica com os consumidores cujo nome ele descreve — as opções do filtro
 * de T-03 e `descricaoDoRecorte`.
 *
 * **A área sai por `projetarArea`, e são cinco campos.** `openapi.yaml:3266` declara `$ref: Area`, e
 * `Area` exige `[id, nome, tipo, ativa, ordem]`; o exemplo do mesmo arquivo mostra três, e é o achado
 * **A-32-5** do plano. A tela lê só o `nome` — os outros viajam porque o schema os exige.
 */

export type PontoDoMesProjetado = { mes: string; quantidade: number };

export type DashboardProjetado = {
  periodo: { de: string; ate: string };
  backlogPorStatus: readonly { status: string; statusRotulo: string; quantidade: number }[];
  abertasPorCategoria: readonly {
    categoria: { id: string; nome: string };
    quantidade: number;
    envelhecidas: number;
  }[];
  abertasPorIdade: readonly { deDias: number; ateDias: number | null; quantidade: number }[];
  mediaDasAvaliacoes: {
    media: number | null;
    avaliadas: number;
    resolvidas: number;
    distribuicao: readonly { nota: number; quantidade: number }[];
  };
  recorrenciaPorCategoria: readonly {
    categoria: { id: string; nome: string };
    porMes: readonly PontoDoMesProjetado[];
  }[];
  recorrenciaPorArea: readonly {
    area: AreaProjetada;
    porMes: readonly PontoDoMesProjetado[];
  }[];
  duplasRecorrentes: readonly {
    area: AreaProjetada;
    categoria: { id: string; nome: string };
    quantidade: number;
  }[];
  tempoDeResolucao: {
    porMes: readonly {
      mes: string;
      mediana: number | null;
      p90: number | null;
      amostra: readonly number[] | null;
      resolvidas: number;
    }[];
  };
  canceladasPorMes: readonly PontoDoMesProjetado[];
  emAbertoNoInicio: number;
  maisVelhasEmAberto: readonly {
    id: string;
    titulo: string;
    status: string;
    statusRotulo: string;
    idadeEmDias: number;
  }[];
};

/**
 * **T-07 é tela de `dashboard.ler`, e essa permissão só o Gestor tem** (`Permissao.ts:60`). A lente
 * **não pode variar** — e um parâmetro que não varia é o argumento morto que o item 27 removeu de
 * `vazioDaBarra`. Fica literal, com a razão escrita ao lado.
 *
 * **Ela serve às duas listas que carregam status**: o backlog por status e as mais velhas em aberto.
 *
 * **`null` no motivo, e não é perda:** o backlog por status conta linhas agrupadas, e a lista das mais
 * velhas não traz o motivo da pausa. Do lado do Gestor `pausada` é *"Pausada"* com ou sem ele.
 */
const LENTE_DO_DASHBOARD = "gestor" as const;

export function projetarDashboard(lido: DashboardLido): DashboardProjetado {
  return {
    periodo: { de: lido.periodo.de, ate: lido.periodo.ate },
    backlogPorStatus: lido.backlogPorStatus.map((linha) => ({
      status: linha.status,
      statusRotulo: rotuloDeStatus(linha.status, null, LENTE_DO_DASHBOARD),
      quantidade: linha.quantidade,
    })),
    abertasPorCategoria: lido.abertasPorCategoria.map((linha) => ({
      categoria: { id: linha.categoria.id, nome: linha.categoria.nome },
      quantidade: linha.quantidade,
      envelhecidas: linha.envelhecidas,
    })),
    abertasPorIdade: lido.abertasPorIdade.map((faixa) => ({
      deDias: faixa.deDias,
      ateDias: faixa.ateDias,
      quantidade: faixa.quantidade,
    })),
    mediaDasAvaliacoes: {
      media: lido.mediaDasAvaliacoes.media,
      avaliadas: lido.mediaDasAvaliacoes.avaliadas,
      resolvidas: lido.mediaDasAvaliacoes.resolvidas,
      distribuicao: lido.mediaDasAvaliacoes.distribuicao.map((linha) => ({
        nota: linha.nota,
        quantidade: linha.quantidade,
      })),
    },
    recorrenciaPorCategoria: lido.recorrenciaPorCategoria.map((serie) => ({
      categoria: { id: serie.categoria.id, nome: serie.categoria.nome },
      porMes: serie.porMes.map((ponto) => ({ mes: ponto.mes, quantidade: ponto.quantidade })),
    })),
    recorrenciaPorArea: lido.recorrenciaPorArea.map((serie) => ({
      area: projetarArea(serie.area),
      porMes: serie.porMes.map((ponto) => ({ mes: ponto.mes, quantidade: ponto.quantidade })),
    })),
    duplasRecorrentes: lido.duplasRecorrentes.map((dupla) => ({
      area: projetarArea(dupla.area),
      categoria: { id: dupla.categoria.id, nome: dupla.categoria.nome },
      quantidade: dupla.quantidade,
    })),
    tempoDeResolucao: {
      porMes: lido.tempoDeResolucao.porMes.map((mes) => ({
        mes: mes.mes,
        mediana: mes.mediana,
        p90: mes.p90,
        amostra: mes.amostra === null ? null : [...mes.amostra],
        resolvidas: mes.resolvidas,
      })),
    },
    canceladasPorMes: lido.canceladasPorMes.map((ponto) => ({
      mes: ponto.mes,
      quantidade: ponto.quantidade,
    })),
    emAbertoNoInicio: lido.emAbertoNoInicio,
    maisVelhasEmAberto: lido.maisVelhasEmAberto.map((ocorrencia) => ({
      id: ocorrencia.id,
      titulo: ocorrencia.titulo,
      status: ocorrencia.status,
      statusRotulo: rotuloDeStatus(ocorrencia.status, null, LENTE_DO_DASHBOARD),
      idadeEmDias: ocorrencia.idadeEmDias,
    })),
  };
}
