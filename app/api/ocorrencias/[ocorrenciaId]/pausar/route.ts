import { pausarOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { pausaSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/pausar`** — `Em análise` **ou** `Em atendimento` → `Pausada`, e **a
 * primeira transição do produto que o enunciado não desenhou**.
 *
 * `Pausada` é acréscimo nosso (D8) e existe porque *"é onde o trabalho se perde hoje: nomear a espera é
 * o que permite vigiá-la"* (`openapi.yaml`). Por isso **motivo e observação são obrigatórios** — aqui
 * há uma decisão a justificar, e é o caso em que a D23 exige texto.
 *
 * **SEM `corpoOpcional`**, ao contrário de `/analisar`, `/iniciar-atendimento` e `/resolver`: o
 * contrato declara `requestBody: required: true`. Corpo ausente é `415` pelo caminho normal do
 * `comContexto`; corpo `{}` é `400` com os dois campos em `erros[]`.
 *
 * **Sem `recusar:`** — os dois campos do corpo têm destino, e são as duas colunas do registro de
 * transição.
 *
 * **Sem envelope na resposta:** o corpo volta a ser indistinguível de reler a ocorrência, inclusive em
 * `acoesDisponiveis`.
 *
 * *Capacidade: pausar com motivo estruturado · `NOSSO` (D8). Permissão: `ocorrencia.pausar` — está em
 * `SO_DO_GESTOR`, e o `comContexto` recusa antes de ler o recurso.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.pausar",
    corpo: pausaSchema,
  },
  async ({ ctx, repos, corpo, parametros, lente }) => {
    const lida = await pausarOcorrencia(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e
      // é a mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        motivo: corpo.motivo,
        observacao: corpo.observacao,
      },
    );

    return projetarOcorrenciaDetalhe(
      lida,
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      lente,
    );
  },
);

export const dynamic = "force-dynamic";
