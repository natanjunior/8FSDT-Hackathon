/** Superfície pública do módulo `aplicacao/contexto` (ADR-0006, regra 3). */
export {
  NOME_AUSENTE,
  contextoDaRequisicao,
  resolverContexto,
  type ContextoDaRequisicao,
  type ContextoDaSessao,
  type ResolucaoDeContexto,
} from "./resolver-contexto";

export { corrigirPessoa, type ComandoDeCorrecaoDePessoa } from "./corrigir-pessoa";

export { escolherOrganizacaoAtiva } from "./escolher-organizacao-ativa";

export {
  NaoAutenticado,
  SemOrganizacaoAtiva,
  SemVinculoNaOrganizacao,
} from "./erros";

export type {
  EscolhaDaSessao,
  PessoaReferencia,
  PortaDeAutenticacao,
  PortasGlobais,
  RepositorioDePessoas,
  RepositorioGlobalDeVinculos,
  RepositoriosEscopados,
  SessaoDoProvedor,
  VinculoNaOrganizacao,
} from "./portas";
