/** Superfície pública de `interface/projecoes` (ADR-0006, regra 3). */
export { projetarContexto, type ContextoProjetado } from "./contexto";

export {
  projetarDashboard,
  type DashboardProjetado,
  type PontoDoMesProjetado,
} from "./dashboard";

export {
  projetarArea,
  projetarAreaAtualizada,
  projetarCategoria,
  projetarOrganizacao,
  projetarOrganizacaoResumo,
  type AreaAtualizadaProjetada,
  type AreaProjetada,
  type CategoriaProjetada,
  type OrganizacaoProjetada,
  type OrganizacaoResumoProjetada,
} from "./organizacao";

export {
  codificarCursor,
  codificarCursorDeConversa,
  decodificarCursor,
  decodificarCursorDeConversa,
  descricaoDoRecorte,
  lenteDeRotulo,
  nomeDaPrioridade,
  nomeDoMotivoCancelamento,
  nomeDoMotivoPausa,
  nomeDoStatus,
  opcoesDeMotivoCancelamento,
  opcoesDeMotivoPausa,
  opcoesDePrioridade,
  projetarComentario,
  projetarEventoDaLinhaDoTempo,
  projetarOcorrenciaDetalhe,
  projetarOcorrenciaResumo,
  projetarPaginaDeComentarios,
  projetarPaginaDeOcorrencias,
  projetarTransicao,
  rotuloDeMotivoPausa,
  rotuloDeStatus,
  segundaLinhaDeMotivo,
  type ComentarioProjetado,
  type EventoDaLinhaDoTempoProjetado,
  type LenteDeRotulo,
  type OcorrenciaResumoProjetada,
  type PaginaDeComentariosProjetada,
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
