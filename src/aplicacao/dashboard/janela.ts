/**
 * ============================================================================
 *  A janela do dashboard — e o único lugar de `src/` que escreve o fuso
 * ============================================================================
 *
 * **O dashboard é a exceção declarada da §7.5 do contrato.** Toda data do produto sai em UTC e é o cliente
 * quem converte; aqui não dá: *"agregação mês a mês em UTC parte o mês brasileiro em dois, e o indicador
 * passaria a depender do fuso do servidor"*. Por isso `de` e `ate` são `date`, interpretados em
 * America/Sao_Paulo, e o recorte para UTC acontece na consulta.
 *
 * **`FUSO` é exportado, e é a razão de este arquivo existir separado.** O repositório escopado precisa do
 * mesmo nome dentro do SQL — `at time zone` e `date_trunc` —, e duas cópias de um nome de fuso divergem
 * exatamente uma vez, em silêncio, e depois de alguém mudar uma delas.
 */

/** A exceção da §7.5 do `contrato-de-api.md`, escrita uma vez. */
export const FUSO = "America/Sao_Paulo";

/**
 * **90 dias contando as DUAS pontas.** O protótipo desenha *"de 01/06/2026 · até 29/08/2026 · últimos 90
 * dias"* (`telas.html:3445-3448`), e de 1º de junho a 29 de agosto há exatamente 90 dias com os dois
 * extremos dentro. Logo `de = ate − 89`, e é isso que a constante significa quando usada.
 */
export const DIAS_DA_JANELA = 90;

const UM_DIA = 86_400_000;

/** A janela já resolvida. As duas datas em `YYYY-MM-DD`, e as duas **dentro** do período. */
export type Janela = { de: string; ate: string };

/** O que o cliente pediu. Campo ausente é *"decida por mim"*, nunca `null`. */
export type JanelaPedida = { de?: string; ate?: string };

/**
 * **`formatToParts`, e não o formato de um `locale`.** `Intl.DateTimeFormat("en-CA").format` devolve
 * `2026-08-29` hoje, e isso é comportamento de biblioteca de locale — não contrato. Ler as partes
 * nomeadas e montar a string é o que não quebra numa atualização do ICU.
 */
const PARTES_DO_DIA = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partes(instante: Date): { ano: string; mes: string; dia: string } {
  const lidas = PARTES_DO_DIA.formatToParts(instante);
  const parte = (tipo: "year" | "month" | "day"): string =>
    lidas.find((p) => p.type === tipo)?.value ?? "";
  return { ano: parte("year"), mes: parte("month"), dia: parte("day") };
}

/** O dia em São Paulo, `YYYY-MM-DD`. */
export function diaEmSaoPaulo(instante: Date): string {
  const { ano, mes, dia } = partes(instante);
  return `${ano}-${mes}-${dia}`;
}

/** O mês em São Paulo, `YYYY-MM` — o mesmo rótulo que o SQL produz com `date_trunc`. */
export function mesEmSaoPaulo(instante: Date): string {
  const { ano, mes } = partes(instante);
  return `${ano}-${mes}`;
}

/**
 * Recua `dias` a partir de um `YYYY-MM-DD`, **fazendo a conta em UTC**.
 *
 * **Não é descuido com o fuso: é o contrário.** Um dia UTC tem sempre 86 400 000 ms; um dia local não tem,
 * onde há horário de verão. O Brasil não tem desde 2019, e o argumento não deveria depender disso — a
 * aritmética acontece num calendário sem exceção, e a tradução para São Paulo já aconteceu antes, em
 * `diaEmSaoPaulo`.
 */
function recuar(dia: string, dias: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) - dias * UM_DIA).toISOString().slice(0, 10);
}

/**
 * Os quatro casos da §3.2 da spec, numa função.
 *
 * **O padrão mora aqui, e não na camada de Interface**, pela mesma razão do `?limite=` e do `?situacao=`:
 * *"quem decide o que acontece quando ninguém pede nada é a camada de Aplicação"* (`consulta-de-url.ts`).
 * A Interface traduz e recusa; ela não sabe o que são 90 dias.
 *
 * **`periodo` sempre volta preenchido**, nunca `null` — é o critério 32.1, e é o que faz o endereço da
 * tela ser compartilhável mesmo quando ninguém escolheu nada.
 *
 * **`agora` é injetável pela mesma razão de `ctx.agora` nos comandos:** um teste de janela que dependa do
 * relógio da máquina é um teste que muda de resultado à meia-noite de Brasília.
 */
export function resolverJanela(pedida: JanelaPedida, agora?: string): Janela {
  const hoje = diaEmSaoPaulo(agora === undefined ? new Date() : new Date(agora));
  const ate = pedida.ate ?? hoje;
  return { de: pedida.de ?? recuar(ate, DIAS_DA_JANELA - 1), ate };
}

/**
 * **Todo mês que a janela toca, do mais antigo para o mais novo** — e é UM eixo, usado pelas duas séries.
 *
 * O critério 36.2 pede isso para o tempo médio — *"nenhum mês é omitido"* —, e a razão que o contrato dá
 * vale igual para a recorrência: *"buraco na série é informação, e omitir o mês faria a linha do gráfico
 * mentir"*.
 *
 * **Um mês parcial continua sendo um mês.** Janela que começa em 15/06 tem `2026-06` na série, com o que
 * houve de 15 a 30 — não se arredonda para o mês inteiro nem se descarta a ponta.
 *
 * **Janela invertida devolve um mês e para**, em vez de girar para sempre: `de > ate` é `400` na camada de
 * Interface e não chega aqui, mas uma função que dependa disso para terminar é uma função que trava no dia
 * em que alguém a chamar de outro lugar.
 */
export function mesesDaJanela(janela: Janela): readonly string[] {
  const ultimo = janela.ate.slice(0, 7);
  const meses: string[] = [];

  let ano = Number(janela.de.slice(0, 4));
  let mes = Number(janela.de.slice(5, 7));

  for (;;) {
    const rotulo = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
    meses.push(rotulo);
    if (rotulo >= ultimo) return meses;

    mes += 1;
    if (mes === 13) {
      mes = 1;
      ano += 1;
    }
  }
}
