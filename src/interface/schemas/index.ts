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
  correcaoDeOrganizacaoSchema,
  criacaoDeOrganizacaoSchema,
  nomeDeOrganizacao,
  trocaDeOrganizacaoSchema,
  type EntradaDeCorrecaoDeOrganizacao,
  type EntradaDeCriacaoDeOrganizacao,
  type EntradaDeTrocaDeOrganizacao,
} from "./organizacao";

export { correcaoDePessoaSchema, type EntradaDeCorrecaoDePessoa } from "./pessoa";

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
  alteracaoDePrioridadeSchema,
  atribuicaoDeResponsavelSchema,
  avaliacaoSchema,
  cancelamentoSchema,
  camposDeEvolucaoPrevista,
  camposEscritosPeloServidor,
  camposSemDestino,
  comandoComObservacaoSchema,
  comentarioSchema,
  pausaSchema,
  registroDeOcorrenciaSchema,
  resolucaoSchema,
  solucaoAplicadaSchema,
  type EntradaDeAlteracaoDePrioridade,
  type EntradaDeAtribuicaoDeResponsavel,
  type EntradaDeAvaliacao,
  type EntradaDeCancelamento,
  type EntradaDeComandoComObservacao,
  type EntradaDeComentario,
  type EntradaDePausa,
  type EntradaDeRegistroDeOcorrencia,
  type EntradaDeResolucao,
  type EntradaDeSolucaoAplicada,
} from "./ocorrencia";

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
  reordenacaoSchema,
  type EntradaDeCorrecaoDeArea,
  type EntradaDeCorrecaoDeCategoria,
  type EntradaDeCriacaoDeArea,
  type EntradaDeCriacaoDeCategoria,
  type EntradaDeReordenacao,
  type NomeDeIcone,
} from "./configuracao";

export {
  TETO_DE_BYTES_DO_ANEXO,
  pedidoDeAutorizacaoSchema,
  type EntradaDePedidoDeAutorizacao,
} from "./anexo";
