/** Superfície pública do módulo `aplicacao/contexto` (ADR-0006, regra 3). */
export {
  NOME_AUSENTE,
  contextoDaRequisicao,
  resolverContexto,
  type ContextoDaRequisicao,
  type ContextoDaSessao,
  type ResolucaoDeContexto,
} from "./resolver-contexto";

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
  RepositorioEscopadoDeVinculos,
  RepositorioGlobalDeVinculos,
  RepositoriosEscopados,
  SessaoDoProvedor,
  VinculoNaOrganizacao,
} from "./portas";
