/**
 * Superfície pública de `infraestrutura/clientes` — **o único diretório do repositório que importa um
 * SDK** (ADR-0006, regra de lint 1: *nada fora de `infraestrutura/clientes/` importa um SDK — banco,
 * storage ou autenticação*).
 *
 * **Os três da regra passaram a existir de fato em 25/08/2026**, com o item 13a: até então a lista dizia
 * "banco, storage ou autenticação" e o storage era só uma vaga reservada. `armazenamento.ts` a preencheu,
 * e é o terceiro e último arquivo daqui a importar um SDK.
 *
 * Note o que **não** está exportado: nenhum tipo do `pg`, nenhum `SupabaseClient`, nenhum tipo do
 * `@azure/storage-blob`. O que sai daqui é porta ou função de consulta.
 */
export { criarConsulta, criarTransacao, type Consulta, type Transacao } from "./banco";
export { criarEmissorDeCredencialDeUpload } from "./armazenamento";
export {
  criarAutenticacao,
  criarCredenciais,
  type ArmazenamentoDeCookies,
} from "./autenticacao";
