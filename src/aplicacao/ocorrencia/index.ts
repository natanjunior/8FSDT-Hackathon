/** Superfície pública do módulo `aplicacao/ocorrencia` (ADR-0006, regra 3). */
export {
  AreaInvalida,
  CategoriaInvalida,
  OcorrenciaNaoEncontrada,
  TransicaoNaoPermitida,
} from "./erros";
export { analisarOcorrencia, type ContextoDoComando } from "./analisar-ocorrencia";
export {
  type AnexoLido,
  type CursorDeListagem,
  type DadosDaAtribuicao,
  type FiltroDeListagem,
  type FiltroDeOcorrencias,
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
