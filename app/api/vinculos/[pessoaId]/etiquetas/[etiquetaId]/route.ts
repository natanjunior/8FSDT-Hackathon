import { tirarEtiqueta } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";

/**
 * **`DELETE /vinculos/{pessoaId}/etiquetas/{etiquetaId}` — tirar uma etiqueta de uma pessoa** (item 115).
 * A etiqueta continua existindo para as outras. Tirar o que a pessoa não tinha é `204`, como tirar de novo.
 */
export const DELETE = comContexto({ exige: "vinculo.gerir" }, async ({ repos, parametros }) => {
  await tirarEtiqueta(repos.etiquetas, {
    pessoaId: parametros["pessoaId"] ?? "",
    etiquetaId: parametros["etiquetaId"] ?? "",
  });
});

export const dynamic = "force-dynamic";
