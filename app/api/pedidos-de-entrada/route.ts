import { pedirEntrada } from "@/aplicacao/organizacao";
import { resposta, semOrganizacao } from "@/interface/http";
import { projetarPedidoDeEntrada } from "@/interface/projecoes";
import { pedidoDeEntradaSchema } from "@/interface/schemas";

/**
 * **`POST /pedidos-de-entrada`** — pedir entrada com o Código da Organização (D25).
 *
 * **A quarta operação da lista fechada da §4.4**, e o caminho deste arquivo já estava reservado em
 * `eslint.config.mjs` desde o esqueleto: um quinto endpoint que tente importar `semOrganizacao` não passa
 * no lint.
 *
 * **Não exige organização ativa — e também não a recusa** (§4.4, correção de 22/08/2026): quem já está em
 * A pede entrada em B por aqui, que é o único caminho para o segundo vínculo da Persona 1B. Quem oferece
 * esse caminho na tela é o item 7b; o contrato o deixa aberto desde já.
 *
 * **A porta vem por `portasGlobais`, e não de `composicao/`.** `app/` não pode importar `@/composicao`
 * (regra de lint 2b) — quem monta é `semOrganizacao`, e é por isso que ele existe.
 *
 * **Nunca cria vínculo.** Não há checagem que garanta isso: a porta não tem caminho de escrita em
 * `vinculos`.
 */
export const POST = semOrganizacao(
  { corpo: pedidoDeEntradaSchema },
  async ({ ctx, corpo, portasGlobais }) => {
    const pedido = await pedirEntrada(
      { pedidosDeEntrada: portasGlobais.escritaDePedidosDeEntrada },
      ctx,
      {
        codigoPublico: corpo.codigoPublico,
        nome: corpo.nome ?? null,
        telefone: corpo.telefone ?? null,
      },
    );

    // Sem `Location`: o `201` deste endpoint não o declara no `openapi.yaml`, porque não há
    // `GET /pedidos-de-entrada/{id}` para quem pediu — ele vê o pedido pelo `GET /contexto`.
    return resposta(projetarPedidoDeEntrada(pedido), { status: 201 });
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
