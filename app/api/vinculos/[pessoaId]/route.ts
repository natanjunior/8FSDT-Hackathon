import { corrigirVinculo } from "@/aplicacao/organizacao";
import { CampoNaoSuportado, FormatoInvalido, comContexto } from "@/interface/http";
import { projetarVinculo } from "@/interface/projecoes";
import { correcaoDeVinculoSchema } from "@/interface/schemas";

/**
 * **`PATCH /vinculos/{pessoaId}` — corrigir os dados de um vínculo.**
 *
 * A Pessoa é endereçada **através do vínculo**, dentro da organização ativa. Não existe endereço global de
 * Pessoa, e é isso que impede a consulta que a §4.3 do modelo proíbe.
 *
 * **Duas recusas acontecem aqui, antes da Aplicação, e a ordem entre elas é decisão:**
 *
 * 1. **`papel` → `422 CAMPO_NAO_SUPORTADO`.** Vem primeiro porque é a resposta mais informativa: quem
 *    mandou `{ papel }` sozinho precisa saber que o campo não é aceito, não que faltou preencher algo.
 * 2. **Corpo sem nada a corrigir → `400 FORMATO_INVALIDO`.** É o `minProperties: 1` do contrato.
 *
 * O `DELETE` deste mesmo caminho é o item 10.
 */
export const PATCH = comContexto(
  { exige: "vinculo.gerir", corpo: correcaoDeVinculoSchema },
  async ({ repos, corpo, parametros }) => {
    if (corpo.papel !== undefined) throw new CampoNaoSuportado(["papel"]);

    // `"areaId" in corpo` e não `corpo.areaId !== undefined`: `null` é um valor — *tire a unidade* — e
    // ausência é *não mexa*. As duas coisas colapsariam numa comparação com `undefined`.
    if (corpo.nome === undefined && !("areaId" in corpo)) {
      throw new FormatoInvalido([
        {
          campo: "corpo",
          codigo: "OBRIGATORIO",
          mensagem: "Informe ao menos um campo para corrigir.",
        },
      ]);
    }

    const vinculo = await corrigirVinculo(repos.vinculos, {
      pessoaId: parametros["pessoaId"] ?? "",
      ...(corpo.nome === undefined ? {} : { nome: corpo.nome }),
      ...("areaId" in corpo ? { areaId: corpo.areaId ?? null } : {}),
    });

    return projetarVinculo(vinculo);
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
