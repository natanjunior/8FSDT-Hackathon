import { reordenarAreas } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";
import { reordenacaoSchema } from "@/interface/schemas";

/**
 * **`PUT /areas/ordem` — a lista inteira, de uma vez (item 50).**
 *
 * A mesma forma de `PUT /categorias/ordem`, e as mesmas recusas. **A `Area` sai sem
 * `ocorrenciasComTipoAnterior`**, que é campo só da correção de tipo (spec §4.8), e a reordenação não
 * toca o registro de reclassificação.
 *
 * Exporta só `PUT`: `PATCH` e `GET` neste caminho respondem `405`, pela plataforma (spec §4.6).
 *
 * **SEM `corpoOpcional`:** `requestBody.required: true` no `openapi.yaml`.
 */
export const PUT = comContexto(
  { exige: "organizacao.configurar", corpo: reordenacaoSchema },
  async ({ ctx, repos, corpo }) => {
    const itens = await reordenarAreas(repos.areas, { ids: corpo.ids, porPessoaId: ctx.pessoaId });
    return { itens: itens.map(projetarArea) };
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
