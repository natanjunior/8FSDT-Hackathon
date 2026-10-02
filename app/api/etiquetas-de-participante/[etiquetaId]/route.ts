import { apagarEtiqueta } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";

/**
 * **`DELETE /etiquetas-de-participante/{etiquetaId}` — apagar a etiqueta** (item 115, critério 7). Sai de
 * todas as pessoas por cascata. Sem corpo; o handler não devolve nada e a resposta é `204`.
 */
export const DELETE = comContexto({ exige: "vinculo.gerir" }, async ({ repos, parametros }) => {
  await apagarEtiqueta(repos.etiquetas, parametros["etiquetaId"] ?? "");
});

export const dynamic = "force-dynamic";
