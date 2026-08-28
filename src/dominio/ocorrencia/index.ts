/** Superfície pública do módulo `dominio/ocorrencia` (ADR-0006, regra 3). */
export { AnexoDaOcorrencia, type DadosDeAnexo } from "./AnexoDaOcorrencia";
export { COMANDOS, COMANDOS_IMPLEMENTADOS, type Comando } from "./Comando";
export { PrioridadeImutavelEmEstadoTerminal, TransicaoNaoPermitida } from "./erros";
export {
  comandoPermitido,
  comandosDisponiveis,
  transicaoPermitida,
  type PerguntaDeAcoes,
} from "./MaquinaDeEstados";
export {
  MOTIVOS_DE_CANCELAMENTO,
  MOTIVOS_DE_PAUSA,
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
