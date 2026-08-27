import { z } from "zod";

import { TIPOS_DE_CONTEUDO_DE_ANEXO } from "@/dominio/anexo";

/**
 * O corpo de `POST /anexos/autorizacoes`.
 *
 * **A recusa acontece aqui, antes de qualquer byte subir** (critério 13a.2). Tipo e tamanho são **forma**,
 * e forma é o que esta camada pode julgar: o teto de 512 KB são os 400 KB do RNF8 com margem, e os dois
 * tipos são o escopo da primeira entrega.
 *
 * **O cliente nunca envia o tipo do *anexo*** — só o tipo do *conteúdo*. O `tipo` (`imagem`) é derivado
 * pelo servidor na reivindicação, e é o que o mantém fora de todo schema de entrada.
 */
export const TETO_DE_BYTES_DO_ANEXO = 524_288;

export const pedidoDeAutorizacaoSchema = z.object({
  tipoConteudo: z.enum(TIPOS_DE_CONTEUDO_DE_ANEXO, {
    error: "A foto precisa ser JPEG ou PNG.",
  }),
  tamanhoBytes: z
    .int()
    .min(1, "A foto está vazia.")
    .max(TETO_DE_BYTES_DO_ANEXO, "A foto precisa ser comprimida no aparelho antes de subir."),
});

export type EntradaDePedidoDeAutorizacao = z.infer<typeof pedidoDeAutorizacaoSchema>;
