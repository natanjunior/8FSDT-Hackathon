import type {
  PedidoDaPessoa,
  PedidoDeEntradaLido,
  PedidoDeEntradaRegistrado,
} from "@/aplicacao/organizacao";

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

/**
 * A projeção do schema `PedidoDeEntradaDetalhe` — **como o Gestor vê o pedido**.
 *
 * **`pessoa` é `PessoaDoPedido`, não `PessoaComContato`**, e a diferença é de privacidade: `contatos` é
 * tabela global, e devolvê-la aqui mostraria ao Gestor desta organização os contatos que a pessoa
 * cadastrou em **outra**. O pedido carrega só o telefone que ela informou nele — um valor, não uma lista.
 *
 * **`observacao` não aparece**, porque o schema do contrato não a declara (achado A-8-2).
 */
export type PedidoDeEntradaDetalheProjetado = {
  id: string;
  pessoa: { pessoaId: string; nome: string; telefoneInformado: string | null };
  situacao: string;
  criadoEm: string;
  decididoEm: string | null;
  decididoPor: { pessoaId: string; nome: string } | null;
};

export function projetarPedidoDeEntradaDetalhe(
  pedido: PedidoDeEntradaLido,
): PedidoDeEntradaDetalheProjetado {
  return {
    id: pedido.id,
    pessoa: {
      pessoaId: pedido.pessoa.pessoaId,
      nome: pedido.pessoa.nome,
      telefoneInformado: pedido.pessoa.telefoneInformado,
    },
    situacao: pedido.situacao,
    criadoEm: pedido.criadoEm,
    decididoEm: pedido.decididoEm,
    decididoPor: pedido.decididoPor,
  };
}
