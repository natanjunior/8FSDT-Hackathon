import type {
  ComentarioLido,
  CursorDeConversa,
  CursorDeListagem,
  EventoLido,
  FiltroDeOcorrencias,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  PaginaDeConversa,
  PaginaDeOcorrencias,
  TransicaoLida,
} from "@/aplicacao/ocorrencia";
import {
  comandosDisponiveis,
  MOTIVOS_DE_PAUSA,
  motivosPermitidos,
  PRIORIDADES,
  type MotivoCancelamento,
  type MotivoPausa,
  type Prioridade,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";

import { projetarAnexo } from "./anexo";

/**
 * ============================================================================
 *  Os rótulos exibidos — transcritos do `glossario.md` §4
 * ============================================================================
 *
 * A tabela do glossário é **a fonte**: *"o contrato de API a consome, e nenhum rótulo nasce fora daqui"*.
 *
 * **Estas são as duas metades da coluna do Solicitante.** A coluna do Gestor é `NOME_DO_STATUS`, mais
 * abaixo neste arquivo, e quem escolhe entre as duas é `lenteDeRotulo`.
 *
 * **O custo que a spec do item 11 declarou — um Gestor lendo *"Recebida — aguardando análise"* — deixou
 * de existir no item 31.**
 *
 * **`Pausada` tem quatro rótulos, não um molde com o motivo interpolado** (regra 2 do glossário): frase
 * montada em tempo de execução produz *"Parada, esperando aguardando peça"*.
 */
const ROTULO_DE_PAUSA: Readonly<Record<MotivoPausa, string>> = {
  aguardando_informacao_solicitante: "Parada — esperando você responder",
  aguardando_peca: "Parada — esperando material chegar",
  aguardando_autorizacao: "Parada — esperando autorização",
  aguardando_terceiro: "Parada — esperando um terceiro",
};

const ROTULO_DE_STATUS: Readonly<Record<Exclude<StatusOcorrencia, "pausada">, string>> = {
  aberta: "Recebida — aguardando análise",
  em_analise: "Em análise",
  em_atendimento: "Em execução",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

/**
 * ============================================================================
 *  A LENTE — qual coluna do `glossario.md` §4 cada leitor recebe
 * ============================================================================
 *
 * **Uma decisão, um lugar.** A tabela do glossário tem duas colunas, e até o item 31 o produto inteiro
 * falava com o Solicitante. Esta função é a única que escolhe entre elas.
 *
 * **Segue PERMISSÃO — nunca autoria, nunca recorte.** *"A checagem pergunta `vinculo.pode(X)`, nunca
 * `vinculo.papel == GESTOR`"* (`arquitetura.md`, Parte II tópico 5; contrato §4.5). É a mesma regra que
 * torna possível a `PRIMARY KEY (pessoa_id, organizacao_id)`: se a checagem fosse por papel, o síndico
 * morador precisaria de um segundo vínculo.
 *
 * **É `ocorrencia.ler_todas`, e não outra.** É o predicado que este produto **já** usa como *"a lente do
 * Gestor"* em três lugares independentes: `visibilidadeAplicada` (`consultas.ts`), `podeLerTodas` nas
 * funções de aplicação, e a barra de filtros de T-03. Escolher uma quarta criaria um segundo desenho de
 * *quem é Gestor* que teria de concordar com o primeiro por disciplina.
 *
 * **A consequência tem nome, e é decisão e não bug:** o síndico morador do **28.5** lê *"Aberta"* na
 * própria ocorrência, e lê *"Aberta"* também com *"Só as minhas"* ligado. Um rótulo que mudasse com o
 * alternador reintroduziria o de-para que o `inventario-de-telas.md:117-125` removeu — e é a mesma forma
 * que o critério **28.6** já decidiu para a prioridade: *"permissão, nunca recorte"*.
 *
 * **É um tipo nomeado e não um booleano** porque `"solicitante" | "gestor"` são as palavras que o
 * `glossario.md:114` dá às duas colunas. Um `podeLerTodas: boolean` atravessando quatro assinaturas
 * levaria o *porquê* para dentro do *quê*.
 *
 * **`readonly string[]`, e não `readonly Permissao[]`** — mesma assinatura de `motivosPermitidos`
 * (`Motivos.ts:69`) e de `opcoesDeMotivoCancelamento` logo acima: a projeção não obriga quem chama a
 * carregar o tipo do Domínio, e `Vinculo.permissoes` é atribuível sem conversão.
 */
export type LenteDeRotulo = "solicitante" | "gestor";

export function lenteDeRotulo(permissoes: readonly string[]): LenteDeRotulo {
  return permissoes.includes("ocorrencia.ler_todas") ? "gestor" : "solicitante";
}

/**
 * O rótulo de um status **na coluna de quem lê** — `glossario.md` §4.
 *
 * - `"solicitante"` → a coluna de linguagem de gente, e em `pausada` o motivo **está dentro do rótulo**:
 *   são quatro frases, uma por motivo (regra 2 do glossário).
 * - `"gestor"` → `NOME_DO_STATUS` (declarada mais abaixo neste arquivo), o nome interno, **inclusive em
 *   `pausada`, que colapsa em *"Pausada"* e ignora o motivo**. São as quatro linhas de `pausada` da
 *   tabela — `glossario.md:119-122` —, e é ela que faz a segunda linha de T-03 voltar sozinha
 *   (critério 31.6).
 *
 * **A lente é obrigatória, e isso é o mecanismo do item 31.** Um valor padrão faria toda chamada futura
 * escolher a coluna errada em silêncio; obrigatória, o compilador obriga cada sítio novo a decidir.
 *
 * **Uma tabela, duas perguntas, zero segunda cópia.** `NOME_DO_STATUS` passa a ter dois leitores —
 * `nomeDoStatus` (*"qual conjunto você quer"*: as opções do filtro, `descricaoDoRecorte`) e o ramo Gestor
 * daqui (*"o que está acontecendo com esta ocorrência"*). As duas funções continuam existindo porque
 * respondem perguntas diferentes, **e as strings continuam sendo escritas uma vez só**.
 *
 * **`NOME_DO_STATUS` é declarada ~190 linhas ABAIXO desta função, e isso funciona:** `const` em escopo de
 * módulo é inicializada quando o módulo carrega, e esta função só é **chamada** depois disso. Ela mora ao
 * lado de `nomeDoStatus`, que é o outro leitor dela.
 */
export function rotuloDeStatus(
  status: StatusOcorrencia,
  motivoPausa: MotivoPausa | null,
  lente: LenteDeRotulo,
): string {
  if (lente === "gestor") return NOME_DO_STATUS[status];
  if (status !== "pausada") return ROTULO_DE_STATUS[status];
  // Sem motivo não deveria acontecer — o `CHECK` do banco garante o par —, mas o rótulo não é o lugar
  // de estourar: degrada para a palavra, que continua sendo texto e não cor (A-5).
  return motivoPausa === null ? "Parada" : ROTULO_DE_PAUSA[motivoPausa];
}

/**
 * O motivo da pausa **em palavras**, para a segunda linha do item na lista do Gestor (critério 14.3).
 *
 * **Reusa a mesma tabela do rótulo — não há segundo vocabulário.** A regra 2 do glossário proíbe frase
 * montada em tempo de execução, e inventar uma forma curta aqui criaria exatamente o segundo texto que a
 * tabela existe para impedir.
 *
 * **Alcançável desde o item 23**, que é quem torna `pausada` um estado real. Entre o 23 e o 31 o rótulo
 * do Solicitante — que é o de todo mundo até lá — **já traz o motivo dentro dele**, e por isso a segunda
 * linha de T-03 não sai: quem decide é `segundaLinhaDeMotivo`, logo abaixo, e ela volta sozinha quando o
 * **31** trocar o rótulo do Gestor para *"Pausada"*. É o critério **23.6**.
 */
export function rotuloDeMotivoPausa(motivo: MotivoPausa): string {
  return ROTULO_DE_PAUSA[motivo];
}

/**
 * ============================================================================
 *  O motivo como OPÇÃO DE ESCOLHA — o segundo vocabulário, e ele nasce no item 23
 * ============================================================================
 *
 * `ROTULO_DE_PAUSA` traz a coluna do Solicitante do glossário §4 — *"Parada — esperando material
 * chegar"*. Isso é **o que aconteceu com a ocorrência**, e não serve como opção de um seletor:
 * *"Parada — esperando material chegar"* dentro de um formulário chamado **Motivo** é uma frase
 * respondendo a outra pergunta.
 *
 * **A forma é exatamente a de `nomeDoStatus` × `rotuloDeStatus`**, e o argumento já está escrito neste
 * arquivo: uma responde *"qual conjunto você quer"*, a outra *"o que está acontecendo com a sua
 * ocorrência"*. Aqui a pergunta é ainda mais direta — *o que ela está esperando?*
 *
 * **Isso NÃO é a segunda cópia que o glossário proíbe.** A regra 2 proíbe **frase montada em tempo de
 * execução** (*"Parada, esperando aguardando peça"*), não um segundo vocabulário declarado. É a mesma
 * coisa que a coluna do Gestor já é.
 *
 * **Os quatro textos são transcrição, não texto novo de produto:** saem de
 * `docs/prototipo/telas.html:2405-2423`, e batem com a definição de `Pausada` no glossário §4.
 */
const NOME_DO_MOTIVO_PAUSA: Readonly<Record<MotivoPausa, string>> = {
  aguardando_informacao_solicitante: "Aguardando informação do solicitante",
  aguardando_peca: "Aguardando peça",
  aguardando_autorizacao: "Aguardando autorização",
  aguardando_terceiro: "Aguardando um terceiro",
};

export function nomeDoMotivoPausa(motivo: MotivoPausa): string {
  return NOME_DO_MOTIVO_PAUSA[motivo];
}

/**
 * Os quatro pares **prontos**, para descer por prop até o modal de pausa.
 *
 * **Existe para que `app/` não importe o Domínio**, que é a disciplina que a página mantém desde o
 * item 11. É a mesma forma de `rotulosDeStatus()` e `nomesDeStatus()` em `rotulos.ts`: o navegador não
 * monta rótulo, e a página não conhece `MOTIVOS_DE_PAUSA`.
 *
 * **`valor` é `string`, e não `MotivoPausa`** — quem consome é componente de cliente, e tipo do Domínio
 * não atravessa essa fronteira.
 */
export function opcoesDeMotivoPausa(): readonly { valor: string; rotulo: string }[] {
  return MOTIVOS_DE_PAUSA.map((motivo) => ({ valor: motivo, rotulo: nomeDoMotivoPausa(motivo) }));
}

/**
 * ============================================================================
 *  O motivo de CANCELAMENTO como opção de escolha — item 18
 * ============================================================================
 *
 * **O par de `NOME_DO_MOTIVO_PAUSA`, e ele nasce sozinho.** Aqui **não** nasce a segunda coluna que o
 * motivo de pausa tem (`NOME_DO_MOTIVO_PAUSA` × `ROTULO_DE_PAUSA`), e a ausência é decisão: aquela
 * responde *"o que aconteceu com a sua ocorrência"* e é lida pelo Solicitante na lista e na linha do
 * tempo. **O rótulo do Solicitante para o cancelamento é do item 29** — a linha do tempo —, e nesta
 * fatia ninguém o lê: T-03 mostra *"Cancelada"* nas duas colunas (`glossario.md:124`).
 *
 * **Os quatro primeiros textos são transcrição do protótipo** (`telas.html:2489-2504`). Os três do
 * Gestor foram confirmados pelo hub, e o do meio foi **trocado**: *"Fora do escopo **da organização**"*,
 * e não *"do condomínio"* — a palavra travaria o produto numa das três formas de Organização, que é o
 * que o `glossario.md:127-130` proíbe em rótulo novo.
 */
const NOME_DO_MOTIVO_CANCELAMENTO: Readonly<Record<MotivoCancelamento, string>> = {
  desistencia: "Desistência",
  resolvido_por_conta_propria: "Resolvido por conta própria",
  aberta_por_engano: "Aberta por engano",
  duplicada: "Duplicada",
  improcedente: "Improcedente",
  fora_de_escopo: "Fora do escopo da organização",
  sem_informacao_suficiente: "Sem informação suficiente",
};

export function nomeDoMotivoCancelamento(motivo: MotivoCancelamento): string {
  return NOME_DO_MOTIVO_CANCELAMENTO[motivo];
}

/**
 * A descrição da opção **Duplicada**, e ela é a única que tem uma.
 *
 * **Transcrição literal do protótipo** (`telas.html:2502-2503`), e é o texto que impede o defeito de
 * expectativa: quem escolhe *Duplicada* espera que o produto ligue as duas ocorrências, e o vínculo é
 * **evolução prevista** — é o mesmo campo que o `422 CAMPO_NAO_SUPORTADO` do critério 18.5 recusa em voz
 * alta do lado do servidor. Aqui a tela diz antes, para ninguém chegar lá.
 */
const DESCRICAO_DE_DUPLICADA =
  "Diga na observação qual é a outra ocorrência: o vínculo entre as duas ainda não existe nesta entrega.";

/**
 * Os pares **prontos e já filtrados por permissão**, para descer por prop até o modal de cancelamento.
 *
 * **Uma fonte, dois consumidores:** `motivosPermitidos` é a mesma função que o comando de aplicação
 * consulta para lançar o `422`. Duas listas divergiriam, e a divergência seria um motivo oferecido em
 * tela que o servidor recusa no clique.
 *
 * **Recebe `permissoes`, e não um booleano `ehGestor`** — a página tem a lista na mão, e derivar de
 * `ehGestor` faria a tela ter uma segunda regra sobre qual permissão importa.
 *
 * **`valor` é `string`, e não `MotivoCancelamento`** — quem consome é componente de cliente, e tipo do
 * Domínio não atravessa essa fronteira. Mesma regra de `opcoesDeMotivoPausa`.
 */
export function opcoesDeMotivoCancelamento(
  permissoes: readonly string[],
): readonly { valor: string; rotulo: string; descricao?: string }[] {
  return motivosPermitidos(permissoes).map((motivo) =>
    motivo === "duplicada"
      ? {
          valor: motivo,
          rotulo: nomeDoMotivoCancelamento(motivo),
          descricao: DESCRICAO_DE_DUPLICADA,
        }
      : { valor: motivo, rotulo: nomeDoMotivoCancelamento(motivo) },
  );
}


/**
 * ============================================================================
 *  A segunda linha do item de T-03 — o critério 23.6, e é conserto que se remove sozinho
 * ============================================================================
 *
 * **A segunda linha só sai quando acrescenta informação.** Até o item **31**, o `statusRotulo` de todo
 * mundo é a coluna do Solicitante — e nela `pausada` **já traz o motivo dentro do rótulo**. Imprimir a
 * segunda linha ali produziria, no mesmo item:
 *
 * > Parada — esperando material chegar · Parada — esperando material chegar
 *
 * **A precondição está escrita, e hoje é falsa.** O `glossario.md` condiciona a segunda linha ao
 * rótulo colapsar em *"Pausada"*: *"o motivo precisa viajar como campo próprio ao lado do rótulo —
 * não embutido nele"*. Enquanto não colapsa, o motivo **está** dentro do rótulo e a segunda linha não
 * tem trabalho.
 *
 * **No dia em que o item 31 fizer o rótulo do Gestor virar "Pausada", os textos divergem, a linha
 * volta sozinha, e é o que o critério 14.3 pede.** Esta guarda **não é removida lá** — ela vira
 * verdadeira sozinha.
 *
 * **É uma função, e não duas condições `&&` repetidas nos dois recortes do Gestor.** Duas condições
 * que precisam concordar em dois lugares é o defeito que o item 22 consertou ao criar `acaoPrimaria`.
 */
export function segundaLinhaDeMotivo(
  motivo: MotivoPausa | null,
  statusRotulo: string,
): string | null {
  if (motivo === null) return null;
  const rotulo = rotuloDeMotivoPausa(motivo);
  return rotulo === statusRotulo ? null : rotulo;
}

/**
 * ============================================================================
 *  A coluna do Gestor — o nome do status como OPÇÃO DE FILTRO
 * ============================================================================
 *
 * **É a mesma tabela do glossário §4, na outra coluna** (`contrato-de-api.md`) — não é rótulo novo e não é
 * rótulo montado no navegador. Ela existe separada do `rotuloDeStatus` porque responde outra pergunta:
 * *"qual conjunto você quer"*, e não *"o que está acontecendo com a sua ocorrência"*.
 *
 * **A coluna do Solicitante não serviria**, e a razão é mecânica: nela `pausada` tem **quatro** rótulos,
 * um por motivo, e uma opção de filtro não tem motivo.
 *
 * **Não é a segunda cópia que o contrato §8.8 recusa** — essa seria montar rótulo no navegador, e aqui os
 * rótulos descem prontos do Server Component para a barra.
 *
 * **Custo declarado, e temporário:** até o item **31**, o chip diz *"Aberta"* enquanto o item da lista diz
 * *"Recebida — aguardando análise"* — dois vocabulários para o mesmo status na mesma tela. É o custo que a
 * spec do item 11 já declarou ao escolher uma coluna só, ficando visível lado a lado. Achado **A-6**.
 */
const NOME_DO_STATUS: Readonly<Record<StatusOcorrencia, string>> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  em_atendimento: "Em atendimento",
  pausada: "Pausada",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

const NOME_DA_PRIORIDADE: Readonly<Record<Prioridade, string>> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
};

export function nomeDoStatus(status: StatusOcorrencia): string {
  return NOME_DO_STATUS[status];
}

export function nomeDaPrioridade(prioridade: Prioridade): string {
  return NOME_DA_PRIORIDADE[prioridade];
}

/**
 * Os três pares **prontos**, para descer por prop até o seletor de T-05 e até a barra de filtros de T-03.
 *
 * **Existe para que `app/` e o navegador não montem rótulo**, que é a mesma razão de `opcoesDeMotivoPausa()`
 * logo acima. Importar `PRIORIDADES` de dentro de um componente de cliente arrastaria `@/dominio/ocorrencia`
 * inteiro para o pacote do navegador.
 *
 * **`valor` é `string`, e não `Prioridade`** — quem consome é componente de cliente, e tipo do Domínio não
 * atravessa essa fronteira. É também o que torna o retorno atribuível a `OpcaoDeFiltro`
 * (`barra-de-filtros.tsx:16`) sem conversão.
 *
 * **Usa `nomeDaPrioridade`, deste módulo, e NÃO o `rotuloDePrioridade` de `componentes/rotulos.ts`** — os
 * dois devolvem as mesmas três palavras, e `rotulos.ts:8` já importa **daqui**: chamá-lo fecharia um ciclo.
 * *(Que existam duas funções para o mesmo texto é achado do plano desta fatia, não conserto dela.)*
 *
 * **A ordem é a de `PRIORIDADES`** — `baixa · normal · alta` —, que é a escala, e é o que faz o seletor ler
 * na mesma direção que o filtro de T-03.
 */
export function opcoesDePrioridade(): readonly { valor: string; rotulo: string }[] {
  return PRIORIDADES.map((prioridade) => ({ valor: prioridade, rotulo: nomeDaPrioridade(prioridade) }));
}

/**
 * O recorte aplicado, em cláusulas — o subtítulo do **terceiro vazio** (critério 15.6).
 *
 * **A forma é mecânica de propósito, e diverge do exemplo que o critério ilustra.** O 15.6 mostra
 * *"Nenhuma **pausada** com prioridade **alta** em Recanto Azul."*, que depende de concordância em
 * português: funciona para `pausada`, `aberta`, `resolvida` e `cancelada`, e **quebra** para `em_analise`
 * e `em_atendimento` — *"Nenhuma em análise com…"*. Com dois valores na mesma dimensão quebra sempre:
 * *"Nenhuma pausada, aberta com…"*.
 *
 * **A saída é reusar o rótulo do chip.** *"Status: Pausada · Prioridade: Alta"* não precisa concordar com
 * nada, é literalmente o que a pessoa marcou, e mantém **um vocabulário só** na tela. Quem monta a frase
 * em volta — *"Em Recanto Azul, com …"* — é a página, que é quem sabe o nome da organização. Foi ao hub
 * como **P2** do plano, e segue pela opção recomendada até alguém dizer o contrário.
 *
 * **`nomeDaCategoria` devolve `undefined` para a categoria desativada que veio na URL** (§3.8 da spec), e
 * aí a cláusula conta em vez de nomear — nunca inventa nome.
 */
export function descricaoDoRecorte(
  filtro: FiltroDeOcorrencias,
  nomeDaCategoria: (id: string) => string | undefined,
): readonly string[] {
  const clausulas: string[] = [];

  if (filtro.status !== undefined) {
    clausulas.push(`Status: ${filtro.status.map(nomeDoStatus).join(", ")}`);
  }

  if (filtro.categoriaId !== undefined) {
    const nomes = filtro.categoriaId.map(nomeDaCategoria).filter((nome) => nome !== undefined);
    clausulas.push(
      nomes.length === filtro.categoriaId.length
        ? `Categoria: ${nomes.join(", ")}`
        : // **`selecionado`, masculino, concordando com o "valor" implícito** — e é a MESMA palavra que o
          // chip usa (`Status: 2 selecionados`, §3.5 da spec). Duas superfícies mostrando o mesmo recorte
          // com duas palavras diferentes seria o começo de dois vocabulários.
          `Categoria: ${filtro.categoriaId.length} selecionado${filtro.categoriaId.length > 1 ? "s" : ""}`,
    );
  }

  if (filtro.prioridade !== undefined) {
    clausulas.push(`Prioridade: ${filtro.prioridade.map(nomeDaPrioridade).join(", ")}`);
  }

  if (filtro.apenasDoAutor === true) clausulas.push("Só as minhas");

  return clausulas;
}

/** O schema `RegistroDeTransicao` do contrato. **`sequencia` não sai** — é ordem interna da trilha. */
export function projetarTransicao(lida: TransicaoLida) {
  return {
    statusAnterior: lida.statusAnterior,
    statusNovo: lida.statusNovo,
    ocorreuEm: lida.ocorreuEm,
    autor: lida.autor,
    observacao: lida.observacao,
    motivoPausa: lida.motivoPausa,
    motivoCancelamento: lida.motivoCancelamento,
  };
}

/**
 * ============================================================================
 *  Os eventos da linha do tempo — as TRÊS formas, desde o item 30
 * ============================================================================
 *
 * **Por que não reusar `projetarTransicao`.** Os nomes divergem no contrato **de propósito**: a trilha diz
 * `ocorreuEm` e a linha do tempo diz `ocorridoEm`; a trilha não tem `rotulo` e a linha do tempo não tem
 * `sequencia`. São *"duas leituras sobre os mesmos fatos, com vocabulários diferentes"*
 * (`contrato-de-api.md` §8.5), e forçar uma função a servir as duas apagaria a distinção que o glossário
 * existe para manter — chamar a outra e renomear campo é a mesma cópia com um passo a mais.
 *
 * **É AQUI que o `rotulo` é calculado, e não na função de aplicação.** `src/aplicacao/` não importa
 * `@/interface/**` (ADR-0006, regra 3), e é a projeção que o contrato nomeia como dona dos formatos
 * (§8.8).
 *
 * **A lente entra por PARÂMETRO, e não é derivada aqui.** Diferente de `projetarOcorrenciaDetalhe`, esta
 * função não recebe `QuemLe` — um evento não tem leitor embutido —, então quem a chama decide. São duas
 * estradas, e as duas têm a lente na mão de graça: `ctx.vinculo` na rota e `vinculo` no Server Component
 * de T-05.
 *
 * **Em `pausada` o Gestor lê *"Pausada"* seca** — critério 31.7, e é a descrição do campo `rotulo` no
 * `openapi.yaml:2994-3006`, não decisão desta função. O motivo viaja no campo `motivoPausa` logo abaixo,
 * *"como campo próprio ao lado do rótulo — não embutido nele"* (`glossario.md:137-139`).
 *
 * **As TRÊS formas existem desde o item 30.** `mensagem` é a última, e ela fecha o `oneOf` que o
 * `openapi.yaml` publica desde sempre. **O mesmo texto aparece no bloco 4 de T-05**, sem aspas — e a
 * duplicação é intencional, não defeito a corrigir: a linha do tempo diz *o que aconteceu*, a conversa é
 * *onde se escreve* (critério 30.8).
 */
export function projetarEventoDaLinhaDoTempo(evento: EventoLido, lente: LenteDeRotulo) {
  if (evento.tipo === "atribuicao") {
    return {
      tipo: "atribuicao" as const,
      ocorridoEm: evento.ocorridoEm,
      // **O autor é quem ATRIBUIU.** O responsável tem campo próprio, e trocá-los seria a colisão nº 2
      // do glossário virando payload.
      autor: evento.atribuicao.autor,
      responsavel: evento.atribuicao.responsavel,
      encerradaEm: evento.atribuicao.encerradaEm,
      motivoEncerramento: evento.atribuicao.motivoEncerramento,
    };
  }

  if (evento.tipo === "mensagem") {
    // **O `EventoMensagem` do contrato, e ele tem quatro campos.** Sem `id`: a linha do tempo não é
    // caminho para alcançar uma mensagem, e o `oneOf` publicado não o traz.
    return {
      tipo: "mensagem" as const,
      ocorridoEm: evento.ocorridoEm,
      autor: evento.mensagem.autor,
      texto: evento.mensagem.texto,
    };
  }

  const transicao = evento.transicao;
  return {
    tipo: "transicao" as const,
    ocorridoEm: evento.ocorridoEm,
    autor: transicao.autor,
    rotulo: rotuloDeStatus(transicao.statusNovo, transicao.motivoPausa, lente),
    statusAnterior: transicao.statusAnterior,
    statusNovo: transicao.statusNovo,
    // Os três são **visíveis ao Solicitante** por decisão do hub (Q-API-3, resposta (a)) — critério 29.2.
    observacao: transicao.observacao,
    motivoPausa: transicao.motivoPausa,
    motivoCancelamento: transicao.motivoCancelamento,
  };
}

export type EventoDaLinhaDoTempoProjetado = ReturnType<typeof projetarEventoDaLinhaDoTempo>;

export type QuemLe = {
  pessoaId: string;
  /** `Vinculo.permissoes`. */
  permissoes: readonly string[];
};

/**
 * O schema `OcorrenciaDetalhe`.
 *
 * **`anexos` e `quantidadeDeAnexos` vêm do que o repositório leu** — desde o item 13b. O schema diz
 * *"lista vazia quando não há anexo — nunca `null`, para o cliente não precisar de dois caminhos de
 * leitura"*, e é o que `OcorrenciaLida.anexos` garante em tipo. A contagem é o comprimento da lista: no
 * detalhe os anexos já vieram, e uma segunda consulta para contá-los seria trabalho por nada.
 *
 * **`acoesDisponiveis` nunca vem nula e nunca vem ausente** — o campo é `required`, e a tela que
 * renderiza exatamente esta lista precisa distinguir *"não há o que fazer"* de *"a lista não veio"*.
 * Hoje ela sai vazia porque `COMANDOS_IMPLEMENTADOS` está vazia, e vazia é **verdade sobre o produto de
 * hoje**: nenhum dos onze endpoints de comando foi construído.
 *
 * **A lente do rótulo é DERIVADA de `quemLe.permissoes`, e não passada.** É a assimetria deliberada do
 * item 31: onde `QuemLe` já chega, um terceiro argumento que é função pura do segundo convidaria os dois
 * a discordarem — e são **onze rotas de comando** mais `GET /ocorrencias/{id}`, `POST /ocorrencias` e
 * T-05 em que isso poderia acontecer. **Nenhuma delas mudou de assinatura por causa do 31.**
 */
export function projetarOcorrenciaDetalhe(lida: OcorrenciaLida, quemLe: QuemLe) {
  return {
    id: lida.id,
    titulo: lida.titulo,
    status: lida.status,
    statusRotulo: rotuloDeStatus(lida.status, lida.motivoPausa, lenteDeRotulo(quemLe.permissoes)),
    motivoPausa: lida.motivoPausa,
    prioridade: lida.prioridade,
    categoria: { id: lida.categoria.id, nome: lida.categoria.nome, icone: lida.categoria.icone },
    area: lida.area,
    autor: lida.autor,
    responsavel: lida.responsavel,
    quantidadeDeAnexos: lida.anexos.length,
    /**
     * **Emitido no detalhe TAMBÉM, e é o `allOf`** — `OcorrenciaDetalhe` é
     * `allOf: [OcorrenciaResumo, …]` (`openapi.yaml:2890-2892`), então o campo entra junto, ao lado do
     * `avaliacao` que já mora aqui.
     *
     * **Não é redundância acidental: é a relação `quantidadeDeAnexos` ↔ `anexos`**, que este mesmo par de
     * schemas já carrega desde o item 13b. O resumo leva a resposta curta; o detalhe leva as duas porque
     * já tem o objeto na mão.
     */
    avaliada: lida.avaliacao !== null,
    registradaEm: lida.registradaEm,
    atualizadaEm: lida.atualizadaEm,
    descricao: lida.descricao,
    localizacaoComplemento: lida.localizacaoComplemento,
    anexos: lida.anexos.map((anexo) => projetarAnexo(lida.id, anexo)),
    solucaoAplicada: lida.solucaoAplicada,
    avaliacao: lida.avaliacao,
    ultimaTransicao: projetarTransicao(lida.ultimaTransicao),
    acoesDisponiveis: comandosDisponiveis({
      status: lida.status,
      permissoes: quemLe.permissoes,
      ehAutor: lida.autor.pessoaId === quemLe.pessoaId,
      // **A invariante 9, respondida sem custo:** `OcorrenciaLida.responsavel` existe desde o item 19, e
      // o `left join lateral` que o preenche já é pago pelo `SELECT_DA_OCORRENCIA`. Nenhuma consulta a
      // mais para saber se o botão aparece.
      temResponsavel: lida.responsavel !== null,
      jaAvaliada: lida.avaliacao !== null,
    }),
  };
}

/**
 * O schema `OcorrenciaResumo` do contrato — o que a **listagem** devolve.
 *
 * **`categoria` sai `{id, nome}` e o `icone` não entra**, e isso é decisão, não esquecimento (critério
 * 14.6): o payload embute campo emprestado quando ele carrega **significado** — `area.tipo` deriva
 * visibilidade —, e ícone não carrega nenhum. T-03 cruza contra `GET /categorias`, que já o traz.
 *
 * **`quantidadeDeAnexos` vem do repositório desde o item 13b** — subconsulta correlacionada, não coluna
 * materializada. **`responsavel` vem preenchido desde o item 19**, quando há atribuição vigente — a
 * projeção só repassa o que `OcorrenciaResumoLida` traz, e quem garante *uma no máximo* é
 * `atribuicoes_vigente_uk`, não este arquivo.
 *
 * **A lente entra por PARÂMETRO, e não derivada:** o resumo não recebe `QuemLe` e não precisa de
 * `pessoaId` — pedir o objeto inteiro para usar um campo seria alargar a assinatura sem razão.
 */
export function projetarOcorrenciaResumo(lida: OcorrenciaResumoLida, lente: LenteDeRotulo) {
  return {
    id: lida.id,
    titulo: lida.titulo,
    status: lida.status,
    statusRotulo: rotuloDeStatus(lida.status, lida.motivoPausa, lente),
    motivoPausa: lida.status === "pausada" ? lida.motivoPausa : null,
    prioridade: lida.prioridade,
    categoria: { id: lida.categoria.id, nome: lida.categoria.nome },
    area: lida.area,
    autor: lida.autor,
    responsavel: lida.responsavel,
    quantidadeDeAnexos: lida.quantidadeDeAnexos,
    avaliada: lida.avaliada,
    registradaEm: lida.registradaEm,
    atualizadaEm: lida.atualizadaEm,
  };
}

export type OcorrenciaResumoProjetada = ReturnType<typeof projetarOcorrenciaResumo>;

/**
 * O cursor opaco: `base64url` do par `(registradaEm, id)` — *"exatamente o índice já existente"*
 * (`contrato-de-api.md` §7.7).
 *
 * **Opaco de propósito.** O cliente não deve montar cursor: no dia em que a ordenação ganhar uma segunda
 * coluna, um cliente que tenha aprendido a forma quebra. O que ele guarda é o que veio.
 */
export function codificarCursor(item: { registradaEm: string; id: string }): string {
  return Buffer.from(`${item.registradaEm}|${item.id}`, "utf8").toString("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * O caminho de volta — `null` quando o valor não é um cursor desta API.
 *
 * **`Buffer.from(x, "base64url")` não estoura com lixo: ele ignora o que não é do alfabeto.** Por isso a
 * validação real acontece **depois** de decodificar, sobre o conteúdo: duas partes, uma data que o
 * `Date.parse` entende, e um `uuid`. Sem isso, `?cursor=pagina-2` viraria uma consulta com data
 * `Invalid Date` — e um `500` no lugar do `400` que o contrato manda.
 */
export function decodificarCursor(bruto: string): CursorDeListagem | null {
  if (bruto === "") return null;

  const partes = Buffer.from(bruto, "base64url").toString("utf8").split("|");
  if (partes.length !== 2) return null;

  const [registradaEm, id] = partes;
  if (registradaEm === undefined || id === undefined) return null;
  if (Number.isNaN(Date.parse(registradaEm))) return null;
  if (!UUID.test(id)) return null;

  return { registradaEm, id };
}

/**
 * O envelope de `GET /ocorrencias` — **e o da estrada direta de T-03**, que é a mesma função.
 *
 * **`proximoCursor` é o do último item devolvido, e só existe com `temMais`.** Um cursor emitido sem haver
 * próxima página produziria um *"Carregar mais"* que devolve zero itens — o vazio que é defeito chegando
 * como `200`, que é a classe do achado R-15 do protótipo.
 */
export function projetarPaginaDeOcorrencias(pagina: PaginaDeOcorrencias, lente: LenteDeRotulo) {
  const ultimo = pagina.itens[pagina.itens.length - 1];

  return {
    itens: pagina.itens.map((item) => projetarOcorrenciaResumo(item, lente)),
    proximoCursor: pagina.temMais && ultimo !== undefined ? codificarCursor(ultimo) : null,
    visibilidadeAplicada: pagina.visibilidadeAplicada,
  };
}

export type PaginaDeOcorrenciasProjetada = ReturnType<typeof projetarPaginaDeOcorrencias>;

/**
 * O schema `Comentario` do contrato — `{id, texto, autor, criadoEm}` e nada mais.
 *
 * **É cópia de campo, e é de propósito.** `ComentarioLido` e o schema publicado têm hoje exatamente os
 * mesmos quatro campos, e devolver o modelo de leitura cru faria o payload seguir qualquer coluna que a
 * porta viesse a ganhar — que é como um `canalId` chega ao cliente sem ninguém decidir.
 */
export function projetarComentario(lido: ComentarioLido) {
  return {
    id: lido.id,
    texto: lido.texto,
    autor: lido.autor,
    criadoEm: lido.criadoEm,
  };
}

export type ComentarioProjetado = ReturnType<typeof projetarComentario>;

/**
 * O cursor da conversa, **reusando o codificador que já existe**.
 *
 * `codificarCursor`/`decodificarCursor` codificam `base64url` de `data|uuid` e validam na volta *duas
 * partes, uma data que o `Date.parse` entende, e um `uuid`*. **A validação é genérica; só o nome do campo
 * é da listagem.** Dois adaptadores de três linhas custam menos que a segunda cópia dessa validação — e a
 * cópia da validação é a que sempre diverge.
 *
 * *Recusado — reusar `CursorDeListagem` cru:* faria `registradaEm` carregar o `criado_em` de uma
 * mensagem, e o nome mentiria em `portas.ts`, em `conversa.ts` e no SQL.
 * *Recusado — generalizar o tipo para `{ instante, id }`:* é o certo a longo prazo, e custa renomear um
 * campo em seis sítios do código do 14 e do 15, que esta fatia não tem outra razão para abrir. **Fica
 * declarado como o conserto barato do dia em que houver um terceiro recurso paginado.**
 */
export function codificarCursorDeConversa(cursor: { criadoEm: string; id: string }): string {
  return codificarCursor({ registradaEm: cursor.criadoEm, id: cursor.id });
}

export function decodificarCursorDeConversa(bruto: string): CursorDeConversa | null {
  const cursor = decodificarCursor(bruto);
  return cursor === null ? null : { criadoEm: cursor.registradaEm, id: cursor.id };
}

/**
 * O envelope de `GET /ocorrencias/{id}/comentarios` — **e o da estrada direta do bloco 4**, que é a mesma
 * função.
 *
 * **`proximoCursor` é o do último item devolvido, e só existe com `temMais`** — a mesma regra de
 * `projetarPaginaDeOcorrencias`, e pela mesma razão: um cursor emitido sem haver próxima página produz um
 * *Carregar mais* que devolve zero itens.
 *
 * **Sem `total`, de propósito** (contrato §7.7). É por isso que a tela só mostra a contagem quando
 * `proximoCursor` é nulo: o número que ela tem é *"quantas foram carregadas"*.
 */
export function projetarPaginaDeComentarios(pagina: PaginaDeConversa) {
  const ultimo = pagina.itens[pagina.itens.length - 1];

  return {
    itens: pagina.itens.map(projetarComentario),
    proximoCursor:
      pagina.temMais && ultimo !== undefined
        ? codificarCursorDeConversa({ criadoEm: ultimo.criadoEm, id: ultimo.id })
        : null,
  };
}

export type PaginaDeComentariosProjetada = ReturnType<typeof projetarPaginaDeComentarios>;
