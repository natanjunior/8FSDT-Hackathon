/**
 * Superfície pública de `interface/http`.
 *
 * `semOrganizacao` é exportado daqui, mas **o lint só permite importá-lo nos cinco `route.ts` da lista
 * fechada da §4.4 do contrato** — ver `eslint.config.mjs`. É a lista enumerável da ADR-0003 virada
 * mecanismo, em vez de comentário.
 *
 * **São QUATRO listas fechadas, e as quatro são independentes.** `portasDeAnexo` é a segunda, com um
 * arquivo só — o que emite credencial de upload. `armazenamentoDeAnexos` é a terceira, com dois: os que
 * reivindicam e os que leem anexo. `semSessao` e `resolverConviteParaTela` são a quarta, com dois
 * arquivos: a rota e a página do convite. Independentes quer dizer que nenhum bloco do lint herda a folga
 * de outro: os cinco da §4.4 não podem importar as duas de anexo, quem emite credencial não pode importar
 * `semOrganizacao` nem `armazenamentoDeAnexos`, e quem lê anexo não pode emitir credencial.
 */
export { portasDeAnexo } from "./portas-de-anexo";
export { armazenamentoDeAnexos } from "./armazenamento-de-anexos";

export {
  armazenamentoDeCookies,
  comContexto,
  lerCorpoOpcional,
  registrarFalha,
  resolverConviteParaTela,
  resolverEscopoParaTela,
  resolverParaTela,
  resposta,
  semOrganizacao,
  semSessao,
  type EntradaEscopada,
  type EntradaSemOrganizacao,
  type EntradaSemSessao,
  type EscopoDaTela,
} from "./com-contexto";

export {
  CampoNaoSuportado,
  comOrganizacaoAtiva,
  CorpoNaoSuportado,
  FormatoInvalido,
  OrganizacaoDivergente,
  problemaDe,
  respostaDeProblema,
  type ErroDeCampo,
} from "./problema";

export { destinoSeguro } from "./destino-seguro";
export {
  destinoDoConvite,
  linkDoConvite,
  linkDoQrDaArea,
  montarLinkDoConvite,
  montarLinkDoQrDaArea,
} from "./link-do-convite";

export { recusarEvolucaoPrevista, recusarSemDestino } from "./recusa-de-campos";

export {
  NOME_DO_COOKIE,
  assinarOrganizacao,
  lerOrganizacaoAssinada,
} from "./cookie-de-organizacao";

export {
  CAMINHO_DA_CONFIRMACAO,
  aterrissarConfirmacaoDeConta,
  destinoDeConfirmacao,
  montarDestinoDeConfirmacao,
  origemDoPedido,
} from "./confirmacao-de-conta";

export {
  PREFIXO_DE_REDEFINICAO,
  armazenamentoDeRedefinicao,
  aterrissarRedefinicaoDeSenha,
  somenteDeRedefinicao,
} from "./redefinicao-de-senha";

export { lerOcorrenciaDaTela, tituloDeAbaDaOcorrencia } from "./ocorrencia-da-tela";

export { novoTraceId } from "./traco";

export { registrarLeituraDeQuemAgiu } from "./leitura-de-quem-agiu";

export {
  algumFiltroAplicado,
  consultaDe,
  lerBooleanoDaUrl,
  lerCursorDeConversaDaUrl,
  lerBuscaDeCandidatosDaUrl,
  lerFiltroDeOcorrenciasDaUrl,
  lerJanelaDoDashboardDaUrl,
  lerLimiteDaUrl,
  lerOrdenacaoDeOcorrenciasDaUrl,
  lerPaginacaoDaUrl,
  lerSituacoesDaUrl,
  lerVarianteDaUrl,
  trocarJanelaInvertida,
  type PaginacaoDaUrl,
} from "./consulta-de-url";
