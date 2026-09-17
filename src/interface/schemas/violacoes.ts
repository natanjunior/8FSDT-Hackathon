import type { ZodType } from "zod";

/**
 * **A tradução de violação em mensagem por campo, num lugar só** (spec do 44g, §4.4).
 *
 * Ela era a função privada `porCampo` de `acoes/index.ts`, e passou a ter dois consumidores: a ação de
 * servidor, que confere o que chegou, e o formulário do navegador, que confere o que vai sair. Os dois
 * leem o **mesmo** schema, e é a razão escrita de o `zod` estar no projeto (ADR-0007, decisão 3).
 *
 * **Fica a primeira mensagem de cada campo**: um e-mail vazio viola o mínimo e o formato, e a frase que
 * diz o que fazer primeiro é a do mínimo.
 */
type Violacao = { readonly path: ReadonlyArray<PropertyKey>; readonly message: string };

export function mensagensPorCampo(violacoes: ReadonlyArray<Violacao>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const violacao of violacoes) {
    const campo = violacao.path.map(String).join(".");
    if (saida[campo] === undefined) saida[campo] = violacao.message;
  }
  return saida;
}

export function errosDoSchema(schema: ZodType, valores: unknown): Record<string, string> {
  const conferido = schema.safeParse(valores);
  return conferido.success ? {} : mensagensPorCampo(conferido.error.issues);
}
