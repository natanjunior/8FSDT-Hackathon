/** Superfície pública do módulo `dominio/ocorrencia` (ADR-0006, regra 3). */
export { COMANDOS, COMANDOS_IMPLEMENTADOS, type Comando } from "./Comando";
export { comandosDisponiveis, transicaoPermitida, type PerguntaDeAcoes } from "./MaquinaDeEstados";
export {
  MOTIVOS_DE_CANCELAMENTO,
  MOTIVOS_DE_PAUSA,
  type MotivoCancelamento,
  type MotivoPausa,
} from "./Motivos";
export { Ocorrencia, type DadosDeRegistro, type TipoDeAreaCongelado } from "./Ocorrencia";
export { ehPrioridade, PRIORIDADE_INICIAL, PRIORIDADES, type Prioridade } from "./Prioridade";
export { RegistroDeTransicao } from "./RegistroDeTransicao";
export {
  ehStatusOcorrencia,
  ehTerminal,
  STATUS,
  TERMINAIS,
  type StatusOcorrencia,
} from "./StatusOcorrencia";
