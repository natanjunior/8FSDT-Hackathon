import { listarAreas } from "@/aplicacao/organizacao";
import { COLUNAS_DE_AREAS, montarCsv, nomeDoArquivo } from "@/interface/exportacao";
import { arquivo, comContexto } from "@/interface/http";

/**
 * **`GET /areas/exportacao` — as áreas da organização, ativas e inativas, num CSV** (item 124).
 *
 * **`organizacao.configurar`, a permissão da tela**, e não a do `GET /areas` em JSON
 * (`qualquer-vinculo-ativo`), que existe porque o formulário de registro o consome.
 */
export const GET = comContexto({ exige: "organizacao.configurar" }, async ({ repos, organizacao }) =>
  arquivo(montarCsv(COLUNAS_DE_AREAS, await listarAreas(repos.areas, { incluirInativas: true })), {
    nome: nomeDoArquivo("areas", organizacao.nome, new Date().toISOString()),
    tipo: "text/csv; charset=utf-8",
  }),
);

export const dynamic = "force-dynamic";
