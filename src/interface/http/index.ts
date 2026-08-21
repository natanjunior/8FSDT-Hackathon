/**
 * Superfície pública de `interface/http`.
 *
 * `semOrganizacao` é exportado daqui, mas **o lint só permite importá-lo nos quatro `route.ts` da lista
 * fechada da §4.4 do contrato** — ver `eslint.config.mjs`. É a lista enumerável da ADR-0003 virada
 * mecanismo, em vez de comentário.
 */
export {
  armazenamentoDeCookies,
  comContexto,
  resolverParaTela,
  resposta,
  semOrganizacao,
  type EntradaEscopada,
  type EntradaSemOrganizacao,
} from "./com-contexto";

export {
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

export { novoTraceId } from "./traco";
