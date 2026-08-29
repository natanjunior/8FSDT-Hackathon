import { z } from "zod";

import { MOTIVOS_DE_PAUSA } from "@/dominio/ocorrencia";

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
 *
 * **O campo é `const` de módulo desde o item 26**, e não é estilo: `resolucaoSchema` o reusa, e dois
 * `.max(1000)` para o mesmo campo divergiriam no dia em que o contrato mudasse um deles. É a forma que
 * `titulo`, `descricao` e `identificador` já usam neste arquivo.
 */
const observacao = z.string().trim().max(1000, "A observação cabe em 1000 caracteres.").nullish();

export const comandoComObservacaoSchema = z.object({ observacao });

export type EntradaDeComandoComObservacao = z.infer<typeof comandoComObservacaoSchema>;

/**
 * ============================================================================
 *  O corpo de `POST …/atribuir-responsavel` — item 19
 * ============================================================================
 *
 * **Um campo, e é literalmente o corpo do critério 19.1.** `atribuidoPor` não existe aqui e não pode
 * existir: quem atribuiu é quem chamou, e vem do contexto da sessão.
 */
export const atribuicaoDeResponsavelSchema = z.object({
  responsavelPessoaId: identificador,
});

export type EntradaDeAtribuicaoDeResponsavel = z.infer<typeof atribuicaoDeResponsavelSchema>;

/**
 * ============================================================================
 *  O campo `solucaoAplicada` — um teto, dois pisos, e a assimetria é do contrato
 * ============================================================================
 *
 * **`const` de módulo, como o `observacao` que o item 26 criou**, e pelo mesmo argumento escrito lá: dois
 * `.max(4000)` para o mesmo campo divergiriam no dia em que o contrato mudasse um deles.
 *
 * **Sem `.min(1)` aqui, de propósito.** O piso não é do campo — é de **um** dos dois endpoints que o
 * aceitam: `/registrar-solucao-aplicada` declara `minLength: 1` e `/resolver` **não**. Pôr o piso no
 * `const` tornaria `resolucaoSchema` mais estrito que a especificação versionada, que é a divergência do
 * critério 16.7 do avesso.
 *
 * **`.trim()` primeiro, checagens depois** — a ordem importa na cadeia do zod, e é a que `pausaSchema` já
 * usa: `"   "` é aparado e então reprovado pelo piso, em vez de passar por ter três caracteres.
 */
const solucaoAplicada = z.string().trim().max(4000, "A solução aplicada cabe em 4000 caracteres.");

/**
 * ============================================================================
 *  O corpo de `POST …/registrar-solucao-aplicada` — item 25
 * ============================================================================
 *
 * **Um campo, obrigatório, com piso.** É o segundo corpo de comando obrigatório do produto — o primeiro
 * foi `/pausar` —, e o `route.ts` **não** leva `corpoOpcional`: o `openapi.yaml` declara
 * `requestBody: required: true`. Corpo ausente é `415` pelo caminho normal do `comContexto`; corpo `{}` é
 * `400` com o campo em `erros[]`.
 *
 * **Nada de `recusar:` no `route.ts`, e a razão é do contrato.** `camposSemDestino` é dos comandos que
 * **declaram** `observacao` sem ter onde guardá-la. **Este endpoint não declara `observacao`** (um campo
 * só) **e não declara `422`** (sete respostas, nenhuma delas 422). Responder um status que a especificação
 * versionada não lista para a operação é a divergência do critério 16.7 do avesso — e o portão do DoD olha
 * nessa direção. Campo desconhecido é **descartado** pelo `z.object`, que é o que o contrato descreve.
 */
export const solucaoAplicadaSchema = z.object({
  solucaoAplicada: solucaoAplicada.min(1, "Escreva o que foi feito."),
});

export type EntradaDeSolucaoAplicada = z.infer<typeof solucaoAplicadaSchema>;

/**
 * ============================================================================
 *  O corpo de `POST …/resolver` — o primeiro comando com DOIS campos
 * ============================================================================
 *
 * **Não é uma extensão do `comandoComObservacaoSchema`, e a diferença importa.** Estendê-lo tocaria o
 * `analisar`, o `iniciar-atendimento` e o `retomar`, que **não** aceitam `solucaoAplicada` no contrato —
 * eles passariam a aceitar um campo que o `openapi.yaml` não declara para eles, e o portão do DoD
 * (*"a especificação versionada corresponde ao código"*) olha exatamente nessa direção.
 *
 * **Ele reusa os campos `observacao` e `solucaoAplicada` do módulo** em vez de redigitar os tetos: um
 * número, um lugar. **O de `solucaoAplicada` passou a ser reusado no item 25**, que criou o `const` para
 * o próprio schema e devolveu a este a mesma cadeia — sem o `.min(1)`, que é de lá e não daqui.
 *
 * **`solucaoAplicada` entra aqui, e não é escopo emprestado do item 25** (spec §3.2): o
 * `openapi.yaml:1936-1944` declara os dois campos **neste** endpoint, o contrato §8.4 explica por quê
 * — *"para que o formulário da D22 seja uma requisição, não duas"* — e o `inventario-de-telas.md:783`
 * põe os dois no modal **deste** item. O que pertence ao 25 é o endpoint próprio e o campo no corpo da
 * tela.
 *
 * **Sem `.min(1)` nos dois, e é deliberado.** O `openapi.yaml:1942` declara `maxLength: 4000` e
 * **nenhum** `minLength` para `/resolver` — ao contrário de `/registrar-solucao-aplicada`, que traz
 * `minLength: 1` (`:1901`). **Quem transforma `""` em `null` é o comando de aplicação**, e lá vazio
 * significa *ausente*: `resolver` preserva a solução que já houvesse, porque apagá-la não é capacidade
 * de endpoint nenhum.
 *
 * **Nada de `recusar:` no `route.ts`.** `camposSemDestino` é dos comandos que declaram `observacao` sem
 * ter onde guardá-la; aqui os **dois** campos têm destino — `observacao` é coluna do registro de
 * transição, `solucaoAplicada` é coluna de `ocorrencias`.
 */
