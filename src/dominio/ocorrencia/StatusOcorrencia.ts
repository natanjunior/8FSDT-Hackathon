/**
 * Os seis estados. Os cinco do enunciado (F1, `ENUNCIADO · literal`) mais `pausada`, que é **NOSSO** (D8)
 * e não existe em nenhuma das três fontes do enunciado.
 *
 * **O rótulo exibido não mora aqui.** Ele depende de quem lê (`glossario.md` §4) e é calculado na
 * Interface, que é a camada que conhece o leitor.
 */
export const STATUS = [
  "aberta",
  "em_analise",
  "em_atendimento",
  "pausada",
  "resolvida",
  "cancelada",
] as const;

export type StatusOcorrencia = (typeof STATUS)[number];

/** **`Resolvida` e `Cancelada` são terminais de verdade — não existe `reabrir`** (D24). */
export const TERMINAIS: readonly StatusOcorrencia[] = ["resolvida", "cancelada"];

export function ehTerminal(status: StatusOcorrencia): boolean {
  return TERMINAIS.includes(status);
}
