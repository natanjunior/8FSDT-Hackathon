import {
  AvaliacaoExigeResolvida,
  comandosDisponiveis,
  JaAvaliada,
  PrioridadeImutavelEmEstadoTerminal,
  TransicaoNaoPermitida,
  type Comando,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";

import {
  ResponsavelNaoAtribuido,
  SomenteOAutorPodeAvaliar,
  SomenteOGestorCancelaNesteEstado,
} from "./erros";

/**
 * ============================================================================
 *  O que TODO comando de ocorrência precisa — e por que isto saiu do `analisar`
 * ============================================================================
 *
 * Estas duas coisas nasceram privadas em `analisar-ocorrencia.ts`, quando havia **um** comando. A partir
 * do item 19 há dois, e os itens 17, 18, 22, 23, 24, 25, 26 e 27 vêm atrás. **Copiá-las seria a segunda
 * construção do mesmo corpo de `409`** — que é a cópia que sempre diverge.
 */

/**
 * Quem está comandando.
 *
 * **Carrega `permissoes` e deriva o resto.** `podeLerTodas` não entra como segundo campo porque duas
 * fontes para o mesmo fato divergem — e `comandosDisponiveis`, que monta o corpo do `409`, já recebe a
 * lista crua. Permissão é **lista**, nunca papel (contrato §4.5).
 */
export type ContextoDoComando = {
  pessoaId: string;
  /** `Vinculo.permissoes`. */
  permissoes: readonly string[];
  /** ISO 8601. O relógio é lido **uma vez**, e o mesmo instante carimba tudo o que o comando escreve. */
  agora?: string;
};

/**
 * O que a recusa precisa saber da ocorrência — **e nada além**.
 *
 * **Estrutural de propósito.** `Ocorrencia` o satisfaz por ter os dois getters, e um objeto de leitura
 * também. Exigir o agregado obrigaria todo comando futuro a reidratá-lo só para montar um corpo de erro.
 */
export type EstadoDaOcorrencia = {
  status: StatusOcorrencia;
  autorPessoaId: string;
  /**
   * **A metade *"uma vez só"* da invariante 8** — o fato que fechava o **P-3** do plano do item 16.
   *
   * **Estrutural, como os outros dois campos**: `Ocorrencia` o satisfaz pelo getter que o item 27 criou,
   * e `OcorrenciaLida` o satisfaria pelo `avaliacao` que já tem (`portas.ts:74`), sem conversão.
   *
   * **`{ nota: number } | null` e não `Avaliacao | null`**, porque a Aplicação não precisa da classe do
   * Domínio para responder *"já foi?"* — e o tipo mais estreito é o que deixa um modelo de leitura
   * satisfazê-lo.
   */
  avaliacao: { nota: number } | null;
};

/**
 * O agregado (ou qualquer objeto de leitura que responda por ele) **mais o fato de fora dele**.
 *
 * **Estrutural, como `EstadoDaOcorrencia`:** `OcorrenciaCarregada` — o que a porta devolve — é atribuível
 * a este tipo sem nenhuma conversão, porque `Ocorrencia` tem os dois getters. Quem chama passa o valor
 * que já tem na mão, sem desmontar e remontar.
 */
export type EstadoCarregado = {
  ocorrencia: EstadoDaOcorrencia;
  /** A invariante 9. Ver `PerguntaDeAcoes.temResponsavel`. */
  temResponsavel: boolean;
};

/**
 * **A chamada única a `comandosDisponiveis`, e a razão de ela ser única.**
 *
 * As quatro funções públicas abaixo repetiam, copiada, a mesma chamada de quatro linhas. A partir do item
 * 27 são **sete** funções e a chamada tem **cinco** linhas — e a quinta é `jaAvaliada`, que é exatamente
 * o campo que o **P-3** do plano do item 16 previu que alguém esqueceria em uma das cópias: *"se o 27
 * esquecer, o Gestor-autor de uma ocorrência já avaliada verá `avaliar` no corpo de um `409`"*.
 *
 * **Sete cópias de cinco linhas é a duplicação que sempre diverge; uma função é a que não pode.**
 *
 * **`temResponsavel` é o TERCEIRO argumento, e não sai do envelope**, porque é o que permite a
 * `recusaPorFaltaDeResponsavel` continuar forçando `false` — a assimetria que o comentário dela declara
 * e que existe para o corpo não se contradizer.
 */
function acoesQueRestam(
  ocorrencia: EstadoDaOcorrencia,
  ctx: ContextoDoComando,
  temResponsavel: boolean,
): readonly Comando[] {
  return comandosDisponiveis({
    status: ocorrencia.status,
    permissoes: ctx.permissoes,
    ehAutor: ocorrencia.autorPessoaId === ctx.pessoaId,
    temResponsavel,
    jaAvaliada: ocorrencia.avaliacao !== null,
  });
}

/**
 * O corpo do `409`, montado **num lugar só** — as guardas de estado, os conflitos de escrita e as
 * releituras dos dez comandos chegam aqui.
 *
 * **Ela recebe o ENVELOPE desde o item 22**, e não o agregado: `acoesDisponiveis` passou a depender de um
 * fato que o agregado não tem — se há responsável atribuído. Sem ele, o `409` de `analisar` chamado em
 * `em_analise` listaria `iniciar-atendimento` ou o esconderia, e estaria errado num dos dois sentidos.
 *
 * **`jaAvaliada` é informado desde o item 27**, por `acoesQueRestam`: o fato passou a existir dentro do
 * agregado, e com ele o Gestor-autor de uma ocorrência já avaliada deixa de ver `avaliar` na lista do
 * corpo. **É o P-3 do plano do item 16, fechado.**
 */
export function recusaDeTransicao(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): TransicaoNaoPermitida {
  return new TransicaoNaoPermitida(
    carregada.ocorrencia.status,
    acoesQueRestam(carregada.ocorrencia, ctx, carregada.temResponsavel),
  );
}

/**
 * O corpo do **outro** `409` — o da invariante 9 (critério 22.2).
 *
 * **Irmão de `recusaDeTransicao`, e mora aqui pela mesma razão que ela**: duas construções do mesmo corpo
 * em arquivos diferentes seriam a cópia que sempre diverge. As extensões são as **duas** que o exemplo
 * `semResponsavel` do contrato mostra.
 *
 * **Recebe o estado, e não o envelope**, e a assimetria é a informação: `temResponsavel` é **`false` por
 * construção** — é exatamente por isso que estamos aqui. Passar o envelope daria a quem chama a chance de
 * informar `true` e produzir um corpo que se contradiz.
 */
export function recusaPorFaltaDeResponsavel(
  ocorrencia: EstadoDaOcorrencia,
  ctx: ContextoDoComando,
): ResponsavelNaoAtribuido {
  return new ResponsavelNaoAtribuido(ocorrencia.status, acoesQueRestam(ocorrencia, ctx, false));
}

/**
 * O corpo do **terceiro** `409` do produto — o da **invariante 7** (critério 17.2).
 *
 * **Mora aqui pela mesma razão das duas irmãs**: duas construções do mesmo corpo em arquivos diferentes
 * seriam a cópia que sempre diverge. As extensões são as **duas** que o schema `Problema` declara para
 * conflitos de estado — o exemplo publicado da operação traz só `statusAtual`, e isso é falta de exemplo,
 * não de schema (achado A-2 da spec do item 17).
 *
 * **Recebe o ENVELOPE, como `recusaDeTransicao` e ao contrário de `recusaPorFaltaDeResponsavel`.** Lá
 * `temResponsavel` é `false` por construção — é exatamente por isso que se está lá. **Aqui não há fato
 * construído:** a ocorrência terminal pode ter tido responsável ou não, e o corpo tem de dizer a verdade
 * sobre o que sobrou.
 *
 * **`jaAvaliada` é informado desde o item 27**, por `acoesQueRestam` — ver `recusaDeTransicao`.
 */
export function recusaPorPrioridadeImutavel(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): PrioridadeImutavelEmEstadoTerminal {
  return new PrioridadeImutavelEmEstadoTerminal(
    carregada.ocorrencia.status,
    acoesQueRestam(carregada.ocorrencia, ctx, carregada.temResponsavel),
  );
}

/**
 * O **quarto** construtor de corpo, e o primeiro que não é de `409`: o `403` do critério **18.3**.
 *
 * **Ele existe por causa de um furo da spec, e a nota fica onde ele foi fechado.** A §3.7 da spec do
 * item 18 dizia que a lista deste erro *"sai por `recusaDeTransicao`"* — e `recusaDeTransicao` constrói
 * `TransicaoNaoPermitida`, uma classe com **outro código e outro status HTTP**. Chamá-la aqui devolveria
 * `409` onde o `openapi.yaml` publica `403`, que é divergência entre a especificação versionada e o
 * código — o portão do DoD. O que a spec quis dizer é que a **lista** vem de `comandosDisponiveis`, que
 * é o que as três irmãs já fazem.
 *
 * **Mora aqui pela mesma razão das três**: duas construções do mesmo corpo em arquivos diferentes seriam
 * a cópia que sempre diverge.
 *
 * **Recebe o ENVELOPE**, como `recusaDeTransicao` e `recusaPorPrioridadeImutavel`, e não o estado nu: não
 * há fato construído aqui — a ocorrência em `em_atendimento` **tem** responsável na prática, e o corpo
 * tem de dizer a verdade sobre o que sobrou (que, para o Solicitante autor, é `[]`).
 *
 * **`jaAvaliada` é informado desde o item 27**, por `acoesQueRestam` — ver `recusaDeTransicao`.
 */
export function recusaPorEstadoDeCancelamento(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): SomenteOGestorCancelaNesteEstado {
  return new SomenteOGestorCancelaNesteEstado(
    carregada.ocorrencia.status,
    acoesQueRestam(carregada.ocorrencia, ctx, carregada.temResponsavel),
  );
}

/**
 * O **quinto** construtor de corpo, e o segundo que não é de `409`: o `403` do critério **27.3**.
 *
 * **Mora aqui pela mesma razão das quatro**: duas construções do mesmo corpo em arquivos diferentes
 * seriam a cópia que sempre diverge.
 *
 * **Recebe o ENVELOPE**, como três das quatro: não há fato construído aqui — a ocorrência em `resolvida`
 * pode ter tido responsável ou não, e o corpo tem de dizer a verdade sobre o que sobrou (que, para o
 * Gestor não-autor, é `[]`).
 */
export function recusaPorNaoSerOAutor(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): SomenteOAutorPodeAvaliar {
  return new SomenteOAutorPodeAvaliar(
    carregada.ocorrencia.status,
    acoesQueRestam(carregada.ocorrencia, ctx, carregada.temResponsavel),
  );
}

/** O **sexto** — a metade de ESTADO da invariante 8 (critério 27.2). */
export function recusaPorAvaliacaoExigeResolvida(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): AvaliacaoExigeResolvida {
  return new AvaliacaoExigeResolvida(
    carregada.ocorrencia.status,
    acoesQueRestam(carregada.ocorrencia, ctx, carregada.temResponsavel),
  );
}

/**
 * O **sétimo**, e o último — a metade *"uma vez só"* da invariante 8 (critério 27.2).
 *
 * **Aqui `acoesQueRestam` responde `[]` por construção**, e é a conferência de que o P-3 fechou: se
 * `jaAvaliada` não fosse informado, este corpo listaria `avaliar` — o comando que acabou de ser recusado
 * por já ter acontecido. **O erro que se contradiz é exatamente o que o item 16 previu.**
 */
export function recusaPorJaAvaliada(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): JaAvaliada {
  return new JaAvaliada(
    carregada.ocorrencia.status,
    acoesQueRestam(carregada.ocorrencia, ctx, carregada.temResponsavel),
  );
}
