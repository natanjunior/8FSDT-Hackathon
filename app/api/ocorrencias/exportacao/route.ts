import { exportarOcorrencias } from "@/aplicacao/ocorrencia";
import { COLUNAS_DE_OCORRENCIAS, montarCsv, nomeDoArquivo } from "@/interface/exportacao";
import { arquivo, comContexto } from "@/interface/http";

/**
 * **`GET /ocorrencias/exportacao` — todas as ocorrências da organização, num CSV** (item 124).
 *
 * **`ocorrencia.ler_todas`, e não `ler_propria` como o `GET /ocorrencias`**: o arquivo é do Gestor (achado A2
 * da spec, confirmado). Sem parâmetro nenhum: nem filtro, nem ordem, nem página. Uma rota que aceitasse
 * filtro convidaria a tela a passá-lo, e o critério 1 diz *sem filtro*.
 */
export const GET = comContexto({ exige: "ocorrencia.ler_todas" }, async ({ repos, organizacao }) =>
  arquivo(montarCsv(COLUNAS_DE_OCORRENCIAS, await exportarOcorrencias(repos.ocorrencias)), {
    nome: nomeDoArquivo("ocorrencias", organizacao.nome, new Date().toISOString()),
    tipo: "text/csv; charset=utf-8",
  }),
);

export const dynamic = "force-dynamic";
