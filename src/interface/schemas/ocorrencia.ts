import { z } from "zod";

/**
 * O corpo de `POST /ocorrencias` — o schema `RegistroDeOcorrencia` do contrato.
 *
 * **`status` não aparece aqui, e não pode aparecer em nenhum schema de entrada.** É a primeira das três
 * verificações mecânicas do `openapi.yaml`, e o que ela impede é a `Ocorrência` ganhar um `PATCH` e a
 * ADR-0001 cair junto.
 *
 * **`anexos` entra aqui, e é onde o teto de UM mora.** A tabela do banco não tem restrição de quantidade,
 * de propósito (modelo §6.16): proibir o segundo anexo lá devolveria a migração que a tabela veio evitar.
 * Ampliar é trocar este número — mudança que **aceita mais e nunca menos**, e portanto não quebra cliente
 * nenhum (contrato §11).
 *
 * **O `tipo` do anexo continua fora**, e continuará: o servidor o deriva do `tipoConteudo` que autorizou.
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

/**
 * O schema `ReferenciaDeAnexo` do contrato: **a referência a um objeto já enviado**, nunca bytes.
 *
 * `titulo` é aceito e gravado embora T-04 não ofereça onde escrevê-lo nesta entrega — recusá-lo aqui
 * seria divergir do contrato, que o declara.
 */
const referenciaDeAnexoSchema = z.object({
  chave: z.string().trim().min(1, "Envie a foto de novo."),
  ticket: z.string().trim().min(1, "Envie a foto de novo."),
  titulo: z.string().trim().max(150, "O título do anexo cabe em 150 caracteres.").nullish(),
});

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
  /** `maxItems: 1` — **forma, não domínio**: mais de um item é `400`, e é o critério 13b.4. */
  anexos: z.array(referenciaDeAnexoSchema).max(1, "Só é possível anexar uma foto.").nullish(),
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

/**
 * ============================================================================
 *  O corpo dos comandos de avanço rotineiro — `ComandoComObservacaoOpcional`
 * ============================================================================
 *
 * `analisar`, e depois `iniciar-atendimento`, `retomar` e `resolver`. **`observacao` é opcional de
 * propósito** (D23): *"exigir texto onde não há decisão a justificar produz 'ok' e destrói o próprio
 * dado"*.
 *
 * **Sem `.min(1)`, e é o portão do DoD olhando na direção contrária:** o `openapi.yaml:3059` declara
 * `maxLength: 1000` e **nenhum** `minLength`, e um schema mais estrito que a especificação versionada é
 * a mesma divergência do critério 16.7, do outro lado. Quem transforma `""` em `null` é o **comando de
 * aplicação**, que é a camada a quem isso pertence.
 *
 * **O corpo INTEIRO é opcional**, e quem trata disso é o `corpoOpcional` do `comContexto`: aqui o schema
 * só precisa aceitar `{}`, que é o que ele faz por não ter campo obrigatório.
 */
export const comandoComObservacaoSchema = z.object({
  observacao: z.string().trim().max(1000, "A observação cabe em 1000 caracteres.").nullish(),
});

export type EntradaDeComandoComObservacao = z.infer<typeof comandoComObservacaoSchema>;
