import { z } from "zod";

import { nomeDePessoa } from "./credencial";

/**
 * O corpo de `PATCH /contexto/pessoa` — **um campo opcional, e a opcionalidade é a decisão**
 * (spec §3.3).
 *
 * Com um campo só, `required: [nome]` daria o mesmo resultado hoje. **Opcional é o que deixa `contatos[]`
 * entrar depois sem quebrar cliente nenhum**, que é a regra de compatibilidade do §11 do contrato — e é
 * o que dá à exclusão da §3.5 um lugar para pousar.
 *
 * **O corpo vazio passa por aqui e é recusado na rota**, com `400 FORMATO_INVALIDO` e *"Informe ao menos
 * um campo para alterar"* — a mesma divisão de `PATCH /organizacoes`, `PATCH /areas/{areaId}` e
 * `PATCH /categorias/{id}`.
 *
 * **`nomeDePessoa` reusado, não copiado.** É o mesmo `.trim().min(1).max(120)` de T-11, e é o
 * `varchar(120)` de `pessoas.nome` (modelo §6.2). **Diferente do `nomeCorrigido` de
 * `pedido-de-entrada.ts`**, que aceita vazio porque ali apagar o campo é desistir da correção; aqui
 * apagar é pedir para se chamar de nada, e a coluna é `NOT NULL`.
 *
 * `z.object` e não `strictObject`, pela razão que `criacaoDeOrganizacaoSchema` já escreveu: chave
 * desconhecida é **descartada aqui**, e não recusada com um `400` que o contrato não declara.
 */
export const correcaoDePessoaSchema = z.object({ nome: nomeDePessoa.optional() });

export type EntradaDeCorrecaoDePessoa = z.infer<typeof correcaoDePessoaSchema>;
