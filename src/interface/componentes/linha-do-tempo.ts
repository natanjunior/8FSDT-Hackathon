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
 */

/**
 * O formatador único da linha do tempo, **com o fuso escrito**.
 *
 * *"O servidor roda em UTC … Sem `timeZone`, o pedido enviado às 22h de uma terça apareceria como 01h de
 * quarta. … Um produto de condomínio brasileiro tem um fuso, e escrevê-lo é mais honesto que herdar o do
 * contêiner"* — o argumento é de `app/organizacao/page.tsx:166-177`, e aqui ele vale multiplicado: onde
 * T-05 mostrava uma data, passa a mostrar de quatro a dez.
 *
 * **`hourCycle: "h23"` e não `hour12: false`**, porque é o que garante `00h00` em vez de `24h00`.
 */
const FORMATO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

/**
 * `15/08/2026, 09h40`.
 *
 * **Montado a partir das partes nomeadas, e não de um `replace` sobre o `format`.** `pt-BR` devolve
 * `15/08/2026, 09:40`, e trocar o `:` por `h` com `String.replace` seria uma aposta sobre qual separador
 * a ICU escolhe — inclusive sobre espaços estreitos que não se veem no diff. As partes têm nome.
 *
 * **Recusado — `tempoRelativo`** (`tempo-relativo.ts`): *"há 6 dias"* repetido em oito eventos
 * consecutivos apaga a cronologia, que é a única coisa que uma linha do tempo tem para dar. E o
 * `ontem, 16h40` do protótipo é uma **terceira** forma, com regra de relógio, que fica declaradamente de
 * fora (§3.10 da spec).
 */
export function dataHora(iso: string): string {
  const partes = new Map(
    FORMATO.formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]),
  );
  return `${partes.get("day")}/${partes.get("month")}/${partes.get("year")}, ${partes.get("hour")}h${partes.get("minute")}`;
}

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
