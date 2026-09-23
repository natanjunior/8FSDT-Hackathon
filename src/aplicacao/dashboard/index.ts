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

export { AMOSTRA_PEQUENA, FAIXAS_DE_IDADE, LIMITES_DAS_FAIXAS_DE_IDADE } from "./portas";

export type {
  ContagemPorCategoria,
  ContagemPorFaixaDeIdade,
  ContagemPorStatus,
  FaixaDeIdade,
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