export const resolucaoSchema = z.object({
  observacao,
  solucaoAplicada: solucaoAplicada.nullish(),
});

export type EntradaDeResolucao = z.infer<typeof resolucaoSchema>;

/**
 * ============================================================================
 *  O corpo de `POST …/pausar` — o primeiro corpo de comando OBRIGATÓRIO
 * ============================================================================
 *
 * **`z.enum(MOTIVOS_DE_PAUSA)`, importado do Domínio**, que é o padrão que `configuracao.ts`
 * (`z.enum(TIPOS_DE_AREA)`) e `vinculo.ts` (`PAPEIS`) já usam. **A lista dos quatro valores não é
 * redigitada** — uma segunda cópia divergiria no dia em que o quinto motivo nascer.
 *
 * **O `.min(1)` da observação ESTÁ no contrato publicado**, e é o único endpoint de comando em que a
 * especificação versionada e o critério coincidem nessa direção: o `openapi.yaml:1828` declara
 * `observacao: { type: string, minLength: 1, maxLength: 1000 }` e `required: [motivo, observacao]`.
 * É o **oposto** de `/analisar` e `/resolver`, onde `minLength` não existe e o schema não pode
 * inventá-lo (critério 16.7).
 *
 * **Não reusa a `observacao` de módulo deste arquivo**, e a diferença é o ponto: aquela é
 * `.nullish()`, para os comandos de avanço rotineiro. Estendê-la com `.min(1)` mudaria o campo dos
 * outros três.
 *
 * **Nada de `recusar:` no `route.ts`.** `camposSemDestino` é dos comandos que declaram `observacao`
 * sem ter onde guardá-la; **aqui os dois campos têm destino** — as duas colunas do registro de
 * transição. E **nada de `corpoOpcional`**: `requestBody: required: true` (`openapi.yaml:1820`).
 */
export const pausaSchema = z.object({
  motivo: z.enum(MOTIVOS_DE_PAUSA, { error: "Escolha o motivo da pausa." }),
  observacao: z
    .string()
    .trim()
    .min(1, "Conte o que a ocorrência está esperando.")
    .max(1000, "A observação cabe em 1000 caracteres."),
});

export type EntradaDePausa = z.infer<typeof pausaSchema>;

/**
 * ============================================================================
 *  O campo que o esquema não tem onde guardar — `422 CAMPO_NAO_SUPORTADO`
 * ============================================================================
 *
 * **`observacao` é declarada no `openapi.yaml` para dois comandos que não a guardam em lugar nenhum:**
 * `/atribuir-responsavel` e `/alterar-prioridade`. Nenhum dos dois gera registro de transição (contrato
 * §3.4), `atribuicoes` **não tem coluna de observação** (modelo §6.9), e o `EventoAtribuicao` da linha do
 * tempo também não tem campo para ela. O lugar dela é a conversa da atribuição — o **canal 3**, que é
 * evolução prevista (D9).
 *
 * **Campo cuja capacidade é evolução prevista é a definição literal de `CAMPO_NAO_SUPORTADO`**
 * (contrato §6.2). E recusar em voz alta não é novidade no produto: `PATCH /vinculos/{pessoaId}` já
 * responde `422` a `papel`, *"em vez de fingir que o campo nunca chegou"*.
 *
 * **O nome é genérico de propósito.** O item **17** reusa esta função para `/alterar-prioridade` — é o
 * critério 17.6, e a palavra que ele usa é **reusar, não copiar**. Um nome que citasse *atribuição*
 * obrigaria o 17 a renomear ou a duplicar.
 *
 * **Campo desconhecido FORA desta lista continua sendo descartado pelo schema**, sem erro — o mesmo
 * recorte estreito de `camposEscritosPeloServidor`, e pela mesma razão: tornar o schema estrito trocaria
 * *"o produto não faz isso"* por *"você escreveu errado"* em todo o resto.
 */
const SEM_DESTINO = ["observacao"] as const;

export function camposSemDestino(corpo: unknown): readonly string[] {
  if (typeof corpo !== "object" || corpo === null) return [];
  return SEM_DESTINO.filter((campo) => campo in corpo);
}
