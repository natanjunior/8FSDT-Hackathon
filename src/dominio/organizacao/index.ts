/**
 * Superfície pública do módulo `dominio/organizacao`.
 *
 * Regra 3 da ADR-0006: entre módulos da mesma camada, só pela superfície pública. Ninguém alcança
 * `./Vinculo` de fora — alcança-se `@/dominio/organizacao`.
 */
export { Vinculo } from "./Vinculo";
export { PAPEIS, ehPapel, type Papel } from "./Papel";
export { PERMISSOES, PERMISSOES_POR_PAPEL, type Permissao } from "./Permissao";
export {
  ALFABETO_DO_CODIGO,
  COMPRIMENTO_DO_CODIGO,
  FORMATO_DO_CODIGO,
  gerarCodigoPublico,
} from "./CodigoPublico";
export { TIPOS_DE_AREA, ehTipoDeArea, type TipoArea } from "./TipoArea";
export {
  AREAS_SEMENTE,
  CATEGORIAS_SEMENTE,
  ICONE_PADRAO,
  type AreaSemente,
  type CategoriaSemente,
} from "./Semente";
