/** Superfície pública de `interface/projecoes` (ADR-0006, regra 3). */
export { projetarContexto, type ContextoProjetado } from "./contexto";

export { projetarConvite, type ConviteProjetado } from "./convite";

export {
  projetarConviteDoGestor,
  projetarConvitePessoal,
  type ConviteDoGestorProjetado,
  type ConvitePessoalProjetado,
} from "./convite-pessoal";

export {
  projetarDashboard,
  type DashboardProjetado,
  type PontoDoMesProjetado,
} from "./dashboard";

export {
  projetarArea,
  projetarAreaAtualizada,
  projetarCategoria,
  projetarConfiguracao,
  projetarOrganizacao,
  projetarOrganizacaoResumo,
  type AreaAtualizadaProjetada,
  type AreaProjetada,
  type CategoriaProjetada,
  type ConfiguracaoProjetada,
  type MudancaDeConfiguracaoProjetada,
  type OrganizacaoProjetada,
  type OrganizacaoResumoProjetada,
} from "./organizacao";

export {
  codificarCursor,
  codificarCursorDeConversa,
  decodificarCursor,
  decodificarCursorDeConversa,
  algumFiltroAlemDoAutor,
  descricaoDoRecorte,
  fraseDoVazioDeFiltro,
  LENTE_DO_GESTOR,
  lenteDeRotulo,
  lenteDoSolicitante,
  nomeDaPrioridade,
  nomeDoMotivoCancelamento,
  nomeDoMotivoPausa,
  nomeDoStatus,
  opcoesDeMotivoCancelamento,
  opcoesDeMotivoPausa,
  opcoesDePrioridade,
  projetarCandidato,
  projetarComentario,
  projetarCompartilhamento,
  projetarEventoDaLinhaDoTempo,
  projetarOcorrenciaDetalhe,
  projetarOcorrenciaResumo,
  projetarPaginaDeComentarios,
  projetarPaginaDeOcorrencias,
  projetarTransicao,
  rotuloDeMotivoPausa,
  rotuloDeStatus,
  rotuloPadraoDoSolicitante,
  segundaLinhaDeMotivo,
  type ComentarioProjetado,
  type EventoDaLinhaDoTempoProjetado,
  type LenteDeRotulo,
  type OcorrenciaResumoProjetada,
  type PaginaDeComentariosProjetada,
  type PaginaDeOcorrenciasProjetada,
  type QuemLe,
  type RotulosDaOrganizacao,
} from "./ocorrencia";

export {
  projetarPedidoDeEntrada,
  projetarPedidoDeEntradaDetalhe,
  type PedidoDeEntradaDetalheProjetado,
  type PedidoDeEntradaProjetado,
} from "./pedido-de-entrada";

export { projetarVinculo, type VinculoProjetado } from "./vinculo";

export { projetarEtiqueta, type EtiquetaProjetada } from "./etiqueta";

export { projetarAnexo, projetarAutorizacaoDeUpload, type AnexoProjetado } from "./anexo";
