import { listarAreas } from "@/aplicacao/organizacao";
import { comContexto, lerBooleanoDaUrl } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

/**
 * `GET /areas` — a lista de onde a ocorrência acontece, com o **tipo** de cada uma.
 *
 * Mesmo regime do `GET /categorias`: `qualquer-vinculo-ativo`, porque T-04 a consome; a escrita é o item
 * 5. **Sem paginação** — são ~30 linhas, e o contrato §7.7 já a excluiu para as coleções de configuração.
 */
export const GET = comContexto({ exige: "qualquer-vinculo-ativo" }, async ({ repos, requisicao }) => {
  const ativa = lerBooleanoDaUrl(requisicao, "ativa");
  const itens = await listarAreas(repos.areas, { incluirInativas: ativa === false });
  return { itens: itens.map(projetarArea) };
});

export const dynamic = "force-dynamic";
