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
  "iniciar-atendimento": "Iniciar atendimento",
};

/** `null` quando o comando não é botão desta barra — ou porque não foi construído, ou porque a forma
 *  dele é outra. */
export function rotuloDeComando(comando: Comando): string | null {
  return ROTULO_DE_COMANDO[comando] ?? null;
}

/**
 * ============================================================================
 *  Qual ação ganha ênfase em T-05 — o achado **R-08**, decidido em 28/08/2026
 * ============================================================================
 *
 * O contrato §8.5 declara a ordem de `acoesDisponiveis` e diz, em letra, que *"não é promessa de
 * destaque: qual ação ganha ênfase é decisão de tela"*. **Esta é a decisão de tela**, e ela mora aqui
 * porque `rotulos.ts` já é o módulo do que a tela sabe sobre comandos.
 *
 * **É uma tabela por status, e não uma derivação por `transicaoPermitida`.** A derivação erraria em dois
 * estados: em `em_atendimento` daria *Pausar* em vez de *Resolver*, e em `em_analise` **sem** responsável
 * daria *Pausar* em vez de *Atribuir*, porque `atribuir-responsavel` mora na tabela companheira e a
 * derivação o pula. Uma regra que acerta por coincidência nos estados de hoje é como o R-08 nasceu.
 *
 * **Entrada cujo comando ainda não existe é INERTE**, e é o que permite escrevê-la completa hoje: a
 * tabela não anuncia botão nenhum — quem decide o que aparece é `COMANDOS_IMPLEMENTADOS`. Ela só diz qual
 * das ações **já renderizadas** ganha ênfase. **Consequência: os itens 23 a 27 não a editam.**
 *
 * **O conserto do documento não é desta fatia** — o inventário de telas não tem esta regra, e isso é o
 * item 17 da `trabalho/fila-documentacao.md`.
 */
const ACAO_PRIMARIA: Readonly<Record<StatusOcorrencia, Comando | null>> = {
  aberta: "analisar",
  em_analise: "iniciar-atendimento",
  em_atendimento: "resolver",
  pausada: "retomar",
  resolvida: "avaliar",
  cancelada: null,
};

/**
 * O comando em destaque, dado o status e o que a tela **consegue** renderizar.
 *
 * **O desempate:** se o comando nomeado não está entre os renderizáveis, o primário é o **primeiro
 * renderizável**; se não há nenhum, não há primário.
 *
 * **Recebe `readonly string[]` e devolve `string | null`**, e não `Comando`: quem consome é a barra, que
 * é componente de cliente e não importa tipo do Domínio. A tabela acima é tipada de verdade — é ela que
 * o compilador cobra quando um status novo nascer.
 */
export function acaoPrimaria(
  status: StatusOcorrencia,
  renderizaveis: readonly string[],
): string | null {
  const nomeada = ACAO_PRIMARIA[status];
  if (nomeada !== null && renderizaveis.includes(nomeada)) return nomeada;
  return renderizaveis[0] ?? null;
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
