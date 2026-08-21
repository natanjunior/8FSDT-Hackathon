/**
 * O que a Pessoa é dentro de uma Organização (glossário §1).
 *
 * Os valores são a grafia técnica do tipo `papel_vinculo` do banco (modelo-de-dados.md §5) — sem acento,
 * `snake_case`. `Solicitante`, `Gestor` e `Encarregado` continuam sendo os nomes do domínio.
 */
export const PAPEIS = ["solicitante", "gestor", "encarregado"] as const;

export type Papel = (typeof PAPEIS)[number];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor);
}
