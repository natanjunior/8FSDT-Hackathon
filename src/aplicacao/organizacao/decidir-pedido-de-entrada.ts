import type { Papel } from "@/dominio/organizacao";

import { AreaInvalida, JaVinculado, PedidoJaDecidido, PedidoNaoEncontrado } from "./erros";
import type {
  PedidoDeEntradaLido,
  RepositorioEscopadoDePedidosDeEntrada,
  VinculoCriado,
} from "./portas";

/**
 * **A decisão do Gestor** — item 8, capacidade `NOSSO` (D25).
 *
 * É aqui que a invariante da D25 se fecha: *"o Vínculo só passa a existir com aprovação do Gestor"*. E o
 * que a garante **não é uma checagem**: é não existir outro caminho de escrita em `vinculos` além deste e
 * do bootstrap do item 1.
 *
 * **A permissão não é conferida aqui.** `vinculo.gerir` é exigida na porta de entrada, por
 * `comContexto({ exige })`, que não compila sem a permissão declarada (contrato §4.5).
 *
 * **Nenhum destes desfechos vem de leitura prévia.** Todos os quatro são traduções de garantias do banco —
 * o `update` condicional, a `PRIMARY KEY (pessoa_id, organizacao_id)` de `vinculos`, a FK composta da
 * Área e o escopo do repositório. É a mesma doutrina do `409` do item 7a, e a razão é a mesma: uma
 * leitura antes perde a corrida entre dois Gestores decidindo o mesmo pedido.
 */

export type DecisaoDeAprovacao = {
  pedidoId: string;
  papel: Papel;
  /** `null` é *sem unidade* — o caso do Gestor e do Encarregado terceirizado. */
  areaId: string | null;
  decididoPorPessoaId: string;
};

export async function aprovarPedidoDeEntrada(
  pedidos: RepositorioEscopadoDePedidosDeEntrada,
  decisao: DecisaoDeAprovacao,
): Promise<VinculoCriado> {
  const resultado = await pedidos.aprovar(decisao);

  switch (resultado.desfecho) {
    case "nao-encontrado":
      throw new PedidoNaoEncontrado();
    case "ja-decidido":
      throw new PedidoJaDecidido();
    case "ja-vinculado":
      throw new JaVinculado();
    case "area-invalida":
      throw new AreaInvalida();
    case "aprovado":
      return resultado.vinculo;
  }
}

export type DecisaoDeRecusa = {
  pedidoId: string;
  observacao: string | null;
  decididoPorPessoaId: string;
};

export async function recusarPedidoDeEntrada(
  pedidos: RepositorioEscopadoDePedidosDeEntrada,
  decisao: DecisaoDeRecusa,
): Promise<PedidoDeEntradaLido> {
  const resultado = await pedidos.recusar({
    ...decisao,
    // **Branco não é explicação**, e o `CHECK` da §6.15 aceitaria os dois. Quem escreve o vazio é a tela,
    // quando o Gestor abre a caixa e não digita nada.
    observacao: aparar(decisao.observacao),
  });

  switch (resultado.desfecho) {
    case "nao-encontrado":
      throw new PedidoNaoEncontrado();
    case "ja-decidido":
      throw new PedidoJaDecidido();
    case "recusado":
      return resultado.pedido;
  }
}

function aparar(observacao: string | null): string | null {
  if (observacao === null) return null;
  const limpa = observacao.trim();
  return limpa === "" ? null : limpa;
}
