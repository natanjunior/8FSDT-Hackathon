import { z } from "zod";

/**
 * O corpo de `POST /organizacoes` — **um campo, e é o contrato inteiro** (`openapi.yaml`,
 * `requestBody`: `required: [nome]`, `properties: { nome }`).
 *
 * **`z.object` descarta chave desconhecida, e é isso que cumpre o critério 1.1.** *"Enviar `codigoPublico`
 * no corpo não o define"* — com este schema ele nem chega à camada de Aplicação: é removido aqui. Não é
 * `strictObject` de propósito: recusar com `400` seria inventar um comportamento que o contrato não
 * declara. O `422 CAMPO_NAO_SUPORTADO` existe, é outro mecanismo, e o contrato o declara **só** para
 * `POST /ocorrencias` (item 11).
 */
export const nomeDeOrganizacao = z
  .string()
  .trim()
  .min(1, "Informe o nome da organização.")
  .max(120, "O nome cabe em 120 caracteres.");

export const criacaoDeOrganizacaoSchema = z.object({ nome: nomeDeOrganizacao });

export type EntradaDeCriacaoDeOrganizacao = z.infer<typeof criacaoDeOrganizacaoSchema>;

/**
 * O corpo de `PATCH /organizacoes` — **um campo opcional, e a opcionalidade é a decisão** (spec §3.3).
 *
 * Com um campo só, `required: [nome]` daria o mesmo resultado hoje. **Opcional é o que deixa o segundo
 * campo ser aditivo** quando ele chegar, que é a regra de compatibilidade do §11 do contrato.
 *
 * **O corpo vazio passa por aqui e é recusado na rota**, com `400 FORMATO_INVALIDO` e *"Informe ao menos
 * um campo para alterar"* — a mesma divisão de `PATCH /areas/{areaId}` e `PATCH /categorias/{id}`.
 *
 * `z.object` e não `strictObject`, pela razão que `criacaoDeOrganizacaoSchema` já escreveu: `codigoPublico`
 * enviado no corpo é **descartado aqui**, e não recusado com `400` que o contrato não declara.
 */
export const correcaoDeOrganizacaoSchema = z.object({ nome: nomeDeOrganizacao.optional() });

export type EntradaDeCorrecaoDeOrganizacao = z.infer<typeof correcaoDeOrganizacaoSchema>;

/**
 * O corpo de `PUT /contexto/organizacao` — **um campo, e é o contrato inteiro** (`openapi.yaml:152-163`:
 * `required: [organizacaoId]`).
 *
 * **É o único lugar do contrato onde o cliente nomeia uma organização** (§4.2), e é por isso que a
 * validação de forma não basta: quem confere que aquela organização é dela é `escolherOrganizacaoAtiva`,
 * na camada de Aplicação. O schema só recusa o que nem UUID é.
 *
 * `z.object` e não `strictObject`, pela mesma razão escrita em `criacaoDeOrganizacaoSchema`: recusar
 * chave desconhecida com `400` seria inventar comportamento que o contrato não declara.
 */
export const trocaDeOrganizacaoSchema = z.object({
  organizacaoId: z.uuid("Informe a organização."),
});

export type EntradaDeTrocaDeOrganizacao = z.infer<typeof trocaDeOrganizacaoSchema>;
