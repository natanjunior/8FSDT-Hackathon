/**
 * Superfície pública de `infraestrutura/clientes` — **o único diretório do repositório que importa um
 * SDK** (ADR-0006, regra de lint 1: *nada fora de `infraestrutura/clientes/` importa um SDK — banco,
 * storage ou autenticação*).
 *
 * Note o que **não** está exportado: nenhum tipo do `pg`, nenhum `SupabaseClient`. O que sai daqui é
 * porta ou função de consulta.
 */
export { criarConsulta, criarTransacao, type Consulta, type Transacao } from "./banco";
export {
  criarAutenticacao,
  criarCredenciais,
  type ArmazenamentoDeCookies,
} from "./autenticacao";
