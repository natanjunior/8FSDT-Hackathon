import type { DashboardLido } from "@/aplicacao/dashboard";

import { nomeDoStatus } from "./ocorrencia";
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
 * **O `statusRotulo` sai de `nomeDoStatus`, e este item NÃO espera o item 31.** T-07 é tela de
 * `dashboard.ler`, e o rótulo do dashboard é o do **Gestor** — que já existe no código com outro nome, com
 * exatamente as seis palavras que o `openapi.yaml:2135-2138` exemplifica. Quando o item 31 chegar, ele
 * troca a origem para o `rotuloDeStatus` do Gestor **sem mudar uma única string** (spec §3.5).
 *
 * **A área sai por `projetarArea`, e são cinco campos.** `openapi.yaml:3266` declara `$ref: Area`, e
 * `Area` exige `[id, nome, tipo, ativa, ordem]`; o exemplo do mesmo arquivo mostra três, e é o achado
 * **A-32-5** do plano. A tela lê só o `nome` — os outros viajam porque o schema os exige.
 */

export type PontoDoMesProjetado = { mes: string; quantidade: number };

export type DashboardProjetado = {
  periodo: { de: string; ate: string };
  backlogPorStatus: readonly { status: string; statusRotulo: string; quantidade: number }[];
  backlogPorCategoria: readonly {
    categoria: { id: string; nome: string };
    quantidade: number;
  }[];
  mediaDasAvaliacoes: { media: number | null; avaliadas: number; resolvidas: number };
  recorrenciaPorCategoria: readonly {
    categoria: { id: string; nome: string };
    porMes: readonly PontoDoMesProjetado[];
  }[];
  recorrenciaPorArea: readonly {
    area: AreaProjetada;
    porMes: readonly PontoDoMesProjetado[];
  }[];
  tempoMedioDeResolucao: {
    porMes: readonly { mes: string; horas: number | null; resolvidas: number }[];
  };
};

export function projetarDashboard(lido: DashboardLido): DashboardProjetado {
  return {
    periodo: { de: lido.periodo.de, ate: lido.periodo.ate },
    backlogPorStatus: lido.backlogPorStatus.map((linha) => ({
      status: linha.status,
      statusRotulo: nomeDoStatus(linha.status),
      quantidade: linha.quantidade,
    })),
    backlogPorCategoria: lido.backlogPorCategoria.map((linha) => ({
      categoria: { id: linha.categoria.id, nome: linha.categoria.nome },
      quantidade: linha.quantidade,
    })),
    mediaDasAvaliacoes: {
      media: lido.mediaDasAvaliacoes.media,
      avaliadas: lido.mediaDasAvaliacoes.avaliadas,
      resolvidas: lido.mediaDasAvaliacoes.resolvidas,
    },
    recorrenciaPorCategoria: lido.recorrenciaPorCategoria.map((serie) => ({
      categoria: { id: serie.categoria.id, nome: serie.categoria.nome },
      porMes: serie.porMes.map((ponto) => ({ mes: ponto.mes, quantidade: ponto.quantidade })),
    })),
    recorrenciaPorArea: lido.recorrenciaPorArea.map((serie) => ({
      area: projetarArea(serie.area),
      porMes: serie.porMes.map((ponto) => ({ mes: ponto.mes, quantidade: ponto.quantidade })),
    })),
    tempoMedioDeResolucao: {
      porMes: lido.tempoMedioDeResolucao.porMes.map((mes) => ({
        mes: mes.mes,
        horas: mes.horas,
        resolvidas: mes.resolvidas,
      })),
    },
  };
}
