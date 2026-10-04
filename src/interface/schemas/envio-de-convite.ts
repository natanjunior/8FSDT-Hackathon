import { z } from "zod";

/**
 * O corpo de `POST /convites-pessoais/envios` (item 122). **Só a forma**: uma lista de identificadores.
 * O tamanho, a lista vazia e a repetida são regra do domínio, e a recusa delas é `422`, e não `400`.
 */
export const envioDeConvitesSchema = z.object({ pessoaIds: z.array(z.string().uuid()) }).strict();

export type EntradaDeEnvioDeConvites = z.infer<typeof envioDeConvitesSchema>;
