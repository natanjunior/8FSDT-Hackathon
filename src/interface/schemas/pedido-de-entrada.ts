import { z } from "zod";

import { ehE164 } from "@/dominio/pessoa";

/**
 * O corpo de `POST /pedidos-de-entrada` — `{ codigoPublico, nome?, telefone? }` (contrato §8.2).
 *
 * **O servidor é estrito nos dois formatos, e quem os produz é a tela** (spec §2.4). O código sai de T-02
 * em maiúscula porque o campo já é `uppercase`; o telefone sai em E.164 porque `paraE164Brasileiro` o
 * converte antes do envio. Aqui só se confere — e o `400 FORMATO_INVALIDO` do critério 3 é um erro que
 * **acontece de verdade** quando alguém chama a API sem passar pela tela.
 */

/** `^[A-Z0-9]{6,12}$` — sem minúscula e sem caractere ambíguo: ele é digitado à mão de um cartaz. */
export const codigoPublico = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{6,12}$/u, "O código tem de 6 a 12 letras e números, sem espaços.");

/** E.164, o mesmo formato do `CHECK` de `contatos` (modelo §6.17). */
export const telefoneE164 = z
  .string()
  .trim()
  .refine(ehE164, "Informe um telefone com DDD, como (11) 99999-0000.");

/**
 * **O nome aqui não é o mesmo schema de T-11, e a diferença é a decisão §2.7 da spec:** *"vazio ou só
 * espaços é tratado como não enviado"*. `nomeDePessoa` tem `.min(1)` porque em T-11 o nome **nasce**; aqui
 * ele é **corrigido**, o campo chega pré-preenchido, e apagá-lo é desistir da correção — não um erro de
 * formato. Quem trata o vazio é `correcaoDeNome`, na Aplicação, que já o devolve como `null`.
 *
 * Vale de quebra contra o portão da §15: o `openapi.yaml` declara `nome` com `maxLength: 120` e **sem
 * `minLength`** — um `.min(1)` aqui recusaria mais do que o contrato declara.
 */
const nomeCorrigido = z.string().trim().max(120, "O nome cabe em 120 caracteres.");

export const pedidoDeEntradaSchema = z.object({
  codigoPublico,
  /**
   * **Opcional, e é o ponto de correção — não o de origem** (contrato §4.1). O nome nasce dos metadados da
   * conta, em T-11; aqui ele é corrigível uma última vez.
   */
  nome: nomeCorrigido.optional(),
  telefone: telefoneE164.optional(),
});

export type EntradaDePedidoDeEntrada = z.infer<typeof pedidoDeEntradaSchema>;
