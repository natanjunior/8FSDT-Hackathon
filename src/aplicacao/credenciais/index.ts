/** Superfície pública do módulo `aplicacao/credenciais` (ADR-0006, regra 3). */
export { confirmarPorCodigo, criarConta, entrar, sair } from "./autenticar";
export type {
  PortaDeCredenciais,
  RecusaDeCredencial,
  ResultadoDeCredencial,
} from "./portas";
