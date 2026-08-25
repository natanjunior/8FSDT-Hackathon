import { z } from "zod";

import { CategoriaNaoEncontrada, corrigirCategoria } from "@/aplicacao/organizacao";
import { FormatoInvalido, comContexto } from "@/interface/http";
import { projetarCategoria } from "@/interface/projecoes";
import { correcaoDeCategoriaSchema } from "@/interface/schemas";

/**
 * **`PATCH /categorias/{categoriaId}` — renomear, reordenar, desativar e reativar.**
 *
 * **`ativa: false` é como uma categoria sai de uso — não há exclusão** (P6): ocorrência antiga aponta para
 * ela e a FK vinda de `ocorrencias` é `RESTRICT`. **Não existe `DELETE` neste caminho, e não deve
 * existir.**
 *
 * **Duas recusas acontecem aqui, antes da Aplicação:**
 *
 * 1. **Identificador que não é `uuid` → `404`**, não `500`. Sem esta linha, o `where id = $n` recebe texto
 *    e o driver derruba a requisição com erro de sintaxe de tipo — e o critério 3 do item 4a exige que a
 *    resposta seja **idêntica** à de categoria inexistente.
 * 2. **Corpo sem nenhum campo alterável → `400 FORMATO_INVALIDO`.** É o `minProperties: 1` do contrato, e
 *    é o que `PATCH /vinculos/{pessoaId}` já faz.
 */
export const PATCH = comContexto(
  { exige: "organizacao.configurar", corpo: correcaoDeCategoriaSchema },
  async ({ ctx, repos, corpo, parametros }) => {
    const categoriaId = z.uuid().safeParse(parametros["categoriaId"] ?? "");
    if (!categoriaId.success) throw new CategoriaNaoEncontrada();

    if (
      corpo.nome === undefined &&
      corpo.icone === undefined &&
      corpo.ordem === undefined &&
      corpo.ativa === undefined
    ) {
      throw new FormatoInvalido([
        {
          campo: "corpo",
          codigo: "OBRIGATORIO",
          mensagem: "Informe ao menos um campo para alterar.",
        },
      ]);
    }

    const categoria = await corrigirCategoria(repos.categorias, {
      categoriaId: categoriaId.data,
      ...(corpo.nome === undefined ? {} : { nome: corpo.nome }),
      ...(corpo.icone === undefined ? {} : { icone: corpo.icone }),
      ...(corpo.ordem === undefined ? {} : { ordem: corpo.ordem }),
      ...(corpo.ativa === undefined ? {} : { ativa: corpo.ativa }),
      porPessoaId: ctx.pessoaId,
    });

    return projetarCategoria(categoria);
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
