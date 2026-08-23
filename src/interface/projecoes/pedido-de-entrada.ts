import type { PedidoDaPessoa, PedidoDeEntradaRegistrado } from "@/aplicacao/organizacao";

/**
 * A projeção do schema `PedidoDeEntrada` do `openapi.yaml`.
 *
 * **Uma só, para os dois consumidores**: o `201` de `POST /pedidos-de-entrada` e o `pedidosDeEntrada[]` de
 * `GET /contexto`. Duas projeções do mesmo schema divergiriam na primeira alteração.
 *
 * **Só o nome da organização.** O código é público, mas isso não autoriza ler quem está lá dentro
 * (contrato §8.2) — e `PedidoDeEntradaDetalhe`, que é como o **Gestor** vê o pedido, é outro schema e é do
 * item 8.
 */
export type PedidoDeEntradaProjetado = {
  id: string;
  organizacao: { nome: string };
  situacao: string;
  criadoEm: string;
};

export function projetarPedidoDeEntrada(
  pedido: PedidoDaPessoa | PedidoDeEntradaRegistrado,
): PedidoDeEntradaProjetado {
  return {
    id: pedido.id,
    organizacao: { nome: pedido.organizacao.nome },
    situacao: pedido.situacao,
    criadoEm: pedido.criadoEm,
  };
}
