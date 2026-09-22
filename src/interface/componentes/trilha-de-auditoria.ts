/**
 * ============================================================================
 *  O carimbo de T-06 — e por que ele NÃO é o `dataEHora` do produto
 * ============================================================================
 *
 * **Módulo puro, sem um único `import`** — o mesmo desenho de `linha-do-tempo.ts`, e pela mesma razão:
 * um módulo que só recebe e devolve `string` atravessa qualquer fronteira sem arrastar nada, e é
 * testável no laço curto, sem navegador.
 *
 * **Os segundos são o que separa as duas formas, e é decisão.** `dataEHora` (`datas.ts`) devolve
 * `03/08/2026 · 09:14` e serve a leitura de acompanhamento — *"o que está acontecendo"*. A trilha
 * responde outra pergunta: *"prove"*. O protótipo desenha a coluna **Quando** com segundos nos quatro
 * quadros de T-06 (`docs/prototipo/telas.html:3037` em diante), e é o que faz duas transições no mesmo
 * minuto continuarem distinguíveis numa tela que se leva para a assembleia.
 *
 * **O fuso é escrito, e não herdado do contêiner.** O argumento é o de `app/organizacao/page.tsx:166-177`:
 * *"o servidor roda em UTC … um produto de condomínio brasileiro tem um fuso, e escrevê-lo é mais honesto
 * que herdar o do contêiner"*. Numa tela de auditoria, herdar o fuso do contêiner é registrar a hora
 * errada para sempre.
 *
 * **`hourCycle: "h23"` e não `hour12: false`**, porque é o que garante `00:00:00` em vez de `24:00:00`.
 *
 * **O separador é `:` e não `h`** — é o do protótipo, e é o que se lê como carimbo em vez de como frase.
 */
const FORMATO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

/**
 * O travessão que ocupa o lugar de um campo nulo — `statusAnterior` no registro de criação (premissa P1)
 * e `observacao` ausente.
 *
 * **Escrito uma vez, e é o mesmo caractere do protótipo** (`—`, travessão, não hífen). Duas telas com
 * dois traços diferentes para o mesmo nada seria o começo de dois vocabulários.
 */
export const CAMPO_VAZIO = "—";

/**
 * `03/08/2026 · 09:14:02`.
 *
 * **Montado a partir das partes nomeadas**, e não de um `replace` sobre o `format`: `pt-BR` devolve
 * `03/08/2026, 09:14:02` e remover a vírgula com `String.replace` seria uma aposta sobre qual separador a
 * ICU escolhe — inclusive sobre espaços estreitos que não se veem no diff. As partes têm nome.
 *
 * **O ` · ` entre dia e hora é a regra de data de 16/09/2026** (critério 44n.14), e é o mesmo separador
 * que o resto do produto usa em `dd/mm/aaaa · hh:mm`. O que é exceção aqui são os segundos, não o ponto.
 */
export function dataHoraComSegundos(iso: string): string {
  const partes = new Map(
    FORMATO.formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]),
  );
  return `${partes.get("day")}/${partes.get("month")}/${partes.get("year")} · ${partes.get("hour")}:${partes.get("minute")}:${partes.get("second")}`;
}
