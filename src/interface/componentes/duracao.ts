/**
 * ============================================================================
 *  A duração do produto — uma unidade por magnitude, um endereço
 * ============================================================================
 *
 * **Módulo puro, sem um único `import`**, pelo mesmo requisito de `datas.ts`: ele é consumido por
 * servidor e por cliente, e um módulo que só recebe e devolve primitivo atravessa a fronteira sem
 * arrastar nada.
 *
 * **Por que ele nasceu** (item 55, 23/09/2026): o painel formatava a duração com
 * `maximumFractionDigits: 0` dentro do `.tsx` que desenha, e uma ocorrência resolvida em nove minutos
 * chegava como `0.2` e aparecia como `0 h`, afirmando instantaneidade. Apareceu em produção.
 *
 * **A unidade é escolha da tela** (critério 55.1): a API devolve horas, e quem decide se isso se lê em
 * minutos, em horas ou em dias é este módulo. Desde o item 62 o número chega com **quatro** casas e
 * nunca chega como zero quando a duração foi maior que zero (`arredondarHoras`, em
 * `src/aplicacao/dashboard/indicadores.ts`).
 *
 * **O degrau de baixo é `menos de 1 min`** (critério 62.1), e vale para tudo entre zero e um minuto
 * cheio. Antes dele havia um piso de `1 min`, que só rodava para `horas > 0`, e o arredondamento de duas
 * casas entregava um `0` exato antes do piso: a Aurora escreveu `mediana 0 min` com 44 resolvidas.
 *
 * **Zero é o travessão, `SEM_DURACAO`** (critério 62.3), o mesmo símbolo que o mês sem resolução
 * escreve. Ausência e quantidade não dividem texto: `—` não é duração, `menos de 1 min` é.
 *
 * **`60 min` é promovido a `1 h`, e isso é correção de arredondamento, não mudança de faixa.** Escrever
 * `60 min` seria a tela usando uma unidade para dizer o valor da seguinte.
 *
 * **Sem ramo de singular em `dias`:** a faixa começa acima de 48 horas, então o valor é no mínimo `2,0`.
 * `1 dia` é inalcançável por construção, e ramo que nunca corre é ramo que ninguém testa. `min` e `h` são
 * símbolos, e símbolo não pluraliza.
 *
 * **Isto NÃO é `tempoCurto`, de `tempo-relativo.ts`, e os dois não se fundem.** Aquele responde *há
 * quanto tempo isto existe* — recebe um instante e o relógio do servidor, escreve `6 d` na coluna TEMPO
 * da triagem, e a escada dele é a do protótipo: minutos até 60, horas até 24, dias acima. Este responde
 * *quanto tempo isto levou* — recebe um número de horas que a API mediu, e a escada é a do critério 55.1,
 * com o corte em 48 horas e a casa decimal nos dias. **Mesma família de palavras, duas perguntas
 * diferentes, e os limiares divergem de propósito.** Unificá-los mudaria a coluna TEMPO de T-03, que não
 * é escopo de item nenhum deste lote.
 *
 * **A casa decimal sai da ICU, e não de um `replace`** — o mesmo argumento do cabeçalho de `datas.ts`.
 * `minimumFractionDigits` não é enfeite ao lado do máximo: sem ele `72 h` escreveria `3 dias`, que promete
 * precisão diferente da linha de cima.
 */

/** O limite INCLUSIVO da faixa de horas. Acima dele a tela conta em dias (critério 55.1). */
const TETO_DAS_HORAS = 48;

const MINUTOS_POR_HORA = 60;
const HORAS_POR_DIA = 24;

/** O que se escreve quando não houve duração a medir (critério 62.3). */
export const SEM_DURACAO = "—";

/** O degrau de baixo: maior que zero e menor que um minuto cheio (critério 62.1). */
const MENOS_DE_UM_MINUTO = "menos de 1 min";

const DIAS = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * A duração em texto, na unidade que cabe à magnitude (critério 55.1).
 *
 * **Pré-condição: `horas` é finito e não negativo.** A aplicação só produz o número quando houve
 * resolução, e resolução vem depois do registro (`src/aplicacao/dashboard/indicadores.ts`, `serieDeResolucao`
 * devolve `null` quando `resolvidas === 0`). Não há ramo defensivo porque não há entrada defensável.
 *
 * **Acima do corte de um minuto, `round` nunca devolve zero**: `horas × 60 ≥ 1` arredonda no mínimo para
 * `1`. Por isso o `Math.max(1, …)` do item 55 saiu.
 */
export function duracaoEmTexto(horas: number): string {
  if (horas > TETO_DAS_HORAS) return `${DIAS.format(horas / HORAS_POR_DIA)} dias`;
  if (horas >= 1) return `${String(Math.round(horas))} h`;
  if (horas <= 0) return SEM_DURACAO;

  const minutosExatos = horas * MINUTOS_POR_HORA;
  if (minutosExatos < 1) return MENOS_DE_UM_MINUTO;

  const minutos = Math.round(minutosExatos);
  return minutos === MINUTOS_POR_HORA ? "1 h" : `${String(minutos)} min`;
}
