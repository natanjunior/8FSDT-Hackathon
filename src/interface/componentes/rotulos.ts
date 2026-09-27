import {
  ehTerminal,
  STATUS,
  type Comando,
  type Prioridade,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";
import type { Permissao } from "@/dominio/organizacao";
import type { TextosDoRetorno } from "@/interface/componentes/retorno-de-acao";
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
 *  Os títulos do aviso de cada comando — item 44g, critério 6
 * ============================================================================
 *
 * **O título diz o que foi tentado** (guia §7): o de sucesso diz o que aconteceu, o de falha começa por
 * *"Não foi possível"* e o verbo. A razão da falha fica dentro do modal.
 *
 * **Nenhum título leva nome de pessoa, título de ocorrência, *Situação* nem nota**, e um teste confere: o
 * teste de ponta a ponta procura esses textos sem escopo (spec do 44g, §4.13).
 *
 * **Dois comandos não estão aqui, e o teste os nomeia.** `atribuir-responsavel` tem o par em
 * `palavrasDaAtribuicao`, porque a palavra muda com o estado (critério 21.1). `alterar-prioridade`
 * responde pela linha de desfazer do bloco, que o critério 17.7 decidiu (achado A-04 da spec do 44g).
 *
 * **O objeto é literal, e não `Partial<Record<…>>`**, para que a página leia
 * `RETORNO_DO_COMANDO.pausar` sem `!`. A busca por um `Comando` qualquer passa pela cópia larga.
 */
export const RETORNO_DO_COMANDO = {
  analisar: {
    sucesso: "Ocorrência em análise",
    falha: "Não foi possível analisar a ocorrência",
  },
  "iniciar-atendimento": {
    sucesso: "Atendimento iniciado",
    falha: "Não foi possível iniciar o atendimento",
  },
  pausar: { sucesso: "Ocorrência pausada", falha: "Não foi possível pausar a ocorrência" },
  retomar: { sucesso: "Ocorrência retomada", falha: "Não foi possível retomar a ocorrência" },
  resolver: { sucesso: "Ocorrência resolvida", falha: "Não foi possível resolver a ocorrência" },
  cancelar: { sucesso: "Ocorrência cancelada", falha: "Não foi possível cancelar a ocorrência" },
  avaliar: { sucesso: "Avaliação enviada", falha: "Não foi possível enviar a avaliação" },
  "registrar-solucao-aplicada": {
    sucesso: "Solução aplicada salva",
    falha: "Não foi possível salvar a solução aplicada",
  },
} as const satisfies Partial<Record<Comando, TextosDoRetorno>>;

const RETORNO_LARGO: Partial<Record<Comando, TextosDoRetorno>> = RETORNO_DO_COMANDO;

export function retornoDoComando(comando: Comando): TextosDoRetorno | null {
  return RETORNO_LARGO[comando] ?? null;
}

/** A conversa não é comando (`Comando.ts`), e tem o próprio par. */
export const RETORNO_DA_MENSAGEM: TextosDoRetorno = {
  sucesso: "Mensagem enviada",
  falha: "Não foi possível enviar a mensagem",
};

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
export function vazioDaConversa(ehAutor: boolean, podeEscrever = true): string {
  // **O terceiro ramo é de quem recebeu a ocorrência compartilhada** (item 87): as duas frases acima
  // convidam a escrever, e ele não tem campo. Convidar para um campo que não existe é a mentira que o
  // critério 30.4 existe para impedir, de outro lado.
  if (!podeEscrever) return "Nenhuma mensagem ainda.";
  return ehAutor
    ? "Nenhuma mensagem ainda. Escreva aqui para falar com os Gestores."
    : "Nenhuma mensagem ainda. Escreva aqui para falar com o Solicitante.";
}

/**
 * A faixa de quem recebeu a ocorrência compartilhada (item 87), no lugar das ações do cabeçalho.
 *
 * **O papel vai depois do nome e separado por ponto médio**, porque *"por Gestor Ana"* e *"por Ana,
 * Gestor"* tropeçam no gênero, e o rótulo do papel é fixo.
 */
export function faixaDeQuemRecebeu(nome: string, papelEmPalavra: string): string {
  return `Compartilhada com você por ${nome} · ${papelEmPalavra}.`;
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

/**
 * ============================================================================
 *  As palavras da atribuição — o item 21, e as CINCO superfícies que nomeiam a ação
 * ============================================================================
 *
 * **`atribuir-responsavel` é o único endpoint do produto que realiza dois comandos do domínio**
 * (`contrato-de-api.md:218-219`), e a distinção é **derivada do estado**, nunca pedida ao cliente
 * (critério 21.1). O modal é o mesmo; o que troca é a palavra, e ela troca em **três superfícies** —
 * o gatilho, o título e o botão que grava —, mais o verbo de envio e a descrição.
 *
 * **Por que as três, e não só o gatilho.** O `inventario-de-telas.md:786` nomeia a linha
 * *"Atribuir / Reatribuir"* e a coluna *Forma* dela diz **modal**: o que tem dois nomes é o **comando**, e
 * o modal é a forma dele. Um modal cujo gatilho diz *Reatribuir* e cujo título diz *Atribuir responsável*
 * desfaz a nomeação no primeiro pixel depois do toque. E **o botão do rodapé é o que grava** — é a última
 * palavra lida antes de a atribuição de outra pessoa terminar.
 *
 * **Os dois títulos são literais do contrato.** *Atribuir responsável* e *Reatribuir*: um com objeto,
 * outro sem. A assimetria é dele, e não é anomalia de tela — quatro dos sete títulos de modal do produto
 * já são verbo nu (*Avaliar*, *Resolver*, *Pausar*, *Retomar*).
 *
 * **A segunda oração da descrição é onde o critério 21.3 fica visível.** *"Depois da reatribuição
 * continua havendo um só responsável ativo"* é garantia de índice único parcial, invisível na tela — e
 * sem essa oração nada em T-05 diz que escolher outra pessoa **encerra** a atribuição atual em vez de
 * acrescentar uma segunda. Ela é o `contrato-de-api.md:220-221` em voz de tela, não invenção.
 *
 * **Mora aqui, e não num módulo novo.** Este arquivo se declara *"o módulo do que a tela sabe sobre
 * comandos"* e já guarda **frase de produto**, não só rótulo — `AVISO_DE_VISIBILIDADE`,
 * `ocorrenciaNaoEncontradaEm`, `vazioDaBarra`. Um sexto arquivo de texto para dois objetos seria a pasta
 * vazia por simetria que o DoD reprova. E não custa nada ao pacote do navegador: `rotulos.ts` já é
 * importado por `modal-de-observacao.tsx` e `modal-de-resolucao.tsx`.
 *
 * **`ROTULO_DE_COMANDO["atribuir-responsavel"]` continua *"Atribuir"* e NÃO vira função** (§3.6 da spec):
 * aquele mapa responde outra pergunta — *este comando tem forma de botão nesta barra?* — e o valor **nunca
 * é renderizado** para este comando, porque a barra só imprime `acao.rotulo` quando não há formulário
 * montado, e a página sempre monta o modal.
 */
export type PalavrasDaAtribuicao = {
  /** O `DropdownMenuItem` ou o `Button` que abre o modal. */
  gatilho: string;
  /** O `DialogTitle` — o nome do comando no contrato, literal. */
  titulo: string;
  /** O `DialogDescription`. */
  descricao: string;
  /** O botão do rodapé — o que grava. */
  confirmar: string;
  /** O mesmo botão enquanto a requisição corre. */
  enviando: string;
  /** O título do aviso quando a atribuição foi gravada. */
  sucesso: string;
  /** O título do aviso quando não foi. */
  falha: string;
};

const PRIMEIRA_ATRIBUICAO: PalavrasDaAtribuicao = {
  gatilho: "Atribuir",
  titulo: "Atribuir responsável",
  descricao: "Quem vai cuidar desta ocorrência.",
  confirmar: "Atribuir",
  enviando: "Atribuindo…",
  sucesso: "Responsável atribuído",
  falha: "Não foi possível atribuir o responsável",
};

const NOVA_ATRIBUICAO: PalavrasDaAtribuicao = {
  gatilho: "Reatribuir",
  titulo: "Reatribuir",
  descricao: "Quem passa a cuidar desta ocorrência. A atribuição atual será encerrada.",
  confirmar: "Reatribuir",
  enviando: "Reatribuindo…",
  sucesso: "Ocorrência reatribuída",
  falha: "Não foi possível reatribuir a ocorrência",
};

export const PALAVRAS_DA_ATRIBUICAO: Readonly<Record<"primeira" | "nova", PalavrasDaAtribuicao>> = {
  primeira: PRIMEIRA_ATRIBUICAO,
  nova: NOVA_ATRIBUICAO,
};

/**
 * **O predicado é *"há responsável"*, e não *"o responsável está na lista"*** — §3.5 da spec, e a
 * diferença é alcançável: o vínculo do responsável pode estar **revogado**, e nesse estado ele continua
 * sendo `detalhe.responsavel` (o `LATERAL` de `lerPorId` não filtra `revogado_em`) mas **some dos
 * candidatos** (`listarVinculos` devolve `vinculos.ativos()`). Derivar a palavra da lista faria o modal
 * dizer *Atribuir* sobre uma ocorrência que tem responsável.
 */
export function palavrasDaAtribuicao(temResponsavel: boolean): PalavrasDaAtribuicao {
  return temResponsavel ? NOVA_ATRIBUICAO : PRIMEIRA_ATRIBUICAO;
}

/**
 * ============================================================================
 *  As duas frases do recorte de T-03 — o critério 14.3, literal
 * ============================================================================
 *
 * **Elas não encolhem, e a razão é dupla.** O critério 14.3 as nomeia palavra por palavra, e dois passos
 * do roteiro de validação mandam procurá-las em tela. Rótulo curto — *"Todas"*, *"Só as minhas"* — diria
 * a mesma coisa e faria os dois passos descreverem uma tela que não existe.
 *
 * **Moram aqui porque têm mais de um consumidor:** o `toggle-group` do recorte e as opções que
 * `opcoes-do-recorte.ts` monta para ele. Até o item 87 o segundo consumidor era o parágrafo de quem não
 * podia trocar de recorte (critério 44c.9); esse vínculo passou a receber o controle, com *Minhas
 * ocorrências* e *Compartilhadas comigo*. A terceira cópia é sempre a que diverge.
 */
export const RECORTE_TODAS = "Todas as ocorrências";
export const RECORTE_MINHAS = "Minhas ocorrências";
/** A aba do item 87. O número dela é do item 88, e conta as não abertas. */
export const RECORTE_COMPARTILHADAS = "Compartilhadas comigo";

/**
 * **A tela diz *vista*; o banco, o código e o contrato dizem *aberta*** — item 88.
 *
 * O selo fica na mesma linha que o `SeloDeStatus`, e *Aberta* é o primeiro estado do ciclo: *Aberta · Não
 * aberta* é contradição de leitura. O critério fala do comportamento, e não da palavra da tela.
 *
 * **A palavra existe porque o compromisso A-5 a exige:** nada é comunicado só por cor nem só por forma.
 */
export const SELO_NAO_VISTA = "Não vista";

/**
 * A palavra do **nome acessível** da opção — *"Compartilhadas comigo, 3 não vistas"*. Na tela fica só o
 * número, pelo mesmo motivo que o `Quantos` de hoje põe o número dentro do nome: esconder de quem usa
 * leitor de tela um número que está na tela seria negar-lhe o que todo mundo vê.
 */
export function palavraDeNaoVistas(quantas: number): string {
  return quantas === 1 ? "não vista" : "não vistas";
}

/**
 * ============================================================================
 *  O estado sem acesso — item 44h
 * ============================================================================
 *
 * **Três permissões guardam uma tela que recusa quem chega por link:** configurar a organização (T-15,
 * T-09, T-14 e as páginas de criar e corrigir delas), gerir vínculos (T-08 e as duas páginas próprias) e
 * ler o dashboard (T-07). `ocorrencia.ler_propria` também guarda tela, mas quem não a tem vai para T-10 e
 * nunca vê este estado.
 *
 * **`satisfies` é o que impede o nome errado:** uma permissão que não existe no domínio não compila. E o
 * mapa de frases, tipado pela união, não compila sem a frase de uma permissão de tela nova.
 */
export const PERMISSOES_DE_TELA = [
  "organizacao.configurar",
  "vinculo.gerir",
  "dashboard.ler",
] as const satisfies readonly Permissao[];

export type PermissaoDeTela = (typeof PERMISSOES_DE_TELA)[number];

/**
 * **A frase de quem usa a tela é por permissão, e não por página.** A prancheta escreve a de
 * configuração; as outras duas seguem a mesma construção, com a palavra de *Participante* (*participa*)
 * e a dos seis blocos do dashboard (*indicadores*).
 */
export const QUEM_USA_A_TELA: Readonly<Record<PermissaoDeTela, string>> = {
  "organizacao.configurar": "Esta página é de quem configura a organização.",
  "vinculo.gerir": "Esta página é de quem decide quem participa da organização.",
  "dashboard.ler": "Esta página é de quem acompanha os indicadores da organização.",
};

/**
 * **A recusa, escrita uma vez.** É a frase da §7 do inventário de telas para `PERMISSAO_INSUFICIENTE`, e
 * morava em onze páginas até o item 44h. Este comentário não a repete de propósito: a conferência do item
 * conta a frase em `app/` e `src/` por `grep`, com comentário e tudo.
 */
export const RECUSA_DE_ACESSO = "Seu papel nesta organização não dá acesso a esta página.";

/** **A saída do estado sem acesso**, que leva a T-03, o eixo das telas de dentro. */
export const SAIDA_DO_SEM_ACESSO = "Ir para Ocorrências";

/**
 * ============================================================================
 *  A contagem de pedidos da barra lateral — item 44h, critério 2
 * ============================================================================
 *
 * **Três formas, e a de zero é informação:** a fila foi olhada e está vazia. A palavra é decisão do dono
 * em 16/09/2026, porque a anterior não cabia nos 214 px da barra. A geometria que faz a forma de zero
 * caber está em `casca/navegacao.tsx`.
 */
export function fraseDePedidosPendentes(pendentes: number): string {
  if (pendentes === 0) return "nenhum pedido pendente";
  if (pendentes === 1) return "1 pedido pendente";
  return `${pendentes} pedidos pendentes`;
}

/**
 * ============================================================================
 *  O que o item 66 acrescenta: o caminho, o aviso de avaliação e a porta de fora
 * ============================================================================
 *
 * **O título entra no caminho cortado em quarenta caracteres** (design §66), e o limite conta as
 * reticências. Conta por ponto de código, e não por unidade de UTF-16, para um emoji no título não virar
 * meio caractere. O espaço antes do corte sai, para não sobrar *"palavra …"*.
 */
export const LIMITE_DO_TITULO_NO_CAMINHO = 40;

export function encurtarParaOCaminho(
  titulo: string,
  limite: number = LIMITE_DO_TITULO_NO_CAMINHO,
): string {
  const caracteres = Array.from(titulo.trim());
  if (caracteres.length <= limite) return caracteres.join("");
  return `${caracteres
    .slice(0, limite - 1)
    .join("")
    .trimEnd()}…`;
}

/**
 * **A frase da faixa de avaliação**, do design §66. Não contém *Avaliar*: o botão ao lado é quem diz o
 * verbo, e o teste de ponta a ponta o procura por esse nome.
 */
export const AVISO_DE_AVALIACAO =
  "Esta ocorrência foi resolvida. Conte como foi o atendimento para os Gestores.";

/**
 * **As cinco notas da avaliação, com nome só nas pontas** — o desenho do protótipo §7.2, que o modal
 * tinha à mão até o item 76. Mora aqui para o texto ao lado das estrelas e o nome de cada rádio saírem
 * da mesma lista.
 */
export const NOTAS_DA_AVALIACAO = [
  { valor: 1, descricao: "muito ruim" },
  { valor: 2, descricao: null },
  { valor: 3, descricao: null },
  { valor: 4, descricao: null },
  { valor: 5, descricao: "muito bom" },
] as const;

function descricaoDaNota(valor: number): string | null {
  return NOTAS_DA_AVALIACAO.find((nota) => nota.valor === valor)?.descricao ?? null;
}

/** O nome acessível de cada estrela: `"5, muito bom"` nas pontas, o número no meio. */
export function nomeDaNota(valor: number): string {
  const descricao = descricaoDaNota(valor);
  return descricao === null ? String(valor) : `${String(valor)}, ${descricao}`;
}

/**
 * **O valor em palavra, ao lado das estrelas** (critério 76.5, compromisso A-5). As notas 2 a 4 não
 * ganham palavra: o desenho de origem só nomeia as pontas, e inventar uma seria decidir escala.
 */
export function textoDaNota(nota: number | null): string {
  if (nota === null) return "Escolha de 1 a 5";
  const descricao = descricaoDaNota(nota);
  return descricao === null ? `${String(nota)} de 5` : `${String(nota)} de 5, ${descricao}`;
}
