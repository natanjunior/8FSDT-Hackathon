/** Superfície pública do módulo `aplicacao/organizacao` (ADR-0006, regra 3). */
export { criarOrganizacao } from "./criar-organizacao";
export { listarAreas, listarCategorias, listarPedidosDeEntrada } from "./consultas";
export { pedirEntrada, type ComandoDePedirEntrada } from "./pedir-entrada";
export {
  aprovarPedidoDeEntrada,
  recusarPedidoDeEntrada,
  type DecisaoDeAprovacao,
  type DecisaoDeRecusa,
} from "./decidir-pedido-de-entrada";
export {
  AreaInvalida,
  CodigoPublicoEmUso,
  CodigoPublicoNaoEncontrado,
  JaVinculado,
  PedidoDeEntradaPendente,
  PedidoJaDecidido,
  PedidoNaoEncontrado,
} from "./erros";
export type {
  AreaLida,
  CategoriaLida,
  ContatoLido,
  NovaOrganizacao,
  OrganizacaoCriada,
  PedidoDaPessoa,
  PedidoDeEntradaLido,
  PedidoDeEntradaRegistrado,
  RepositorioDeOrganizacoes,
  RepositorioDePedidosDeEntrada,
  RepositorioEscopadoDeAreas,
  RepositorioEscopadoDeCategorias,
  RepositorioEscopadoDePedidosDeEntrada,
  RepositorioGlobalDePedidosDeEntrada,
  ResultadoDaAprovacao,
  ResultadoDaRecusa,
  ResultadoDoPedidoDeEntrada,
  VinculoCriado,
} from "./portas";
