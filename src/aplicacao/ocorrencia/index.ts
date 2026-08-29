/** Superfície pública do módulo `aplicacao/ocorrencia` (ADR-0006, regra 3). */
export {
  AreaInvalida,
  CategoriaInvalida,
  MotivoNaoPermitidoParaOPapel,
  OcorrenciaNaoEncontrada,
  PrioridadeImutavelEmEstadoTerminal,
  ResponsavelNaoAtribuido,
  ResponsavelSemVinculoAtivo,
  SomenteOGestorCancelaNesteEstado,
  TransicaoNaoPermitida,
} from "./erros";
export { alterarPrioridade } from "./alterar-prioridade";
export { analisarOcorrencia } from "./analisar-ocorrencia";
export { atribuirResponsavel, type AtribuicaoAplicada } from "./atribuir-responsavel";
export { cancelarOcorrencia } from "./cancelar-ocorrencia";
export { type ContextoDoComando } from "./comando";
export { iniciarAtendimento } from "./iniciar-atendimento";
export { pausarOcorrencia } from "./pausar-ocorrencia";
export {
  type AnexoLido,
  type CursorDeListagem,
  type DadosDaAtribuicao,
  type FiltroDeListagem,
  type FiltroDeOcorrencias,
  type OcorrenciaCarregada,
  type OcorrenciaLida,
  type OcorrenciaResumoLida,
  type PessoaReferencia,
  type PortasDoRegistro,
  type RepositorioEscopadoDeOcorrencias,
  type ResultadoDaAtribuicao,
  type ResultadoDaPrioridade,
  type ResultadoDaSolucaoAplicada,
  type ResultadoDaTransicao,
  type ResultadoDoRegistro,
  type TransicaoLida,
} from "./portas";
export { reivindicarAnexo, type ReferenciaDeAnexo } from "./reivindicar-anexo";
export { registrarOcorrencia, type EntradaDeRegistro } from "./registrar-ocorrencia";
export { registrarSolucaoAplicada } from "./registrar-solucao-aplicada";
export { resolverOcorrencia } from "./resolver-ocorrencia";
export { retomarOcorrencia } from "./retomar-ocorrencia";
export {
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  listarOcorrencias,
  podeLerOcorrencia,
  verAnexoDaOcorrencia,
  verOcorrencia,
  verTrilhaDeAuditoria,
  type PaginaDeOcorrencias,
  type QuemPergunta,
  type VarianteDoAnexo,
  type VisibilidadeAplicada,
} from "./consultas";
