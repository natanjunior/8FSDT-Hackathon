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
 * **A unidade é escolha da tela, e a API não muda** (critério 55.4): ela continua devolvendo horas com
 * uma casa decimal, que é o que o `openapi.yaml` exemplifica. A consequência declarada é que os minutos
 * andam de seis em seis — `0.1 h` é `6 min` e não existe `9 min`. O defeito consertado é o zero, e a
 * precisão abaixo de seis minutos custaria mudança de contrato.
 *
 * **O piso de um minuto é o que faz o critério 55.2 valer.** Sem ele meio minuto voltaria a ser zero, e o
 * item teria trocado um zero mentiroso por outro.
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
 */
export function duracaoEmTexto(horas: number): string {
  if (horas > TETO_DAS_HORAS) return `${DIAS.format(horas / HORAS_POR_DIA)} dias`;
  if (horas >= 1) return `${String(Math.round(horas))} h`;
  if (horas <= 0) return "0 min";

  const minutos = Math.max(1, Math.round(horas * MINUTOS_POR_HORA));
  return minutos === MINUTOS_POR_HORA ? "1 h" : `${String(minutos)} min`;
}
