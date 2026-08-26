/**
 * Superfície pública do módulo `dominio/anexo`.
 *
 * Regra 3 da ADR-0006: entre módulos da mesma camada, só pela superfície pública.
 */
export {
  TIPOS_DE_ANEXO,
  TIPOS_DE_CONTEUDO_DE_ANEXO,
  ehTipoDeConteudoDeAnexo,
  tipoDeAnexo,
  type TipoDeAnexo,
  type TipoDeConteudoDeAnexo,
} from "./TipoDeConteudo";
