import { listarPedidosDeEntrada, pedirEntrada } from "@/aplicacao/organizacao";
import { comContexto, lerSituacoesDaUrl, resposta, semOrganizacao } from "@/interface/http";
import { projetarPedidoDeEntrada, projetarPedidoDeEntradaDetalhe } from "@/interface/projecoes";
import { pedidoDeEntradaSchema } from "@/interface/schemas";

/**
 * **`GET /pedidos-de-entrada`** — a fila que o Gestor abre para decidir (T-08).
 *
 * **Escopado, ao contrário do `POST` logo abaixo — e as duas portas no mesmo arquivo são corretas.** A
 * escrita acontece antes de existir vínculo, e por isso é uma das cinco da §4.4; a leitura acontece
 * dentro de uma organização ativa, e por isso passa pelo funil. Nenhuma linha de `eslint.config.mjs` muda:
 * a lista fechada nomeia quem pode importar `semOrganizacao`, e `comContexto` é livre.
 *
 * **Sem paginação** — são os pedidos pendentes de um condomínio, e o contrato §7.7 já excluiu paginação
 * das coleções desta natureza.
 */
export const GET = comContexto({ exige: "vinculo.gerir" }, async ({ repos, requisicao }) => {
  const situacoes = lerSituacoesDaUrl(requisicao);
  const itens = await listarPedidosDeEntrada(repos.pedidosDeEntrada, { situacoes });
  return { itens: itens.map(projetarPedidoDeEntradaDetalhe) };
});

/**
 * **`POST /pedidos-de-entrada`** — pedir entrada com o Código da Organização (D25).
 *
 * **A quarta operação da lista fechada da §4.4**, e o caminho deste arquivo já estava reservado em
 * `eslint.config.mjs` desde o esqueleto: um sexto endpoint que tente importar `semOrganizacao` não passa
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
  async ({ ctx, corpo, portasGlobais, resolucao }) => {
    const pedido = await pedirEntrada(
      { pedidosDeEntrada: portasGlobais.escritaDePedidosDeEntrada },
      ctx,
      {
        codigoPublico: corpo.codigoPublico,
        nome: corpo.nome ?? null,
        telefone: corpo.telefone ?? null,
      },
      // **Critério 7b.8**, e sem consulta nenhuma: a resolução de contexto já trouxe todos os vínculos
      // ativos da Pessoa. Com vínculo em qualquer organização, o `nome` do corpo é ignorado: aqui ele
      // seria **efeito colateral** de um formulário cujo fim é outro. O lugar de se renomear é T-16,
      // onde renomear é o ato em si (item 49).
      resolucao.vinculos.length > 0,
    );

    // Sem `Location`: o `201` deste endpoint não o declara no `openapi.yaml`, porque não há
    // `GET /pedidos-de-entrada/{id}` para quem pediu — ele vê o pedido pelo `GET /contexto`.
    return resposta(projetarPedidoDeEntrada(pedido), { status: 201 });
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
