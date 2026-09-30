/** Superfície pública do módulo `dominio/ocorrencia` (ADR-0006, regra 3). */
export { AnexoDaOcorrencia, type DadosDeAnexo } from "./AnexoDaOcorrencia";
export { Avaliacao, type DadosDeAvaliacao, NOTAS_DA_AVALIACAO } from "./Avaliacao";
export { COMANDOS, COMANDOS_IMPLEMENTADOS, type Comando } from "./Comando";
export {
  AvaliacaoExigeResolvida,
  JaAvaliada,
  PrioridadeImutavelEmEstadoTerminal,
  TransicaoNaoPermitida,
} from "./erros";
export {
  comandoPermitido,
  comandosDisponiveis,
  estadosDeCancelamentoDoAutor,
  LIMITE_DE_CANCELAMENTO_PADRAO,
  LIMITES_DE_CANCELAMENTO_DO_SOLICITANTE,
  transicaoPermitida,
  type LimiteDeCancelamentoDoSolicitante,
  type PerguntaDeAcoes,
} from "./MaquinaDeEstados";
export {
  MOTIVOS_DE_CANCELAMENTO,
  MOTIVOS_DE_PAUSA,
  MOTIVOS_DO_AUTOR,
  motivosPermitidos,
  type MotivoCancelamento,
  type MotivoPausa,
} from "./Motivos";
export {
  Ocorrencia,
  type DadosDeReconstituicao,
  type DadosDeRegistro,
  type TipoDeAreaCongelado,
} from "./Ocorrencia";
export { ehPrioridade, PRIORIDADE_INICIAL, PRIORIDADES, type Prioridade } from "./Prioridade";
export {
  RegistroDeTransicao,
  type DadosDeAvanco,
  type DadosDeCancelamento,
  type DadosDePausa,
  type DadosDeRegistroDeTransicao,
} from "./RegistroDeTransicao";
export {
  ehStatusOcorrencia,
  ehTerminal,
  STATUS,
  TERMINAIS,
  type StatusOcorrencia,
} from "./StatusOcorrencia";
