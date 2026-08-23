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
