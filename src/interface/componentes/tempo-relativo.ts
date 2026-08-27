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
