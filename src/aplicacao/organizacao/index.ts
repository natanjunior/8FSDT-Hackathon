/** Superfície pública do módulo `aplicacao/organizacao` (ADR-0006, regra 3). */
export { criarOrganizacao } from "./criar-organizacao";
export { listarAreas, listarCategorias } from "./consultas";
export { pedirEntrada, type ComandoDePedirEntrada } from "./pedir-entrada";
export {
  CodigoPublicoEmUso,
  CodigoPublicoNaoEncontrado,
  JaVinculado,
  PedidoDeEntradaPendente,
} from "./erros";
export type {
  AreaLida,
  CategoriaLida,
  NovaOrganizacao,
  OrganizacaoCriada,
  PedidoDaPessoa,
  PedidoDeEntradaRegistrado,
  RepositorioDeOrganizacoes,
  RepositorioDePedidosDeEntrada,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
  RepositorioGlobalDePedidosDeEntrada,
  ResultadoDoPedidoDeEntrada,
} from "./portas";
