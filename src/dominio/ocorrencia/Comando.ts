/**
 * Os dez comandos com endpoint, **na ordem do enum `Comando` do contrato** — que é estável e
 * significativa: os que movem a ocorrência adiante vêm na sequência do ciclo de vida, e os que não movem
 * (`alterar-prioridade` e `cancelar`) vêm por último.
 *
 * Isso existe para que o cliente **não mantenha uma segunda lista só para ordenar botões**. Não é
 * promessa de destaque: em `em_atendimento`, `pausar` precede `resolver`, e qual ganha ênfase é decisão
 * de tela.
 */
export const COMANDOS = [
  "analisar",
  "atribuir-responsavel",
  "iniciar-atendimento",
  "pausar",
  "retomar",
  "registrar-solucao-aplicada",
  "resolver",
  "avaliar",
  "alterar-prioridade",
  "cancelar",
] as const;

export type Comando = (typeof COMANDOS)[number];

/**
 * ============================================================================
 *  Os comandos que **existem** hoje — e por que esta lista precisa existir
 * ============================================================================
 *
 * A §8.5 do contrato dá uma garantia: *"um comando **ausente** de `acoesDisponiveis` é um comando que
 * **vai responder `409` ou `422`** se for chamado"*. Lida ao contrário: **comando presente é comando
 * cujo endpoint existe.**
 *
 * Nenhum dos dez foi construído ainda. Anunciar `analisar` numa lista que T-05 renderiza *"exatamente, e
 * nada além"* produziria um botão que responde `404` — um status que o contrato não prevê ali.
 *
 * **Isto não é `[]` chumbado.** A derivação em `MaquinaDeEstados.ts` é real e completa; este filtro é a
 * última etapa dela. **Cada item de 16 a 27 acrescenta o próprio comando aqui — uma linha — e a
 * derivação já está pronta e testada.**
 */
export const COMANDOS_IMPLEMENTADOS: readonly Comando[] = [];
