/** Superfície pública do módulo `aplicacao/ocorrencia` (ADR-0006, regra 3). */
export {
  AreaInvalida,
  AvaliacaoExigeResolvida,
  CategoriaInvalida,
  JaAvaliada,
  MotivoNaoPermitidoParaOPapel,
  OcorrenciaNaoEncontrada,
  PrioridadeImutavelEmEstadoTerminal,
  ResponsavelNaoAtribuido,
  ResponsavelSemVinculoAtivo,
  SomenteOAutorPodeAvaliar,
  SomenteOGestorCancelaNesteEstado,
  SoParaLeitura,
  CompartilhamentoDeOutraPessoa,
  DestinatarioInvalido,
  TransicaoNaoPermitida,
  type MotivoDoDestinatarioInvalido,
} from "./erros";
export { alterarPrioridade } from "./alterar-prioridade";
export { analisarOcorrencia } from "./analisar-ocorrencia";
export { atribuirResponsavel, type AtribuicaoAplicada } from "./atribuir-responsavel";
export { avaliarOcorrencia } from "./avaliar-ocorrencia";
export { cancelarOcorrencia } from "./cancelar-ocorrencia";
export {
  LIMITE_DE_CANDIDATOS,
  buscarCandidatosAoCompartilhamento,
  compartilharOcorrencia,
  desfazerCompartilhamento,
  type CandidatoAoCompartilhamento,
  type MotivoDeJaVer,
} from "./compartilhamento";
export { type ContextoDoComando } from "./comando";
export { enviarComentario, verComentarios, type PaginaDeConversa } from "./conversa";
export { iniciarAtendimento } from "./iniciar-atendimento";
export { pausarOcorrencia } from "./pausar-ocorrencia";
export {
  COLUNAS_DE_ORDENACAO,
  type AnexoLido,
  type AtribuicaoLida,
  type ColunaDeOrdenacao,
  type CandidatoLido,
  type ComentarioLido,
  type CompartilhamentoLido,
  type ContagensLidas,
  type CursorDeConversa,
  type CursorDeListagem,
  type DadosDaAtribuicao,
  type DadosDaMensagem,
  type FiltroDeContagem,
  type FiltroDeListagem,
  type FiltroDeOcorrencias,
  type MotivoEncerramentoDeAtribuicao,
  type OcorrenciaCarregada,
  type OcorrenciaLida,
  type OcorrenciaResumoLida,
  type OrdenacaoDeOcorrencias,
  type PaginaDeMensagens,
  type PessoaComPapel,
  type PessoaReferencia,
  type PortasDoRegistro,
  type RepositorioEscopadoDeOcorrencias,
  type ResultadoDaAtribuicao,
  type ResultadoDaAvaliacao,
  type ResultadoDaPrioridade,
  type ResultadoDaSolucaoAplicada,
  type ResultadoDaTransicao,
  type ResultadoDoCompartilhamento,
  type ResultadoDoRegistro,
  type TransicaoLida,
} from "./portas";
export { reivindicarAnexo, type ReferenciaDeAnexo } from "./reivindicar-anexo";
export { registrarOcorrencia, type EntradaDeRegistro } from "./registrar-ocorrencia";
export { registrarSolucaoAplicada } from "./registrar-solucao-aplicada";
export { resolverOcorrencia } from "./resolver-ocorrencia";
export { retomarOcorrencia } from "./retomar-ocorrencia";
export {
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  PAGINA_MAXIMA,
  listarOcorrencias,
  participaDaOcorrencia,
  podeLerOcorrencia,
  recusaDeQuemNaoParticipa,
  verAnexoDaOcorrencia,
  verLinhaDoTempo,
  verOcorrencia,
  verTrilhaDeAuditoria,
  type ContagensDoPainel,
  type EventoLido,
  type PaginaDeOcorrencias,
  type QuemPergunta,
  type VarianteDoAnexo,
  type VisibilidadeAplicada,
} from "./consultas";
