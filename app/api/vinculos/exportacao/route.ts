import { listarVinculos } from "@/aplicacao/organizacao";
import { COLUNAS_DE_PARTICIPANTES, montarCsv, nomeDoArquivo } from "@/interface/exportacao";
import { arquivo, comContexto } from "@/interface/http";

/**
 * **`GET /vinculos/exportacao` — os participantes da organização, num CSV** (item 124).
 *
 * **`vinculo.gerir`, a mesma guarda do `GET /vinculos`**, porque o arquivo leva e-mail e telefone: contato é
 * dado pessoal, e o arquivo sai do prédio. Sem parâmetro nenhum: nem filtro, nem página.
 */
export const GET = comContexto({ exige: "vinculo.gerir" }, async ({ repos, organizacao }) =>
  arquivo(montarCsv(COLUNAS_DE_PARTICIPANTES, await listarVinculos(repos.vinculos)), {
    nome: nomeDoArquivo("participantes", organizacao.nome, new Date().toISOString()),
    tipo: "text/csv; charset=utf-8",
  }),
);

export const dynamic = "force-dynamic";
