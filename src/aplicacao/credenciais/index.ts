/** Superfície pública do módulo `aplicacao/credenciais` (ADR-0006, regra 3). */
export {
  confirmarPorCodigo,
  criarConta,
  definirSenha,
  entrar,
  iniciarRedefinicao,
  pedirRedefinicaoDeSenha,
  sair,
} from "./autenticar";
export type {
  PortaDeCredenciais,
  RecusaDeCredencial,
  ResultadoDeCredencial,
} from "./portas";
