/** Superfície pública do módulo `aplicacao/dashboard` (ADR-0006, regra 3). */
export {
  DIAS_DA_JANELA,
  FUSO,
  atalhosDaJanela,
  diaEmSaoPaulo,
  mesEmSaoPaulo,
  mesesDaJanela,
  resolverJanela,
  type AtalhosDaJanela,
  type Janela,
  type JanelaPedida,
} from "./janela";

export {
  AMOSTRA_PEQUENA,
  FAIXAS_DE_IDADE,
  LIMITES_DAS_FAIXAS_DE_IDADE,
  MINIMO_PARA_RECORRENCIA,
  QUANTAS_MAIS_VELHAS,
} from "./portas";

export type {
  ContagemPorCategoria,
  ContagemPorFaixaDeIdade,
  ContagemPorStatus,
  DuplaRecorrente,
  FaixaDeIdade,
  LinhaDeResolucao,
  MaisVelhaEmAberto,
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
  type NotaDaDistribuicao,
  type PontoDoMes,
  type SerieDeArea,
  type SerieDeCategoria,
} from "./indicadores";
