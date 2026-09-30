/**
 * ============================================================================
 *  O trabalhador de serviço: o que servidor, trabalhador, casca e cliente dividem — item 98
 * ============================================================================
 *
 * **Sem importação nenhuma**, porque este arquivo entra em componente de cliente. O script do trabalhador
 * (`script.ts`) usa `node:crypto` e não pode ir junto.
 */

/** Onde o script é servido. Na raiz, para que o escopo `/` valha sem cabeçalho extra. */
export const CAMINHO_DO_TRABALHADOR = "/sw.js";

/**
 * **As duas únicas entradas do cache**, e a lista é o critério 98.2. Endereços sintéticos: nada do servidor
 * responde neles, e o trabalhador nunca os pede à rede.
 */
export const URL_DA_CASCA = "/__trabalhador/casca";
export const URL_DA_HORA = "/__trabalhador/ultima-resposta";

/** O nome do cache é este prefixo mais a versão; a ativação apaga todo cache de outro nome. */
export const PREFIXO_DO_CACHE = "resolve-ai-casca-";

/**
 * **Acima disto, o contêiner é dado como dormindo, e a casca aparece na hora.** Abaixo do `cooldownPeriod`
 * de 300 s de propósito: errar para baixo custa meio segundo de casca à toa; errar para cima deixaria a
 * pessoa esperando a rede com o contêiner em zero, que é o que o item existe para evitar (spec 98 §4.3).
 */
export const LIMIAR_DE_FRIO_MS = 240_000;

/**
 * **Com resposta recente, a rede tem este prazo antes da casca.** Cobre o contêiner que dorme fora da conta,
 * como a revisão nova de um deploy. Dez vezes o quente medido, e acima da ida ao banco que toda tela de
 * dentro faz antes do primeiro byte.
 */
export const PRAZO_DA_REDE_MS = 3_000;

/** A mesma URL pedida de novo dentro disto, depois de uma casca, vai à rede sem prazo: é a recarga. */
export const JANELA_CONTRA_LACO_MS = 30_000;

/** A sonda da casca: um arquivo público que o Node serve sem tocar banco nem sessão. */
export const SONDA = "/robots.txt";
export const CABECALHO_DA_SONDA = "x-resolve-ai-sonda";
export const INTERVALO_DA_SONDA_MS = 2_000;

/** A mensagem que a página manda ao trabalhador na saída, e quanto espera pela resposta dele. */
export const MENSAGEM_DE_LIMPEZA = "limpar";
export const PRAZO_DA_LIMPEZA_MS = 2_000;

/** `acaoDeSair` redireciona para `/entrar?saiu=1`; é o sinal que `LimpezaDaSaida` lê. */
export const PARAMETRO_DA_SAIDA = "saiu";

export const FRASE_ABRINDO = "Abrindo o Resolve Aí…";
export const FRASE_SEM_CONEXAO = "Sem conexão. A tela abre quando ela voltar.";
