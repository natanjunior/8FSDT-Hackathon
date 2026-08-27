/** Superfície pública do módulo `aplicacao/anexo`. */
export {
  AnexoAcimaDoLimite,
  AnexoNaoEncontrado,
  AnexoNaoReconhecido,
  LimiteDeAutorizacoesDeUpload,
} from "./erros";
export {
  JANELA_EM_SEGUNDOS,
  LIMITE_POR_HORA,
  autorizarUploadDeAnexo,
} from "./autorizar-upload";
export type {
  ArmazenamentoDeAnexos,
  AutorizacaoEmitida,
  CargaDoTicketDeAnexo,
  CredencialDeUpload,
  EmissorDeCredencialDeUpload,
  LivroDeAutorizacoesDeUpload,
  ObjetoDescrito,
  PedidoDeAutorizacao,
  PortasDeAnexo,
  ResultadoDoLimite,
} from "./portas";
