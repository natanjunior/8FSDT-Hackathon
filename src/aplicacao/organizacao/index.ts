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
export { cadastrarVinculo, corrigirVinculo, listarVinculos, verVinculo } from "./vinculos";
export {
  AreaInvalida,
  CodigoPublicoEmUso,
  CodigoPublicoNaoEncontrado,
  JaVinculado,
  PedidoDeEntradaPendente,
  PedidoJaDecidido,
  PedidoNaoEncontrado,
  PessoaComContaNaoEditavel,
  VinculoNaoEncontrado,
} from "./erros";
export type {
  AreaLida,
  CategoriaLida,
  ContatoLido,
  DadosDaCorrecao,
  DadosDoCadastro,
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
  RepositorioEscopadoDeVinculos,
  RepositorioGlobalDePedidosDeEntrada,
  ResultadoDaAprovacao,
  ResultadoDaCorrecao,
  ResultadoDaRecusa,
  ResultadoDoCadastro,
  ResultadoDoPedidoDeEntrada,
  VinculoLido,
} from "./portas";
