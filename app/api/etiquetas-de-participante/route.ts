import { listarEtiquetas } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";
import { projetarEtiqueta } from "@/interface/projecoes";

/**
 * **`GET /etiquetas-de-participante` — as etiquetas desta organização** (item 115), em ordem alfabética e
 * inclusive as sem uso. É o que o autocompletar sugere e o que a gerência lista.
 *
 * **`vinculo.gerir`, e não `organizacao.configurar`:** quem atribui é quem cria e quem apaga. Duas
 * permissões permitiriam a alguém criar o que não pode remover.
 */
export const GET = comContexto({ exige: "vinculo.gerir" }, async ({ repos }) => ({
  itens: (await listarEtiquetas(repos.etiquetas)).map(projetarEtiqueta),
}));

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
