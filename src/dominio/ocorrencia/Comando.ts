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
 * Anunciar um comando numa lista que T-05 renderiza *"exatamente, e nada além"* produziria um botão que
 * responde `404` — um status que o contrato não prevê ali.
 *
 * **Isto não é `[]` chumbado.** A derivação em `MaquinaDeEstados.ts` é real e completa; este filtro é a
 * última etapa dela. **Cada item de 16 a 27 acrescenta o próprio comando aqui — uma linha — e a
 * derivação já está pronta e testada.**
 *
 * **O item 16 foi o primeiro a fazê-lo**, e o momento importa: a linha entra na tarefa que cria o
 * `route.ts`, nunca antes. Anunciar um comando cujo endpoint ainda não existe produz um botão que
 * responde `404`, status que o contrato não prevê em T-05.
 *
 * **O item 19 foi o segundo**, e com ele a barra de T-05 passa a renderizar **dois** botões pela primeira
 * vez. A linha entra na tarefa que cria o `route.ts`, nunca antes.
 *
 * **O item 22 foi o terceiro**, e com ele `acoesDisponiveis` passa a depender de um fato que **não é
 * status nem permissão**: a invariante 9. A linha entra na tarefa que cria o `route.ts`, nunca antes.
 *
 * **O item 26 foi o quarto**, e com ele `resolvida` passa a ser alcançável — o **primeiro estado
 * terminal do produto**, do qual `acoesDisponiveis` sai vazia por derivação e não por comando faltando.
 * A linha entra na tarefa que cria o `route.ts`, nunca antes.
 *
 * **O item 23 foi o quinto**, e com ele `pausada` passa a ser alcançável — o **primeiro desvio que
 * retorna**, e o estado de onde o item 24 vai sair. **A linha entrou na tarefa da TELA, e não na do
 * `route.ts`**, e a diferença é a que a regra existe para proteger: `pausar` é o primeiro comando com
 * `requestBody: required: true`, então um botão sem formulário responderia `400` em vez de funcionar.
 * A regra continua sendo *"nunca antes de o comando existir"* — o que mudou é que, para ele, existir é
 * ter endpoint **e** forma.
 *
 * **O item 24 foi o sexto**, e com ele `pausada` deixa de ser um beco: o par `pausar → retomar` fecha,
 * e a barra daquele estado passa a desenhar **dois** botões. **A linha entrou na tarefa da TELA**, como
 * a do 23, mas por outra razão — o argumento do 23 era o corpo obrigatório, e aqui o corpo é opcional,
 * então um botão nu responderia `200`. O que decide é o inventário: `retomar` é um dos **cinco modais**
 * da restrição herdada nº 1, e um botão nu gravaria um registro imutável e visível ao Solicitante sem
 * oferecer o campo e sem mostrar o aviso de visibilidade. Custo de decidir assim: zero — mesma fatia,
 * um commit depois.
 *
 * **O item 25 foi o sétimo, e é o primeiro cuja FORMA não é botão.** `registrar-solucao-aplicada` é campo
 * no corpo de T-05 (`inventario-de-telas.md`), então ele nunca entra em `ROTULO_DE_COMANDO` e a barra
 * nunca o renderiza. **A linha entrou na tarefa do `route.ts`, e não na da tela** — ao contrário do 23 e
 * do 24: o argumento daqueles era um botão nu fazendo a coisa errada, e aqui não há botão nenhum. A regra
 * geral volta a valer sem exceção: anuncia-se o comando quando o endpoint existe.
 */
export const COMANDOS_IMPLEMENTADOS: readonly Comando[] = [
  "analisar",
  "atribuir-responsavel",
  "iniciar-atendimento",
  "pausar",
  "retomar",
  "registrar-solucao-aplicada",
  "resolver",
];
