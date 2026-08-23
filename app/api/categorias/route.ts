import { listarCategorias } from "@/aplicacao/organizacao";
import { comContexto, lerBooleanoDaUrl } from "@/interface/http";
import { projetarCategoria } from "@/interface/projecoes";

/**
 * `GET /categorias` — *"a leitura que precede o registro de ocorrência, e é onde se confirma que a semente
 * das sete categorias do desafio foi criada junto com a organização (POL-01)"* (`openapi.yaml`).
 *
 * **`qualquer-vinculo-ativo`, e não `organizacao.configurar`:** T-04 consome esta lista, e quem registra
 * ocorrência é o Solicitante. É um dos dois casos em que o contrato diz literalmente *"qualquer vínculo
 * ativo"* (§8.1).
 *
 * **A escrita — `POST` e `PATCH` — não está aqui:** é o item 4a. Esta rota sobe agora porque cinco
 * critérios dos itens 1, 2 e 3 a nomeiam como o instrumento de conferência.
 */
export const GET = comContexto({ exige: "qualquer-vinculo-ativo" }, async ({ repos, requisicao }) => {
  const ativa = lerBooleanoDaUrl(requisicao, "ativa");
  const itens = await listarCategorias(repos.categorias, { incluirInativas: ativa === false });
  return { itens: itens.map(projetarCategoria) };
});

export const dynamic = "force-dynamic";
