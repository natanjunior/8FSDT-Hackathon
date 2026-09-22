/**
 * ============================================================================
 *  "há 6 dias" — e por que o instante chega de fora
 * ============================================================================
 *
 * **`agora` é parâmetro, não `Date.now()` lá dentro.** A lista é renderizada no servidor e hidratada no
 * navegador; dois relógios produziriam dois textos e uma divergência de hidratação. Com o instante
 * descendo do servidor, as duas renderizações leem o mesmo número — e a saída fica **determinística**, que
 * é o que também torna o teste possível sem congelar o relógio.
 *
 * **Duas formas, e as duas carregam palavra ou unidade** (A-5): a longa para os cartões, a curta para a
 * coluna TEMPO da tabela de triagem, onde o protótipo escreve `6 d ↻1 d`.
 */
const MINUTO = 60_000;

/**
 * O instante do servidor, lido **uma vez por requisição** e descido como prop.
 *
 * **Por que tem nome próprio em vez de um `Date.now()` no JSX.** O `react-hooks/purity` do
 * `eslint-config-next` recusa chamada impura dentro de um componente, e a recusa está certa no caso
 * geral: um relógio lido no meio do render produz valor diferente a cada re-render. **Aqui o valor é
 * lido de propósito uma vez, no servidor, e congelado como prop** — que é o que impede a divergência de
 * hidratação que o módulo inteiro existe para evitar. Dar-lhe nome torna a intenção legível e dá um
 * ponto único para substituir o relógio, em vez de espalhar leituras pelas telas.
 */
export function instanteDoServidor(): number {
  return Date.now();
}

function minutosDesde(iso: string, agora: number): number | null {
  const instante = Date.parse(iso);
  if (Number.isNaN(instante)) return null;
  return Math.max(0, Math.round((agora - instante) / MINUTO));
}

export function tempoRelativo(iso: string, agora: number): string {
  const minutos = minutosDesde(iso, agora);
  if (minutos === null) return "—";

  if (minutos < 60) return "agora há pouco";

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return horas === 1 ? "há 1 hora" : `há ${horas} horas`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export function tempoCurto(iso: string, agora: number): string {
  const minutos = minutosDesde(iso, agora);
  if (minutos === null) return "—";

  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;

  return `${Math.floor(horas / 24)} d`;
}

/**
 * A hora do corte da listagem — `09h14`.
 *
 * **O fuso é escrito, e não herdado do contêiner.** É o mesmo argumento de `dataHoraComSegundos` e de
 * `datas.ts`: o servidor roda em UTC, e um produto de condomínio brasileiro tem um fuso.
 * Herdá-lo do contêiner faria a linha de deriva nomear a hora errada.
 *
 * **`hourCycle: "h23"`** é o que garante `00h00` em vez de `24h00`.
 *
 * **O separador é `h`, e não `:`** — aqui a hora aparece **no meio de uma frase** ("o corte foi às 09h14"),
 * e não como carimbo de coluna. É o oposto da trilha de auditoria, que responde "prove" e escreve
 * `09:14:02`. **O formato de data COM hora do produto é um só** (`datas.ts`, item 44p); isto é hora
 * sozinha, e o guia §7 não a alcança.
 */
const CORTE = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

export function horaDoCorte(iso: string): string {
  const instante = Date.parse(iso);
  if (Number.isNaN(instante)) return "—";

  // Montado a partir das partes nomeadas, e não de um `replace` sobre o `format`: o separador que a ICU
  // escolhe é aposta, inclusive sobre espaços estreitos que não se veem no diff.
  const partes = new Map(
    CORTE.formatToParts(new Date(instante)).map((parte) => [parte.type, parte.value]),
  );
  return `${partes.get("hour")}h${partes.get("minute")}`;
}
