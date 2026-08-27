/**
 * O vocabulário do contato — os dois enums do banco, do lado de dentro.
 *
 * **Eles moram no Domínio pela mesma razão que `PAPEIS`:** são vocabulário do produto, e o schema de
 * entrada, a porta e o repositório precisam todos do mesmo conjunto. Escrevê-los três vezes é como as
 * três cópias divergem.
 *
 * **`tipo` é o `system` do `ContactPoint` do HL7 FHIR podado a dois valores, e `finalidade` é o `use`
 * traduzido** (modelo §6.17) — sete valores para um produto que alcança dois seria publicar promessa.
 */

export const TIPOS_DE_CONTATO = ["email", "telefone"] as const;
export type TipoDeContato = (typeof TIPOS_DE_CONTATO)[number];

export const FINALIDADES_DE_CONTATO = ["pessoal", "trabalho", "recado"] as const;
export type FinalidadeDeContato = (typeof FINALIDADES_DE_CONTATO)[number];

/** Guarda para o que vem do banco: o `tipo_contato` do esquema e este conjunto saíram da mesma decisão. */
export function ehTipoDeContato(valor: unknown): valor is TipoDeContato {
  return typeof valor === "string" && (TIPOS_DE_CONTATO as readonly string[]).includes(valor);
}

export function ehFinalidadeDeContato(valor: unknown): valor is FinalidadeDeContato {
  return typeof valor === "string" && (FINALIDADES_DE_CONTATO as readonly string[]).includes(valor);
}
