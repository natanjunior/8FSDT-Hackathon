/**
 * Superfície pública do módulo `dominio/organizacao`.
 *
 * Regra 3 da ADR-0006: entre módulos da mesma camada, só pela superfície pública. Ninguém alcança
 * `./Vinculo` de fora — alcança-se `@/dominio/organizacao`.
 */
export { Vinculo } from "./Vinculo";
export { PAPEIS, ehPapel, type Papel } from "./Papel";
export { PERMISSOES, PERMISSOES_POR_PAPEL, type Permissao } from "./Permissao";
