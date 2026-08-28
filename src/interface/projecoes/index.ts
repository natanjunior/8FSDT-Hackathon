/** Superfície pública de `interface/projecoes` (ADR-0006, regra 3). */
export { projetarContexto, type ContextoProjetado } from "./contexto";

export {
  projetarArea,
  projetarAreaAtualizada,
  projetarCategoria,
  projetarOrganizacao,
  type AreaAtualizadaProjetada,
  type AreaProjetada,
  type CategoriaProjetada,
  type OrganizacaoProjetada,
} from "./organizacao";

export {
  codificarCursor,
  decodificarCursor,
  descricaoDoRecorte,
  nomeDaPrioridade,
  nomeDoMotivoPausa,
  nomeDoStatus,
  opcoesDeMotivoPausa,
  opcoesDePrioridade,
  projetarOcorrenciaDetalhe,
  projetarOcorrenciaResumo,
  projetarPaginaDeOcorrencias,
  projetarTransicao,
  rotuloDeMotivoPausa,
  rotuloDeStatus,
  segundaLinhaDeMotivo,
  type OcorrenciaResumoProjetada,
  type PaginaDeOcorrenciasProjetada,
  type QuemLe,
} from "./ocorrencia";

export {
  projetarPedidoDeEntrada,
  projetarPedidoDeEntradaDetalhe,
  type PedidoDeEntradaDetalheProjetado,
  type PedidoDeEntradaProjetado,
} from "./pedido-de-entrada";

export { projetarVinculo, type VinculoProjetado } from "./vinculo";

export { projetarAnexo, projetarAutorizacaoDeUpload, type AnexoProjetado } from "./anexo";
