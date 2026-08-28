import { STATUS, type Comando, type Prioridade, type StatusOcorrencia } from "@/dominio/ocorrencia";
import { nomeDoStatus, rotuloDeStatus } from "@/interface/projecoes";

/**
 * A prioridade **em palavra**, que é o compromisso **A-5**: *"`prioridade`, `status` e `motivoPausa`
 * sempre carregam a palavra. Marcador colorido sem texto é defeito, em qualquer tela."*
 *
 * **Mora num módulo, e não dentro da tela**, porque três telas a exibem: T-03 (aqui), T-05 (o bloco de
 * identidade) e a barra de filtros do item 15, cujo chip diz *"Prioridade: Alta"*. A terceira cópia é
 * sempre a que diverge.
 */
export function rotuloDePrioridade(prioridade: Prioridade): string {
  return { baixa: "Baixa", normal: "Normal", alta: "Alta" }[prioridade];
}

/**
 * ============================================================================
 *  O rótulo do BOTÃO — e por que ele é parcial de propósito
 * ============================================================================
 *
 * **Só os comandos construídos aparecem aqui**, e cada item de 17 a 27 acrescenta o próprio. Escrever
 * agora os dez rótulos seria texto de produto nascendo dez itens antes do item que o entrega — e o
 * conjunto que a barra pode renderizar já é decidido por `COMANDOS_IMPLEMENTADOS`, não por este mapa.
 *
 * **O esquecimento é alto, não silencioso:** o teste de interface percorre `COMANDOS_IMPLEMENTADOS` e
 * exige rótulo para cada um.
 *
 * **Dois comandos nunca vão entrar aqui**, e não é esquecimento: `alterar-prioridade` é **seletor no bloco
 * de identidade** e `registrar-solucao-aplicada` é **campo no corpo da tela** (`inventario-de-telas.md`).
 * Botão não é a forma deles.
 */
const ROTULO_DE_COMANDO: Partial<Record<Comando, string>> = {
  analisar: "Analisar",
  "atribuir-responsavel": "Atribuir",
};

/** `null` quando o comando não é botão desta barra — ou porque não foi construído, ou porque a forma
 *  dele é outra. */
export function rotuloDeComando(comando: Comando): string | null {
  return ROTULO_DE_COMANDO[comando] ?? null;
}

/**
 * Os rótulos de status **prontos**, para descer por prop até um componente de cliente.
 *
 * **O navegador não monta rótulo** — é a mesma decisão da barra de filtros do item 15. E é mais que
 * estilo: importar `rotuloDeStatus` de dentro do componente de cliente arrastaria `@/interface/projecoes`
 * e, com ele, `comandosDisponiveis` — a máquina de estados inteira para dentro do pacote do navegador,
 * que é literalmente a **segunda cópia** que `acoesDisponiveis` existe para impedir.
 *
 * **A coluna do Solicitante**, e `pausada` degrada para *"Parada"*: quem consome isto é a frase do `409`,
 * que tem `statusAtual` e não tem motivo de pausa.
 */
export function rotulosDeStatus(): Record<StatusOcorrencia, string> {
  return Object.fromEntries(STATUS.map((status) => [status, rotuloDeStatus(status, null)])) as Record<
    StatusOcorrencia,
    string
  >;
}

/**
 * Os **nomes** de status — a coluna do Gestor do glossário §4.
 *
 * Existe separada de `rotulosDeStatus` porque responde outra pergunta, e porque é a única das duas que
 * **sobrevive dentro de uma frase**: *"De **Aberta** para **Em análise**"*. A coluna do Solicitante é ela
 * própria uma oração — *"Recebida — aguardando análise"* —, e embutida em *"De X para Y"* produz texto
 * que ninguém lê.
 */
export function nomesDeStatus(): Record<StatusOcorrencia, string> {
  return Object.fromEntries(STATUS.map((status) => [status, nomeDoStatus(status)])) as Record<
    StatusOcorrencia,
    string
  >;
}
