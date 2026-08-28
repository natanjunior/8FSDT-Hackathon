/** Superfície pública do módulo `aplicacao/ocorrencia` (ADR-0006, regra 3). */
export {
  AreaInvalida,
  CategoriaInvalida,
  OcorrenciaNaoEncontrada,
  ResponsavelNaoAtribuido,
  ResponsavelSemVinculoAtivo,
  TransicaoNaoPermitida,
} from "./erros";
export { analisarOcorrencia } from "./analisar-ocorrencia";
export { atribuirResponsavel, type AtribuicaoAplicada } from "./atribuir-responsavel";
export { type ContextoDoComando } from "./comando";
export { iniciarAtendimento } from "./iniciar-atendimento";
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
  type ResultadoDaTransicao,
  type ResultadoDoRegistro,
  type TransicaoLida,
} from "./portas";
export { reivindicarAnexo, type ReferenciaDeAnexo } from "./reivindicar-anexo";
export { registrarOcorrencia, type EntradaDeRegistro } from "./registrar-ocorrencia";
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
