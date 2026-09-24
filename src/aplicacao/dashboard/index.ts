/** Superfície pública do módulo `aplicacao/dashboard` (ADR-0006, regra 3). */
export {
  DIAS_DA_JANELA,
  FUSO,
  diaEmSaoPaulo,
  ehJanelaPadrao,
  mesEmSaoPaulo,
  mesesDaJanela,
  resolverJanela,
  type Janela,
  type JanelaPedida,
} from "./janela";

export {
  AMOSTRA_PEQUENA,
  FAIXAS_DE_IDADE,
  LIMITES_DAS_FAIXAS_DE_IDADE,
  MINIMO_PARA_RECORRENCIA,
} from "./portas";

export type {
  ContagemPorCategoria,
  ContagemPorFaixaDeIdade,
  ContagemPorStatus,
  DuplaRecorrente,
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
  type FaixaDeIdadeLida,
  type MediaDasAvaliacoes,
  type MesDeResolucao,
  type PontoDoMes,
  type SerieDeArea,
  type SerieDeCategoria,
} from "./indicadores";
