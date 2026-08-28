import { comandosDisponiveis, TransicaoNaoPermitida, type StatusOcorrencia } from "@/dominio/ocorrencia";

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
 * O corpo do `409`, montado **num lugar só** — as guardas de estado, os conflitos de escrita e as
 * releituras dos dez comandos chegam aqui.
 *
 * **`jaAvaliada` não é informado, e a omissão é declarada:** ela só muda a presença de `avaliar`, que é
 * filtrado por `COMANDOS_IMPLEMENTADOS` enquanto o item 27 não existir. É o **item 27** que traz a
 * avaliação para dentro do agregado, porque é ele que precisa dela para o próprio comando.
 */
export function recusaDeTransicao(
  ocorrencia: EstadoDaOcorrencia,
  ctx: ContextoDoComando,
): TransicaoNaoPermitida {
  return new TransicaoNaoPermitida(
    ocorrencia.status,
    comandosDisponiveis({
      status: ocorrencia.status,
      permissoes: ctx.permissoes,
      ehAutor: ocorrencia.autorPessoaId === ctx.pessoaId,
    }),
  );
}
