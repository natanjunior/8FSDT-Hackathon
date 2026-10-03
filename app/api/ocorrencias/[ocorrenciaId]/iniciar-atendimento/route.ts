import { iniciarAtendimento } from "@/aplicacao/ocorrencia";
import { comContexto, registrarLeituraDeQuemAgiu } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { comandoComObservacaoSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/iniciar-atendimento`** — `Em análise` → `Em atendimento`, e **a primeira
 * transição do produto que uma tabela de fora consegue recusar**.
 *
 * *"Exige responsável atribuído (invariante 9, D21). Não é burocracia: 'quem está fazendo' é exatamente a
 * informação que hoje se perde"* (`openapi.yaml`). Sem responsável, `409 RESPONSAVEL_NAO_ATRIBUIDO` — a
 * única pré-condição de estado do contrato que não é sobre o `status`.
 *
 * **Na navegação normal esse `409` não acontece** (critério 22.3): `acoesDisponiveis` só traz
 * `iniciar-atendimento` quando há responsável, e T-05 renderiza exatamente essa lista. O erro existe para
 * o cliente que **não** é esta tela — e para a corrida.
 *
 * **`corpoOpcional: true`** porque o contrato declara `requestBody: required: false`. Corpo com zero byte
 * vira `{}`; corpo presente continua sendo conferido.
 *
 * **Sem `recusar:`, ao contrário de `/atribuir-responsavel`.** `camposSemDestino` é dos comandos que
 * declaram `observacao` sem ter onde guardá-la. **Aqui ela tem destino**: é coluna do registro de
 * transição, e é o campo do modal do critério 22.5.
 *
 * **Sem envelope na resposta**, ao contrário do `reatribuicao` do item 19: não há campo extra, e a
 * resposta do comando volta a ser indistinguível de reler a ocorrência — inclusive em
 * `acoesDisponiveis`, que é o que faz o botão sumir sozinho depois do sucesso.
 *
 * *Capacidade: iniciar o atendimento · `ENUNCIADO · literal` (F2) + D21. Permissão:
 * `ocorrencia.iniciar_atendimento` — Gestor.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.iniciar_atendimento",
    corpo: comandoComObservacaoSchema,
    corpoOpcional: true,
  },
  async ({ ctx, repos, corpo, parametros, lente, requisicao }) => {
    const lida = await iniciarAtendimento(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é
      // a mesma lista que monta `acoesDisponiveis` no corpo dos DOIS `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      { ocorrenciaId: parametros["ocorrenciaId"] ?? "", observacao: corpo.observacao ?? null },
    );

    // Agir marca como lida (item 117): depois do comando, e sem derrubar a resposta.
    await registrarLeituraDeQuemAgiu(
      repos.ocorrencias,
      parametros["ocorrenciaId"] ?? "",
      ctx.pessoaId,
      new URL(requisicao.url).pathname,
    );

    return projetarOcorrenciaDetalhe(
      lida,
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      lente,
    );
  },
);

export const dynamic = "force-dynamic";
