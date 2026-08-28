import { recusarPedidoDeEntrada } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";
import { projetarPedidoDeEntradaDetalhe } from "@/interface/projecoes";
import { recusaDePedidoSchema } from "@/interface/schemas";

/**
 * **`POST /pedidos-de-entrada/{pedidoId}/recusar`** — marca o pedido como recusado. **Não cria nada.**
 *
 * Um pedido recusado **pode ser refeito** pela Pessoa: o índice único de `pedidos_de_entrada` é parcial
 * (`WHERE situacao = 'pendente'`), e é isso que o permite. Bloquear para sempre seria mais restritivo do
 * que qualquer decisão registrada (suposição S-A12).
 *
 * **A `observacao` é guardada e ninguém a lê de volta** — nem o Gestor: `PedidoDeEntradaDetalhe` não a
 * declara. É o achado **A-8-2**, e este endpoint não o conserta: pôr no corpo o que o contrato não declara
 * quebraria o portão da §15 no primeiro `npm run verificar:openapi`.
 */
export const POST = comContexto(
  // **`corpoOpcional`, e é retroação declarada sobre item fechado.** O `openapi.yaml:435-436` declara
  // `requestBody: required: false` desde o item 8, e a rota respondia `415` a quem não mandasse corpo —
  // divergência que ninguém decidiu, e sim consequência não vista de declarar schema. Ela fecha aqui
  // porque `/analisar` tem declaração **idêntica**, e dois endpoints iguais no contrato não podem ter
  // comportamento oposto. **Só aceita mais** (contrato §11): nenhum cliente muda de resultado.
  { exige: "vinculo.gerir", corpo: recusaDePedidoSchema, corpoOpcional: true },
  async ({ ctx, repos, corpo, parametros }) => {
    const pedido = await recusarPedidoDeEntrada(repos.pedidosDeEntrada, {
      pedidoId: parametros["pedidoId"] ?? "",
      observacao: corpo.observacao ?? null,
      decididoPorPessoaId: ctx.pessoaId,
    });

    return projetarPedidoDeEntradaDetalhe(pedido);
  },
);

export const dynamic = "force-dynamic";
