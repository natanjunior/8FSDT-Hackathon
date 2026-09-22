/**
 * ============================================================================
 *  A forma da linha do tempo — e ela é a mesma nos dois lugares
 * ============================================================================
 *
 * **Módulo puro, sem um único `import`, e isso é requisito e não estilo.** O consumidor de hoje é o bloco
 * 3 de T-05, que é servidor; o consumidor de amanhã é a **pré-visualização dentro dos modais** (critério
 * 29.6), que é cliente. `rotulos.ts` não serviria: ele importa `@/interface/projecoes`, e com ele viria
 * `comandosDisponiveis` — a máquina de estados inteira para dentro do pacote do navegador. É a mesma
 * razão pela qual `comando-de-ocorrencia.ts` recebe `rotulosDeStatus` **por parâmetro**. Um módulo que só
 * recebe e devolve `string` atravessa a fronteira sem arrastar nada.
 *
 * ---------------------------------------------------------------------------
 *  O limite da pré-visualização — **parcial por decisão, não por esquecimento**
 * ---------------------------------------------------------------------------
 *
 * O protótipo manda que todo modal com `observacao` mostre *"uma pré-visualização do que a pessoa acabou
 * de escrever, na forma em que o Solicitante vai lê-la"* — e essa forma é esta. **Mas ela mostra o TEXTO,
 * e nunca o `statusRotulo` que o Solicitante lê junto:** o rótulo é calculado no servidor em função de
 * quem lê (`contrato-de-api.md` §8.8), e **nenhum endpoint devolve o rótulo do outro lado** — o Gestor não
 * tem como obter *"Parada — esperando material chegar"* em lugar nenhum da API. Montá-lo no cliente seria
 * a segunda cópia da tabela de rótulos. É o achado **P-10** do protótipo, e é a razão de
 * `fraseDaTransicao` receber o `rotulo` **pronto** em vez de calculá-lo.
 *
 * **Cada modal adota isto quando for tocado.** Ninguém promete voltar nos cinco já construídos — decisão
 * do hub ao criar o critério 29.6.
 *
 * **A data com hora não mora mais aqui** (item 44p, critério 17): ela é `dataEHora` de `datas.ts`, e a
 * forma é a do guia §7 — `dd/mm/aaaa · hh:mm`. O `15/08/2026, 09h40` que este módulo escrevia era o
 * segundo formato do produto, e o guia decidiu o outro em 16/09/2026.
 */

/**
 * `Em análise. “Vou ver se a garagem já teve infiltração nesse ponto.”`
 *
 * **As aspas são curvas**, que é como o protótipo as desenha nos dois recortes — e é o que distingue, sem
 * etiqueta, *o que o sistema registrou* de *o que uma pessoa escreveu*.
 */
export function fraseDaTransicao(rotulo: string, observacao: string | null): string {
  return observacao === null ? `${rotulo}.` : `${rotulo}. “${observacao}”`;
}

/**
 * `Antônio Ferreira ficou responsável.`
 *
 * **A atribuição encerrada não ganha frase própria.** `encerradaEm` e `motivoEncerramento` viajam no
 * payload porque o critério 29.3 os exige, mas a tela não escreve *"…até terça"*: uma reatribuição já
 * produz o evento seguinte logo abaixo, e a leitura fica correta sem uma segunda frase. **O que se lê é
 * quem ficou responsável, na ordem em que ficou.**
 */
export function fraseDaAtribuicao(nomeDoResponsavel: string, ehQuemLe: boolean): string {
  return ehQuemLe ? "Você ficou responsável." : `${nomeDoResponsavel} ficou responsável.`;
}

/**
 * `“Continua pingando, e agora molha a vaga inteira quando chove.”`
 *
 * **As aspas são curvas**, e são a convenção que o item 29 fixou: é o que distingue, sem etiqueta, *o que
 * o sistema registrou* de *o que uma pessoa escreveu*. `fraseDaTransicao` usa as mesmas para a
 * `observacao`.
 *
 * **No bloco 4 o mesmo texto aparece SEM aspas** — porque ali tudo é texto de pessoa, e aspar tudo é
 * ruído. **Duas formas, as duas transcritas do protótipo** (critério 30.8).
 *
 * **Não há prefixo de rótulo**, ao contrário de `fraseDaTransicao`: a mensagem não tem estado a nomear, e
 * a autoria já vem na linha de cima, pelo `autoria()`.
 */
export function fraseDaMensagem(texto: string): string {
  return `“${texto}”`;
}

/**
 * `Marina Rocha · 15/08/2026, 09h40` — ou `Você · …` quando o autor é quem lê.
 *
 * **`ehQuemLe` é comparação de `pessoaId`, nunca papel** (§3.11 da spec), e por isso serve também ao
 * Gestor que é autor da própria ocorrência — o síndico morador do critério 28.5.
 *
 * **A segunda pessoa vale só na tela.** O payload da API traz `autor.pessoaId` e `autor.nome`, sempre: o
 * contrato não tem *"você"*, e quem monta a segunda pessoa é quem sabe quem está lendo.
 */
export function autoria(nome: string, ehQuemLe: boolean, quando: string): string {
  return `${ehQuemLe ? "Você" : nome} · ${quando}`;
}
