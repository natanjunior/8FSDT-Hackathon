import { criarEtiqueta, listarEtiquetas } from "@/aplicacao/organizacao";
import { comContexto, resposta } from "@/interface/http";
import { projetarEtiqueta } from "@/interface/projecoes";
import { atribuicaoDeEtiquetaSchema } from "@/interface/schemas";

/**
 * **`GET /etiquetas-de-participante` — as etiquetas desta organização** (item 115), em ordem alfabética e
 * inclusive as sem uso. É o que a seleção múltipla do detalhe sugere e o que o cartão da configuração lista.
 *
 * **`vinculo.gerir`, e não `organizacao.configurar`:** quem atribui é quem cria e quem apaga. Duas
 * permissões permitiriam a alguém criar o que não pode remover.
 */
export const GET = comContexto({ exige: "vinculo.gerir" }, async ({ repos }) => ({
  itens: (await listarEtiquetas(repos.etiquetas)).map(projetarEtiqueta),
}));

/**
 * **`POST /etiquetas-de-participante` — criar uma etiqueta sem atribuí-la** (item 120, critério 19): o
 * modal *Nova etiqueta* do cartão da configuração. Mesma forma de corpo e de resposta da atribuição, e a
 * mesma regra de reaproveitar: `201` quando nasceu, `200` quando já existia uma igual.
 */
export const POST = comContexto(
  { exige: "vinculo.gerir", corpo: atribuicaoDeEtiquetaSchema },
  async ({ repos, corpo }) => {
    const resultado = await criarEtiqueta(repos.etiquetas, corpo.nome);
    return resposta(
      { etiqueta: projetarEtiqueta(resultado.etiqueta), criada: resultado.criada },
      { status: resultado.criada ? 201 : 200 },
    );
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
