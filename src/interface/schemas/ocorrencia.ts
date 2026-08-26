import { z } from "zod";

/**
 * O corpo de `POST /ocorrencias` — o schema `RegistroDeOcorrencia` do contrato.
 *
 * **`status` não aparece aqui, e não pode aparecer em nenhum schema de entrada.** É a primeira das três
 * verificações mecânicas do `openapi.yaml`, e o que ela impede é a `Ocorrência` ganhar um `PATCH` e a
 * ADR-0001 cair junto.
 *
 * **`anexos` também não entra nesta fatia.** A tabela `anexos` é do item 13b; aceitar o campo agora
 * significaria descartá-lo em silêncio, que é exatamente o que o `CAMPO_NAO_SUPORTADO` existe para não
 * fazer.
 */

/** `varchar(150)`, com o `CHECK (length(trim(titulo)) > 0)` do modelo tendo par aqui. */
const titulo = z
  .string()
  .trim()
  .min(1, "Escreva um título.")
  .max(150, "O título cabe em 150 caracteres.");

/** `varchar(5000)`. É onde a intenção do Solicitante vive — **não há campo de urgência** (D7). */
const descricao = z
  .string()
  .trim()
  .min(1, "Conte o que está acontecendo.")
  .max(5000, "A descrição cabe em 5000 caracteres.");

// `z.uuid(...)`, e nao `z.string().uuid(...)`: e a forma do Zod 4 e e a que os schemas de `vinculo.ts` e
// `pedido-de-entrada.ts` ja usam.
const identificador = z.uuid("Escolha uma opção da lista.");

export const registroDeOcorrenciaSchema = z.object({
  titulo,
  descricao,
  categoriaId: identificador,
  /** **Obrigatório**, porque é dele que a visibilidade deriva (D10, contrato §8.3). */
  areaId: identificador,
  localizacaoComplemento: z
    .string()
    .trim()
    .max(200, "A referência do lugar cabe em 200 caracteres.")
    .nullish(),
});

export type EntradaDeRegistroDeOcorrencia = z.infer<typeof registroDeOcorrenciaSchema>;

/**
 * ============================================================================
 *  Os cinco campos que o servidor escreve — `422 CAMPO_NAO_SUPORTADO`
 * ============================================================================
 *
 * **Recusar em voz alta é o ponto.** Descartar o campo em silêncio — que é o que um schema Zod faz de
 * graça — deixaria quem chamou a API convencido de ter definido o status da própria ocorrência.
 *
 * **Não é `400`, e a diferença é a §6.2:** `400` é *"você escreveu errado"*; isto é *"o produto não faz
 * isso"*. Os cinco são o critério 11.3 literal.
 *
 * Campo desconhecido **fora** desta lista continua sendo descartado pelo schema, sem erro — é o
 * comportamento que o repositório já tem no `PATCH` de vínculo, e alargá-lo não é decisão desta fatia.
 */
const ESCRITOS_PELO_SERVIDOR = [
  "status",
  "prioridade",
  "areaTipo",
  "organizacaoId",
  "ocorrenciaOrigemId",
] as const;

export function camposEscritosPeloServidor(corpo: unknown): readonly string[] {
  if (typeof corpo !== "object" || corpo === null) return [];
  return ESCRITOS_PELO_SERVIDOR.filter((campo) => campo in corpo);
}
