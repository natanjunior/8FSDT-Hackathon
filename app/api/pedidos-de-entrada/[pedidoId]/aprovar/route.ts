import { aprovarPedidoDeEntrada } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";
import { projetarVinculo } from "@/interface/projecoes";
import { aprovacaoDePedidoSchema } from "@/interface/schemas";

/**
 * **`POST /pedidos-de-entrada/{pedidoId}/aprovar`** — cria o Vínculo com o papel escolhido.
 *
 * **É aqui que a invariante da D25 se fecha:** *"o Vínculo só passa a existir com aprovação do Gestor"*.
 * Este é o **único** caminho de criação de vínculo além do bootstrap do item 1 — e o que garante isso não
 * é uma checagem, é não existir outra escrita em `vinculos`.
 *
 * **`areaId` é a unidade**, e este é o único momento em que ela pode ser informada para quem tem conta
 * (contrato §8.2). Ausente ou `null` cria o vínculo sem unidade, que é o caso do Gestor.
 *
 * Devolve `200` com o `Vinculo` — **não `201`**, porque é o que o `openapi.yaml` declara: o recurso
 * criado não tem endereço próprio.
 */
export const POST = comContexto(
  { exige: "vinculo.gerir", corpo: aprovacaoDePedidoSchema },
  async ({ ctx, repos, corpo, parametros }) => {
    const vinculo = await aprovarPedidoDeEntrada(repos.pedidosDeEntrada, {
      pedidoId: parametros["pedidoId"] ?? "",
      papel: corpo.papel,
      areaId: corpo.areaId ?? null,
      decididoPorPessoaId: ctx.pessoaId,
    });

    return projetarVinculo(vinculo);
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
