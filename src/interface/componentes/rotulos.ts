import {
  ehTerminal,
  STATUS,
  type Comando,
  type Prioridade,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";
import { nomeDoStatus, rotuloDeStatus, type LenteDeRotulo } from "@/interface/projecoes";

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
 * **A MESMA frase, com o sujeito trocado** — critério **18.7**, e a primeira vez no produto em que um
 * texto de tela muda em função de quem está olhando.
 *
 * `cancelar` é o único comando que **duas pessoas diferentes** chamam, e o aviso da irmã acima diria ao
 * Solicitante que *"o Solicitante vê esta observação"* — verdade inútil, dita a ele sobre ele mesmo,
 * exatamente onde a frase precisa avisar **quem lê o que você está escrevendo**. Para ele, quem lê é o
 * outro lado.
 *
 * **Construída por deleção:** troca só o sujeito da primeira oração e mantém a segunda palavra por
 * palavra, porque **as duas frases importam** — quem lê, e que é final.
 *
 * **A restrição herdada nº 1 do `inventario-de-telas.md` passa a ter UMA exceção**, e ela tem dono: item
 * 19 da `trabalho/fila-documentacao.md`. A restrição manda a frase única nos cinco modais; a partir daqui
 * o modal de `cancelar` escolhe entre duas, **por permissão e não por autoria** — um Gestor que seja
 * autor da própria ocorrência lê a frase do Gestor, porque quem lê a observação dele são os Gestores.
 *
 * **Os outros quatro modais continuam com a frase única**, e não por esquecimento: `pausar`,
 * `iniciar-atendimento`, `retomar` e `resolver` só são alcançáveis por quem é Gestor.
 */
export const AVISO_PARA_QUEM_NAO_GESTIONA =
  "Os Gestores veem esta observação. Não há como editá-la depois.";

/**
 * ============================================================================
 *  O `404` de ocorrência, em frase — a §7 do inventário de telas
 * ============================================================================
 *
 * *"Esta ocorrência não existe em **{organizacaoAtiva.nome}**."* (`inventario-de-telas.md:1504`), literal.
 *
 * **Uma frase para as duas causas, e é a §6.3 do contrato.** Ela cobre *"não existe"* e *"existe em outra
 * organização"* sem escolher entre as duas — porque a resposta é indistinguível de propósito, e uma frase
 * que escolhesse desfaria a decisão inteira.
 *
 * **Mora aqui, e não dentro de T-05**, porque o inventário nomeia **T-06** como segundo consumidor, com a
 * mesma frase (`:952`). T-06 ainda não existe como tela; quando existir, ela já está escrita uma vez. A
 * terceira cópia é sempre a que diverge — é a mesma razão de `rotuloDePrioridade` morar aqui.
 *
 * **A tela NÃO lê o corpo do erro para montar esta frase**, e é a única escolha possível: T-05 vai pela
 * estrada direta e não faz requisição HTTP nenhuma. O nome vem de `resolucao.ativo.organizacao.nome`, que
 * a página já tem em mãos.
 *
 * **Sem nome, a frase degrada em vez de mentir.** É a disciplina que o vazio de filtro do item 15 já
 * declarou: *"`nomeDaOrganizacao` pode ser nulo, e a frase sem o nome continua verdadeira; inventá-lo
 * seria pior"*.
 */
export function ocorrenciaNaoEncontradaEm(nomeDaOrganizacao: string | null): string {
  return nomeDaOrganizacao === null
    ? "Esta ocorrência não existe nesta organização."
    : `Esta ocorrência não existe em ${nomeDaOrganizacao}.`;
}

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
 * exige rótulo de todo comando **que a barra renderiza como botão**. Os dois de baixo são exceção
 * **asserida**, com caso próprio — nunca filtro silencioso.
 *
 * **Dois comandos nunca vão entrar aqui**, e não é esquecimento: `alterar-prioridade` é **seletor no bloco
 * de identidade** e `registrar-solucao-aplicada` é **campo no corpo da tela** (`inventario-de-telas.md`).
 * Botão não é a forma deles.
 */
const ROTULO_DE_COMANDO: Partial<Record<Comando, string>> = {
  analisar: "Analisar",
  "atribuir-responsavel": "Atribuir",
  "iniciar-atendimento": "Iniciar atendimento",
  pausar: "Pausar",
  retomar: "Retomar",
  resolver: "Resolver",
  /** A palavra do protótipo (`telas.html:2358`), e o último rótulo do produto. */
  avaliar: "Avaliar",
  cancelar: "Cancelar",
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
 *  As DUAS frases do vazio da barra — os critérios 26.6 e 18.6
 * ============================================================================
 *
 * A barra pode ficar vazia por **duas razões**, e as duas são sobre o produto pronto:
 *
 * | Por que está vazia | O que a tela mostra |
 * |---|---|
 * | O status é **terminal** — nada mais será possível | *"Esta ocorrência está encerrada."* |
 * | Não é terminal, e quem olha é o Solicitante autor a partir de `Em atendimento` (18.6) | *"Só os Gestores podem cancelar a partir daqui."* |
 *
 * **Mora numa função com teste, e não num `?:` dentro do JSX**, pela mesma razão que o `vazioDaLista` do
 * item 14: *"o erro clássico não é escrever mal as frases — é usar uma no lugar da outra, que é uma
 * decisão"*.
 *
 * **Eram TRÊS até o item 27.** O terceiro ramo era a nota de andaime — *"os comandos da ocorrência chegam
 * nos próximos itens"* —, e o **critério 27.6** o remove: com `avaliar` construído,
 * `COMANDOS_IMPLEMENTADOS` tem os dez e **não há mais comando por chegar**. A frase passou a ser falsa.
 *
 * **Com o ramo, saíram o campo `andaime`, a moldura tracejada do JSX e o parâmetro `ehGestor`** — a
 * cascata inteira, e cada peça tem razão: um booleano que nunca varia é ruído; o tracejado marcava
 * andaime declarado, e não há mais andaime; e `ehGestor` fica **sem uso**.
 *
 * **Por que remover `ehGestor` é seguro, e a prova é uma tautologia do próprio código.** A página o define
 * como `vinculo.pode("ocorrencia.cancelar_qualquer")`. Quem tem essa permissão tem `cancelar` em
 * `acoesDisponiveis` nos **quatro** estados não terminais — `TRANSICOES` lista `cancelar` nos quatro, a
 * restrição de autoria só se aplica a quem **não** tem `cancelar_qualquer`, e `cancelar` tem rótulo.
 * **Logo a barra do Gestor nunca fica vazia fora de estado terminal**, e o ramo que `ehGestor`
 * selecionava não tinha população. **A tautologia virou asserção** em `testes/interface/ocorrencia.test.ts`.
 *
 * *Alternativa recusada — manter `ehGestor` e devolver a frase do 18.6 também ao Gestor:* comportamento
 * idêntico ao de remover, com um argumento morto na assinatura e nos cinco sítios de chamada.
 * *Alternativa recusada — estourar no caso impossível:* `rotuloDeStatus` já escreveu a regra oposta neste
 * projeto, e uma exceção durante o render derrubaria T-05 inteira.
 *
 * **A frase do meio é seca de propósito, e a alternativa foi recusada em voz alta.** *"O atendimento já
 * começou"* — a primeira oração do `detail` publicado do `403` — **é falsa** numa ocorrência que chegou
 * a `pausada` vinda de `em_analise`. A frase escolhida é a única verdadeira nos **dois** estados em que
 * o ramo dispara.
 *
 * **Mora aqui** porque `rotulos.ts` é o módulo do que a tela sabe sobre comandos e status, e porque
 * `ehTerminal` já é superfície pública do Domínio — **o texto não deriva de `TERMINAIS` por conta
 * própria**, ele chama a função que já existe.
 *
 * **Devolve `string`, e não mais o par** — a moldura deixou de ser decisão quando ficou uma só.
 *
 * **A segunda oração entrou no item 30, e antes dele ela não podia existir** — apontaria para um campo
 * que a tela não tem. É o critério **30.6**, e é a segunda oração do `detail` publicado do
 * `403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO`, palavra por palavra. **O `detail` do erro não muda.**
 *
 * **E o ramo não terminal é exatamente a população que o critério nomeia**, sem que seja preciso
 * perguntar quem lê: quem tem `ocorrencia.cancelar_qualquer` tem `cancelar` em `acoesDisponiveis` nos
 * quatro estados não terminais, logo a barra do Gestor nunca fica vazia fora de estado terminal; o
 * Encarregado não abre T-05; e o Solicitante não autor recebe `404`. Sobra o **Solicitante autor em
 * `em_atendimento` e em `pausada`** — os dois estados do critério 18.6 e os dois do 30.6.
 */
export function vazioDaBarra(status: StatusOcorrencia): string {
  if (ehTerminal(status)) return "Esta ocorrência está encerrada.";
  return "Só os Gestores podem cancelar a partir daqui. Peça o cancelamento pelo comentário.";
}

/**
 * ============================================================================
 *  As duas frases da conversa — e o predicado é a AUTORIA, não o papel
 * ============================================================================
 *
 * **As frases são as do inventário, literais**, e não há terceira redação. O que a spec decidiu (P2) é
 * **qual das duas cada pessoa lê**:
 *
 * | Quem lê | Frase | É verdade porque |
 * |---|---|---|
 * | Solicitante autor | *"…falar com os Gestores."* | o outro lado do canal são os Gestores |
 * | Gestor **não** autor | *"…falar com o Solicitante."* | é a frase literal do inventário, e é a população inteira do risco que o 30.4 descreve |
 * | **Gestor autor** — o síndico morador do 28.5 | *"…falar com os Gestores."* | participantes são *Gestores + autor* (critério 30.2); se o autor é Gestor, o conjunto **são** os Gestores |
 *
 * **São as três combinações vivas, e não há quarta:** um Solicitante que não seja o autor recebe `404`, e
 * o Encarregado não abre T-05 — a página exige `ocorrencia.ler_propria` e a lista dele é vazia.
 *
 * **O precedente é o item 27, na mesma página:** `{ehAutor ? "Sua avaliação" : "Avaliação do
 * solicitante"}`. A regra que os dois idiomas da página desenham juntos — **texto que avisa a
 * consequência de escrever segue permissão** (o aviso de visibilidade do 18.7); **texto que nomeia a
 * relação de quem lê com o conteúdo segue autoria**. A frase da conversa é do segundo tipo.
 *
 * **O rótulo do campo é o portador permanente do aviso.** A frase do vazio some assim que existe uma
 * mensagem; o rótulo fica — e é ele que *"impede um Gestor de escrever ali achando que é interno"* depois
 * da primeira linha da conversa, que é a razão que o critério 30.4 dá para as frases serem diferentes.
 */
export function vazioDaConversa(ehAutor: boolean): string {
  return ehAutor
    ? "Nenhuma mensagem ainda. Escreva aqui para falar com os Gestores."
    : "Nenhuma mensagem ainda. Escreva aqui para falar com o Solicitante.";
}

/** O par do vazio, com o mesmo predicado — e este fica na tela para sempre. Ver `vazioDaConversa`. */
export function rotuloDoCampoDeConversa(ehAutor: boolean): string {
  return ehAutor ? "Escrever para os Gestores" : "Escrever para o Solicitante";
}

/**
 * Os rótulos de status **prontos e na coluna de quem lê**, para descer por prop até um componente de
 * cliente.
 *
 * **O navegador não monta rótulo** — é a mesma decisão da barra de filtros do item 15. E é mais que
 * estilo: importar `rotuloDeStatus` de dentro do componente de cliente arrastaria `@/interface/projecoes`
 * e, com ele, `comandosDisponiveis` — a máquina de estados inteira para dentro do pacote do navegador,
 * que é literalmente a **segunda cópia** que `acoesDisponiveis` existe para impedir.
 *
 * **Quem consome é a frase do `409`** (`comando-de-ocorrencia.ts`), que tem `statusAtual` e **não** tem
 * motivo de pausa. Daí o `null` no segundo argumento, e daí as duas leituras de `pausada`:
 *
 * | Lente | A frase |
 * |---|---|
 * | `"gestor"` | *"…agora ela está **Pausada**."* — a coluna dele é uma palavra por status |
 * | `"solicitante"` | *"…agora ela está **Parada**."* — a degradação de `rotuloDeStatus` sem motivo |
 *
 * **A lente é obrigatória** pela mesma razão que em `rotuloDeStatus`: um padrão faria a próxima tela
 * escolher a coluna errada em silêncio.
 */
export function rotulosDeStatus(lente: LenteDeRotulo): Record<StatusOcorrencia, string> {
  return Object.fromEntries(
    STATUS.map((status) => [status, rotuloDeStatus(status, null, lente)]),
  ) as Record<StatusOcorrencia, string>;
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
