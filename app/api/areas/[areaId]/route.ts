import { z } from "zod";

import { AreaNaoEncontrada, corrigirArea } from "@/aplicacao/organizacao";
import { FormatoInvalido, comContexto } from "@/interface/http";
import { projetarAreaAtualizada } from "@/interface/projecoes";
import { correcaoDeAreaSchema } from "@/interface/schemas";

/**
 * **`PATCH /areas/{areaId}` — renomear, reclassificar, reordenar, desativar e reativar.**
 *
 * **Reclassificar o tipo muda o futuro e não mexe no passado.** Cada ocorrência guarda uma cópia congelada
 * do tipo da Área no momento do registro (emenda à D10): reclassificar de *privativa* para *comum* **não**
 * expõe retroativamente ocorrências registradas sob expectativa de privacidade.
 *
 * **`ordem` saiu do corpo em 17/09/2026, com o item 44k:** a posição muda por `PUT /areas/ordem`, que
 * grava a lista inteira numa transação, e a tela que digitava o número deixou de existir. Um corpo que
 * ainda a traga tem o campo descartado pelo schema.
 *
 * A resposta traz `ocorrenciasComTipoAnterior` — **um campo que só existe para produzir uma frase de
 * tela** —, e enquanto o item 11 não criar a tabela `ocorrencias` ele vale `0`, que é verdade (spec §2.1).
 */
export const PATCH = comContexto(
  { exige: "organizacao.configurar", corpo: correcaoDeAreaSchema },
  async ({ ctx, repos, corpo, parametros }) => {
    const areaId = z.uuid().safeParse(parametros["areaId"] ?? "");
    if (!areaId.success) throw new AreaNaoEncontrada();

    if (
      corpo.nome === undefined &&
      corpo.tipo === undefined &&
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

    const area = await corrigirArea(repos.areas, {
      areaId: areaId.data,
      ...(corpo.nome === undefined ? {} : { nome: corpo.nome }),
      ...(corpo.tipo === undefined ? {} : { tipo: corpo.tipo }),
      ...(corpo.ativa === undefined ? {} : { ativa: corpo.ativa }),
      porPessoaId: ctx.pessoaId,
    });

    return projetarAreaAtualizada(area);
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
