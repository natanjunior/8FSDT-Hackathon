import {
  ehTerminal,
  STATUS,
  type Comando,
  type Prioridade,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";
import { nomeDoStatus, rotuloDeStatus } from "@/interface/projecoes";

/**
 * ============================================================================
 *  O aviso de visibilidade — **restrição herdada nº 1** do inventário de telas
 * ============================================================================
 *
 * *"Todo modal que tem campo `observacao` — `pausar`, `cancelar`, `resolver`, `iniciar-atendimento`,
 * `retomar` — mostra, junto ao campo e antes de ele ser preenchido"*, esta frase. **Duas frases porque
 * os dois fatos importam**: quem lê, e que é final.
 *
 * **Ela morava em `modal-de-observacao.tsx` e mudou para cá no item 23** — o achado **A-5** da spec do
 * item 22, que deixou o lugar definitivo para o item que descobrisse se aquele componente serve para
 * `pausar`. **Não serve** (o formulário tem escolha obrigatória), então a constante passou a ter três
 * consumidores e um componente importando texto de um componente irmão deixou de ser defensável.
 *
 * **`rotulos.ts` é o módulo do texto pronto que os componentes consomem**, e já guarda **frase de
 * produto**, não só rótulo: `vazioDaBarra` devolve *"Esta ocorrência está encerrada."* desde o item 26.
 * Ele já é alcançado por componente de cliente, então nada novo entra no pacote do navegador.
 */
export const AVISO_DE_VISIBILIDADE =
  "O Solicitante vê esta observação. Não há como editá-la depois.";

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
  resolver: "Resolver",
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
 * ============================================================================
 *  O que vai na barra e o que vai no menu — a regra do item 23
 * ============================================================================
 *
 * **Três renderizáveis ou mais → primário + *"Mais ações ▾"*; dois → dois botões.**
 *
 * **Não é contagem por gosto: é a largura.** Com três em 390 px, o mínimo de conteúdo soma **~365 px**
 * contra **~358 px** disponíveis — *"Iniciar atendimento"* (~178) + *"Atribuir"* (~87) + *"Pausar"*
 * (~84) + dois `gap-2`. `ui/button.tsx` carrega `whitespace-nowrap` e nenhum `overflow-hidden`, então
 * o que acontece não é texto cortado: é a **barra transbordando a viewport**. É o mesmo argumento
 * aritmético da spec do item 22, do outro lado do limiar.
 *
 * **Com dois, a decisão dos itens 19 e 22 continua valendo inteira** — *"o protótipo previu um primário
 * largo e um Mais ações porque quatro rótulos legíveis não cabem em 390 px; com dois, cabem"*. Esta
 * função não a revisita; ela só escreve o outro ramo.
 *
 * **Mora aqui, numa função, e não em dois `if` que precisam concordar.** A página decide a `variante`
 * de cada nó de formulário e a barra decide onde renderizá-lo; se cada uma contasse por conta própria,
 * teríamos duas fontes para a mesma coisa — que é literalmente o defeito que o item 22 consertou ao
 * criar `acaoPrimaria`.
 *
 * **`acaoPrimaria` continua existindo e continua sendo a única dona de `ACAO_PRIMARIA`** — esta função
 * a chama, e não duplica a tabela nem o desempate.
 */
const RENDERIZAVEIS_ATE_A_BARRA_CABER = 2;

export function acoesDaBarra(
  status: StatusOcorrencia,
  renderizaveis: readonly string[],
): { destaque: string | null; emMenu: readonly string[] } {
  const destaque = acaoPrimaria(status, renderizaveis);

  if (renderizaveis.length <= RENDERIZAVEIS_ATE_A_BARRA_CABER) {
    return { destaque, emMenu: [] };
  }

  return { destaque, emMenu: renderizaveis.filter((comando) => comando !== destaque) };
}

/**
 * ============================================================================
 *  As duas frases do vazio da barra — o critério 26.6 e o 16.6, irmãos
 * ============================================================================
 *
 * A barra pode ficar vazia por **duas razões diferentes**, e só uma delas é sobre o produto pronto:
 *
 * | Por que está vazia | O que a tela mostra |
 * |---|---|
 * | O status é **terminal** — nada mais será possível | *"Esta ocorrência está encerrada."*, em moldura sólida |
 * | O status **não** é terminal, e os comandos ainda não foram construídos | a nota de andaime, em moldura tracejada |
 *
 * **Mora numa função com teste, e não num `?:` dentro do JSX**, pela mesma razão que o `vazioDaLista` do
 * item 14: *"o erro clássico não é escrever mal as frases — é usar uma no lugar da outra, que é uma
 * decisão"*. Escrever *"lista vazia → 'Esta ocorrência está encerrada'"* produziria uma mentira, e a
 * `trabalho/fila-documentacao.md` já registrou isso em 27/08/2026.
 *
 * **Devolve o PAR, e não só a frase.** A moldura é metade da decisão — tracejado marca **andaime
 * declarado**, e sólido marca **UI de produto**. Devolvendo só o texto, a segunda metade voltaria para o
 * JSX e a página precisaria de `ehTerminal`, contra a regra que ela mantém desde o item 11: **a página
 * não importa o Domínio.**
 *
 * **Mora aqui** porque `rotulos.ts` é o módulo do que a tela sabe sobre comandos e status, e porque
 * `ehTerminal` já é superfície pública do Domínio — **o texto não deriva de `TERMINAIS` por conta
 * própria**, ele chama a função que já existe.
 *
 * **O segundo ramo sai no item 27** (critério 27.6): com `avaliar` construído, `COMANDOS_IMPLEMENTADOS`
 * terá os dez e a frase de andaime passa a ser falsa. A partir de lá esta função tem um ramo só.
 */
export function vazioDaBarra(status: StatusOcorrencia): { texto: string; andaime: boolean } {
  return ehTerminal(status)
    ? { texto: "Esta ocorrência está encerrada.", andaime: false }
    : { texto: "Os comandos da ocorrência chegam nos próximos itens.", andaime: true };
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
