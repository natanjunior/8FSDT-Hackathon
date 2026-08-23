/**
 * Superfície pública de `interface/schemas`.
 *
 * **O lugar único dos schemas de validação** (ADR-0006, justificativa 5): o `zod` que valida o campo no
 * formulário é o mesmo que, quando o portão da §15 do contrato entrar, gera o `openapi.yaml`. Enquanto
 * `GET /contexto` é o único endpoint e ele **não recebe corpo**, não há schema de entrada de API a gerar —
 * ver a decisão sobre o portão no relatório desta tarefa.
 */
export {
  criarContaSchema,
  email,
  entrarSchema,
  nomeDePessoa,
  senha,
  type EntradaDeCadastro,
  type EntradaDeLogin,
} from "./credencial";

export {
  criacaoDeOrganizacaoSchema,
  nomeDeOrganizacao,
  type EntradaDeCriacaoDeOrganizacao,
} from "./organizacao";

export {
  codigoPublico,
  pedidoDeEntradaSchema,
  telefoneE164,
  type EntradaDePedidoDeEntrada,
} from "./pedido-de-entrada";
