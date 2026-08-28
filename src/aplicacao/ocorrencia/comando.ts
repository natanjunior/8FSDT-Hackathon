import {
  comandosDisponiveis,
  PrioridadeImutavelEmEstadoTerminal,
  TransicaoNaoPermitida,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";

import { ResponsavelNaoAtribuido } from "./erros";

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
 * O corpo do `409`, montado **num lugar só** — as guardas de estado, os conflitos de escrita e as
 * releituras dos dez comandos chegam aqui.
 *
 * **Ela recebe o ENVELOPE desde o item 22**, e não o agregado: `acoesDisponiveis` passou a depender de um
 * fato que o agregado não tem — se há responsável atribuído. Sem ele, o `409` de `analisar` chamado em
 * `em_analise` listaria `iniciar-atendimento` ou o esconderia, e estaria errado num dos dois sentidos.
 *
 * **`jaAvaliada` não é informado, e a omissão é declarada:** ela só muda a presença de `avaliar`, que é
 * filtrado por `COMANDOS_IMPLEMENTADOS` enquanto o item 27 não existir. É o **item 27** que traz a
 * avaliação para dentro do agregado, porque é ele que precisa dela para o próprio comando.
 */
export function recusaDeTransicao(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): TransicaoNaoPermitida {
  return new TransicaoNaoPermitida(
    carregada.ocorrencia.status,
    comandosDisponiveis({
      status: carregada.ocorrencia.status,
      permissoes: ctx.permissoes,
      ehAutor: carregada.ocorrencia.autorPessoaId === ctx.pessoaId,
      temResponsavel: carregada.temResponsavel,
    }),
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
  return new ResponsavelNaoAtribuido(
    ocorrencia.status,
    comandosDisponiveis({
      status: ocorrencia.status,
      permissoes: ctx.permissoes,
      ehAutor: ocorrencia.autorPessoaId === ctx.pessoaId,
      temResponsavel: false,
    }),
  );
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
 * **`jaAvaliada` não é informado, e a omissão é declarada** — mesma razão de `recusaDeTransicao`: ela só
 * muda a presença de `avaliar`, que `COMANDOS_IMPLEMENTADOS` filtra até o item 27 existir.
 */
export function recusaPorPrioridadeImutavel(
  carregada: EstadoCarregado,
  ctx: ContextoDoComando,
): PrioridadeImutavelEmEstadoTerminal {
  return new PrioridadeImutavelEmEstadoTerminal(
    carregada.ocorrencia.status,
    comandosDisponiveis({
      status: carregada.ocorrencia.status,
      permissoes: ctx.permissoes,
      ehAutor: carregada.ocorrencia.autorPessoaId === ctx.pessoaId,
      temResponsavel: carregada.temResponsavel,
    }),
  );
}
