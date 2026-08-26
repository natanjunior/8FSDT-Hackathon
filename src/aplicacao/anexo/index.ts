/** Superfície pública do módulo `aplicacao/anexo`. */
export { LimiteDeAutorizacoesDeUpload } from "./erros";
export {
  JANELA_EM_SEGUNDOS,
  LIMITE_POR_HORA,
  autorizarUploadDeAnexo,
} from "./autorizar-upload";
export type {
  AutorizacaoEmitida,
  CredencialDeUpload,
  EmissorDeCredencialDeUpload,
  LivroDeAutorizacoesDeUpload,
  PedidoDeAutorizacao,
  PortasDeAnexo,
  ResultadoDoLimite,
} from "./portas";
