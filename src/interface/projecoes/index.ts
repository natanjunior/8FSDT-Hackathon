/** Superfície pública de `interface/projecoes` (ADR-0006, regra 3). */
export { projetarContexto, type ContextoProjetado } from "./contexto";

export {
  projetarArea,
  projetarCategoria,
  projetarOrganizacao,
  type AreaProjetada,
  type CategoriaProjetada,
  type OrganizacaoProjetada,
} from "./organizacao";

export {
  projetarPedidoDeEntrada,
  projetarPedidoDeEntradaDetalhe,
  type PedidoDeEntradaDetalheProjetado,
  type PedidoDeEntradaProjetado,
} from "./pedido-de-entrada";

export { projetarVinculo, type VinculoProjetado } from "./vinculo";
