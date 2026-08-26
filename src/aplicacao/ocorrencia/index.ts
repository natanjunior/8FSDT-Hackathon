/** Superfície pública do módulo `aplicacao/ocorrencia` (ADR-0006, regra 3). */
export { AreaInvalida, CategoriaInvalida, OcorrenciaNaoEncontrada } from "./erros";
export {
  type OcorrenciaLida,
  type PessoaReferencia,
  type PortasDoRegistro,
  type RepositorioEscopadoDeOcorrencias,
  type TransicaoLida,
} from "./portas";
export { registrarOcorrencia, type EntradaDeRegistro } from "./registrar-ocorrencia";
export { verOcorrencia, verTrilhaDeAuditoria } from "./consultas";
