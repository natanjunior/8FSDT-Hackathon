import { z } from "zod";

import { PAPEIS } from "@/dominio/organizacao";
import { FINALIDADES_DE_CONTATO } from "@/dominio/pessoa";

import { telefoneE164 } from "./pedido-de-entrada";

/**
 * Os corpos de `POST /vinculos` e `PATCH /vinculos/{pessoaId}` (contrato §8.2).
 *
 * **`contatos[]` entrou no item 9b**, nos dois, e a escrita é **substituição**: a lista enviada troca a
 * anterior inteira, `[]` remove todos, e **omitir não mexe em nada**.
 */

/** Até 120, como a coluna. O nome vai para a trilha imutável — o vazio é recusado aqui, não no domínio. */
const nomeDePessoa = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(120, "O nome cabe em 120 caracteres.");

/**
 * A unidade. **`null` explícito é aceito** — é *"sem unidade"*, o caso do Gestor e do Encarregado
 * terceirizado, e é o que a tela manda quando o seletor está em *"Sem área"*.
 *
 * Área que não é desta organização, ou inativa, é `422 AREA_INVALIDA` — recusa de domínio, não de forma:
 * o schema só confere que é um `uuid`.
 */
const unidade = z.uuid("Escolha uma unidade da lista.").nullable();

/** Até 200, como a coluna. Vazio é *não escreveu*, e vira `null` — não uma observação em branco. */
const observacaoDeContato = z
  .string()
  .trim()
  .max(200, "A observação cabe em 200 caracteres.")
  .nullish()
  .transform((valor) => (valor === undefined || valor === "" ? null : valor));

/**
 * O e-mail de **contato**, e ele não é o `email` de `credencial.ts`.
 *
 * **Credencial e contato são coisas diferentes** (modelo §10): uma autentica, a outra alcança a pessoa;
 * podem divergir, e nada no esquema as sincroniza. Reusar o schema da credencial escreveria *"Informe o
 * seu e-mail."* num campo que é o e-mail de outra pessoa.
 *
 * **É mais estrito que o `CHECK` do banco** (`contatos_email_forma_ck`), e a direção importa: ao
 * contrário, existiria valor que o schema aceita e o banco recusa — e isso é `500`, não `400`.
 */
const emailDeContato = z
  .string()
  .trim()
  .max(255, "O e-mail cabe em 255 caracteres.")
  .pipe(z.email("Confira o e-mail deste contato."));

const finalidadeDeContato = z.enum(FINALIDADES_DE_CONTATO).default("pessoal");

/** Aceita, e conferida contra a posição pelo `superRefine` abaixo. **Nunca chega à porta.** */
const ordemDeclarada = z.int().min(1, "A ordem começa em 1.").optional();

/**
 * **União discriminada por `tipo`, e não um objeto com `refine`.** As duas recusas de forma do critério 3
 * caem de graça: `valor` tem forma diferente por tipo, e `temWhatsapp` **só existe** como `false` num
 * e-mail — que é o `contatos_whatsapp_ck` do banco, escrito como schema.
 */
const contatoParaEscrita = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("telefone"),
    valor: telefoneE164,
    finalidade: finalidadeDeContato,
    temWhatsapp: z.boolean().default(false),
    observacao: observacaoDeContato,
    ordem: ordemDeclarada,
  }),
  z.object({
    tipo: z.literal("email"),
    valor: emailDeContato,
    finalidade: finalidadeDeContato,
    temWhatsapp: z
      .literal(false, "WhatsApp é indicação sobre um número — marque-o num telefone.")
      .default(false),
    observacao: observacaoDeContato,
    ordem: ordemDeclarada,
  }),
]);

/**
 * A lista, com a única regra que o array carrega e o item não: **`ordem`, quando vem, tem de ser a
 * posição** (decisão 2.1 da spec).
 *
 * **Por que recusar em vez de renumerar:** renumerar aceitaria um campo e o descartaria em silêncio, que é
 * o modo de falha que o contrato mais evita. **E por que não exigir `ordem`:** o `default: 1` do contrato
 * viraria armadilha, e o corpo natural — nenhum `ordem`, a ordem carregada pelo array — passaria a ser o
 * que falha. Punir o caso certo está errado.
 *
 * **A consequência que mais vale:** `UNIQUE (pessoa_id, ordem)` deixa de ser alcançável por entrada de
 * usuário, e volta a ser o que o modelo diz que ele é — rede contra uma garantia perdida ao trocar
 * `principal boolean` por `ordem`.
 *
 * **Duplicata NÃO é conferida aqui.** Par repetido é `409 CONTATO_DUPLICADO`, do banco (critério 4).
 */
export const contatosParaEscritaSchema = z
  .array(contatoParaEscrita)
  .superRefine((contatos, ctx) => {
    contatos.forEach((contato, indice) => {
      if (contato.ordem !== undefined && contato.ordem !== indice + 1) {
        ctx.addIssue({
          code: "custom",
          path: [indice, "ordem"],
          message: `A ordem é a posição na lista: aqui, ${String(indice + 1)}.`,
        });
      }
    });
  })
  // Os cinco campos, nomeados um a um. **`ordem` fica de fora, e é esse o serviço do `transform`.**
  // Escrevê-los em vez de descartar `ordem` por resto é o que evita uma variável que ninguém lê — o
  // projeto não tem um `eslint-disable`, e não é aqui que ele ganha o primeiro.
  .transform((contatos) =>
    contatos.map((contato) => ({
      tipo: contato.tipo,
      valor: contato.valor,
      finalidade: contato.finalidade,
      temWhatsapp: contato.temWhatsapp,
      observacao: contato.observacao,
    })),
  );

export const cadastroDeVinculoSchema = z.object({
  nome: nomeDePessoa,
  papel: z.enum(PAPEIS),
  areaId: unidade.default(null),
  /** Ausente e `[]` descrevem o mesmo estado numa Pessoa nova — por isso aqui a ausência vira `[]`. */
  contatos: contatosParaEscritaSchema.default([]),
});

export type EntradaDeCadastroDeVinculo = z.infer<typeof cadastroDeVinculoSchema>;

/**
 * **`papel` é declarado para poder ser recusado.**
 *
 * Um schema Zod comum descarta campo desconhecido em silêncio; declarar `papel` como desconhecido-mas-
 * conhecido é o que permite à rota devolver `422 CAMPO_NAO_SUPORTADO` em vez de fingir que o campo nunca
 * chegou. **O recorte é estreito de propósito:** qualquer outro campo desconhecido continua sendo
 * descartado, como em todos os outros endpoints — tornar o schema estrito trocaria *"o produto não faz
 * isso"* por *"você escreveu errado"* em todo o resto.
 */
export const correcaoDeVinculoSchema = z.object({
  nome: nomeDePessoa.optional(),
  areaId: unidade.optional(),
  /** **Aqui a ausência sobrevive**, e é o *"não mexe em nada"* do contrato. Sem `.default()`. */
  contatos: contatosParaEscritaSchema.optional(),
  papel: z.unknown().optional(),
});

export type EntradaDeCorrecaoDeVinculo = z.infer<typeof correcaoDeVinculoSchema>;
