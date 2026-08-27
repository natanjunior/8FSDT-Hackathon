/**
 * Superfície pública de `interface/http`.
 *
 * `semOrganizacao` é exportado daqui, mas **o lint só permite importá-lo nos quatro `route.ts` da lista
 * fechada da §4.4 do contrato** — ver `eslint.config.mjs`. É a lista enumerável da ADR-0003 virada
 * mecanismo, em vez de comentário.
 *
 * **`portasDeAnexo` é a segunda lista fechada**, com um arquivo só, e as duas são independentes: nenhum
 * dos quatro da §4.4 pode importá-la, e o `route.ts` do anexo não pode importar `semOrganizacao`.
 */
export { portasDeAnexo } from "./portas-de-anexo";

export {
  armazenamentoDeCookies,
  comContexto,
  resolverEscopoParaTela,
  resolverParaTela,
  resposta,
  semOrganizacao,
  type EntradaEscopada,
  type EntradaSemOrganizacao,
  type EscopoDaTela,
} from "./com-contexto";

export {
  CampoNaoSuportado,
  CorpoNaoSuportado,
  FormatoInvalido,
  OrganizacaoDivergente,
  problemaDe,
  respostaDeProblema,
  type ErroDeCampo,
} from "./problema";

export {
  NOME_DO_COOKIE,
  assinarOrganizacao,
  lerOrganizacaoAssinada,
} from "./cookie-de-organizacao";

export { aterrissarConfirmacaoDeConta } from "./confirmacao-de-conta";

export {
  PREFIXO_DE_REDEFINICAO,
  armazenamentoDeRedefinicao,
  aterrissarRedefinicaoDeSenha,
  somenteDeRedefinicao,
} from "./redefinicao-de-senha";

export { novoTraceId } from "./traco";

export {
  algumFiltroAplicado,
  consultaDe,
  lerBooleanoDaUrl,
  lerCursorDaUrl,
  lerFiltroDeOcorrenciasDaUrl,
  lerLimiteDaUrl,
  lerSituacoesDaUrl,
} from "./consulta-de-url";
