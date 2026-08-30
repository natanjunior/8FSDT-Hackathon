/** Superfície pública do módulo `aplicacao/dashboard` (ADR-0006, regra 3). */
export {
  DIAS_DA_JANELA,
  FUSO,
  diaEmSaoPaulo,
  mesEmSaoPaulo,
  mesesDaJanela,
  resolverJanela,
  type Janela,
  type JanelaPedida,
} from "./janela";

export type {
  ContagemPorCategoria,
  ContagemPorStatus,
  LinhaDeResolucao,
  PontoDeArea,
  PontoDeCategoria,
  PontoMensal,
  RepositorioEscopadoDeDashboard,
} from "./portas";

export {
  verDashboard,
  type DashboardLido,
  type MediaDasAvaliacoes,
  type MesDeResolucao,
  type PontoDoMes,
  type SerieDeArea,
  type SerieDeCategoria,
} from "./indicadores";
