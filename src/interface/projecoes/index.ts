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
  projetarVinculo,
  type PedidoDeEntradaDetalheProjetado,
  type PedidoDeEntradaProjetado,
  type VinculoProjetado,
} from "./pedido-de-entrada";
