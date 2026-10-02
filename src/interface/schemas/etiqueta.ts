import { z } from "zod";

/**
 * O corpo de `POST /vinculos/{pessoaId}/etiquetas` (item 115).
 *
 * **Vazio e longo são forma, e respondem `400`** (`docs/api.md`, Erros: *"tamanho fora do limite são
 * forma"*). O banco recusa o mesmo com `check`; esta é a primeira barreira, e a que dá a frase.
 */
export const atribuicaoDeEtiquetaSchema = z.object({
  nome: z.string().trim().min(1, "Escreva a etiqueta.").max(30, "Até 30 caracteres."),
});

export type EntradaDeAtribuicaoDeEtiqueta = z.infer<typeof atribuicaoDeEtiquetaSchema>;
