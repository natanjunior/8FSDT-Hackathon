/** Superfície pública do módulo `aplicacao/ocorrencia` (ADR-0006, regra 3). */
export { AreaInvalida, CategoriaInvalida, OcorrenciaNaoEncontrada } from "./erros";
export {
  type AnexoLido,
  type CursorDeListagem,
  type FiltroDeListagem,
  type FiltroDeOcorrencias,
  type OcorrenciaLida,
  type OcorrenciaResumoLida,
  type PessoaReferencia,
  type PortasDoRegistro,
  type RepositorioEscopadoDeOcorrencias,
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
