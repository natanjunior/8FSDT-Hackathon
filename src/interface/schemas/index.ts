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
  definirSenhaSchema,
  email,
  entrarSchema,
  nomeDePessoa,
  pedirRedefinicaoSchema,
  senha,
  type EntradaDeCadastro,
  type EntradaDeLogin,
  type EntradaDeNovaSenha,
  type EntradaDeRedefinicao,
} from "./credencial";

export {
  criacaoDeOrganizacaoSchema,
  nomeDeOrganizacao,
  type EntradaDeCriacaoDeOrganizacao,
} from "./organizacao";

export {
  MENSAGEM_DE_TELEFONE,
  aprovacaoDePedidoSchema,
  codigoPublico,
  pedidoDeEntradaSchema,
  recusaDePedidoSchema,
  telefoneE164,
  type EntradaDeAprovacao,
  type EntradaDePedidoDeEntrada,
  type EntradaDeRecusa,
} from "./pedido-de-entrada";

export {
  cadastroDeVinculoSchema,
  contatosParaEscritaSchema,
  correcaoDeVinculoSchema,
  type EntradaDeCadastroDeVinculo,
  type EntradaDeCorrecaoDeVinculo,
} from "./vinculo";

export {
  ICONES_DE_CATEGORIA,
  correcaoDeAreaSchema,
  correcaoDeCategoriaSchema,
  criacaoDeAreaSchema,
  criacaoDeCategoriaSchema,
  iconeDeCategoria,
  type EntradaDeCorrecaoDeArea,
  type EntradaDeCorrecaoDeCategoria,
  type EntradaDeCriacaoDeArea,
  type EntradaDeCriacaoDeCategoria,
} from "./configuracao";
