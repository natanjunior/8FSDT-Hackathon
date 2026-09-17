import { reordenarCategorias } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";
import { projetarCategoria } from "@/interface/projecoes";
import { reordenacaoSchema } from "@/interface/schemas";

/**
 * **`PUT /categorias/ordem` — a lista inteira, de uma vez (item 50).**
 *
 * `{ ids }` é a lista inteira da organização, ativas e inativas, na ordem nova; a resposta é a lista
 * inteira, na forma de `GET /categorias?ativa=false`. A regra do conjunto é da Aplicação, e a transação é
 * da porta.
 *
 * **As recusas, na ordem em que acontecem:** `409 ORGANIZACAO_DIVERGENTE` e `403 PERMISSAO_INSUFICIENTE`
 * no `comContexto`, as mesmas do `PATCH`; `415` e `400` na leitura do corpo, que é onde o id repetido
 * para; `409 LISTA_DESATUALIZADA` na Aplicação.
 *
 * **Este arquivo exporta só `PUT`, e é o que decide a precedência** (spec §4.6): o segmento estático
 * ganha de `[categoriaId]`, então `PATCH` e `GET` neste caminho respondem `405`, sem corpo, pela
 * plataforma. Antes deste arquivo, `PATCH /categorias/ordem` respondia `404 CATEGORIA_NAO_ENCONTRADA`.
 *
 * **SEM `corpoOpcional`:** `requestBody.required: true` no `openapi.yaml`.
 */
export const PUT = comContexto(
  { exige: "organizacao.configurar", corpo: reordenacaoSchema },
  async ({ ctx, repos, corpo }) => {
    const itens = await reordenarCategorias(repos.categorias, {
      ids: corpo.ids,
      porPessoaId: ctx.pessoaId,
    });
    return { itens: itens.map(projetarCategoria) };
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
