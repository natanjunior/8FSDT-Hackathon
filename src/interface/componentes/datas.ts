/**
 * ============================================================================
 *  As datas do produto — um formato, um endereço
 * ============================================================================
 *
 * **Módulo puro, sem um único `import`**, pelo mesmo requisito de `linha-do-tempo.ts`: ele é consumido
 * por servidor e por cliente, e um módulo que só recebe e devolve `string` atravessa a fronteira sem
 * arrastar nada.
 *
 * **O fuso é escrito, e não herdado do contêiner.** O servidor roda em UTC, e um produto de condomínio
 * brasileiro tem um fuso; herdá-lo faria a tela nomear a hora errada conforme onde a imagem subisse.
 *
 * **Montado a partir das partes nomeadas, e não de um `replace` sobre o `format`.** `pt-BR` devolve
 * `15/08/2026, 09:40`, e trocar a vírgula com `String.replace` seria uma aposta sobre qual separador a
 * ICU escolhe — inclusive sobre espaços estreitos que não se veem no diff. As partes têm nome.
 *
 * **Por que este arquivo nasceu** (item 44p, critério 17, 21/09/2026): o produto escrevia a mesma coisa
 * de duas formas — `20/09/2026, 21h44` na linha do tempo de T-05 e `20/09/2026 · 21:44` em T-08. A do
 * guia §7 é a segunda. A primeira morreu, e as duas funções que sobraram moravam num arquivo chamado
 * *frases de participantes*, endereço que nenhum chamador de T-05 encontraria.
 *
 * **A trilha de auditoria continua à parte**, e é a única exceção: `trilha-de-auditoria.ts` escreve
 * `dd/mm/aaaa · hh:mm:ss`. **O que é exceção lá são os segundos, não o separador.**
 */

const FUSO = "America/Sao_Paulo";

const DATA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: FUSO,
});

/** `hourCycle: "h23"` garante `00:00`, e não `24:00`. */
const DATA_E_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: FUSO,
});

function partes(formato: Intl.DateTimeFormat, iso: string): ReadonlyMap<string, string> {
  return new Map(formato.formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]));
}

/** `dd/mm/aaaa` (guia §7, *Texto de tela*). */
export function dataCurta(iso: string): string {
  const p = partes(DATA, iso);
  return `${p.get("day") ?? ""}/${p.get("month") ?? ""}/${p.get("year") ?? ""}`;
}

/** `dd/mm/aaaa · hh:mm` (guia §7, *Texto de tela*). */
export function dataEHora(iso: string): string {
  const p = partes(DATA_E_HORA, iso);
  return `${p.get("day") ?? ""}/${p.get("month") ?? ""}/${p.get("year") ?? ""} · ${p.get("hour") ?? ""}:${p.get("minute") ?? ""}`;
}
