import { z } from "zod";

import { PAPEIS } from "@/dominio/organizacao";

/**
 * Os corpos de `POST /vinculos` e `PATCH /vinculos/{pessoaId}` (contrato §8.2).
 *
 * **`contatos[]` não está aqui, e é escopo, não esquecimento:** o sub-formulário repetível é o item 9b, e
 * o campo é opcional no contrato. Quando ele chegar, entra nos dois schemas.
 */

/** Até 120, como a coluna. O nome vai para a trilha imutável — o vazio é recusado aqui, não no domínio. */
const nomeDePessoa = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(120, "O nome cabe em 120 caracteres.");

/**
 * A unidade. **`null` explícito é aceito** — é *"sem unidade"*, o caso do Gestor e do Encarregado
 * terceirizado, e é o que a tela manda quando o seletor está em *"Sem unidade"*.
 *
 * Área que não é desta organização, ou inativa, é `422 AREA_INVALIDA` — recusa de domínio, não de forma:
 * o schema só confere que é um `uuid`.
 */
const unidade = z.uuid("Escolha uma unidade da lista.").nullable();

export const cadastroDeVinculoSchema = z.object({
  nome: nomeDePessoa,
  papel: z.enum(PAPEIS),
  areaId: unidade.default(null),
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
  papel: z.unknown().optional(),
});

export type EntradaDeCorrecaoDeVinculo = z.infer<typeof correcaoDeVinculoSchema>;
