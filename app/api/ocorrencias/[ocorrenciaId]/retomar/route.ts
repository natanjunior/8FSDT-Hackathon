import { retomarOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { comandoComObservacaoSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/retomar`** — `Pausada` → **o status anterior à pausa**, e **o único comando
 * do produto cujo destino não viaja em lugar nenhum da requisição**.
 *
 * *"O cliente não escolhe o destino, e não o conhece antes de pedir: o agregado lê o `statusAnterior`
 * do registro de pausa e volta para lá (invariante 6). Não há campo para isso — é um dividendo direto
 * de a trilha ser conceito de domínio"* (`openapi.yaml`). É o critério **24.2**, e ele funciona
 * sozinho porque **a resposta é a ocorrência relida**: `status`, `statusRotulo`, `ultimaTransicao` e
 * `acoesDisponiveis` já chegam corretos, e é ali que o cliente descobre para onde ela voltou.
 *
 * **`corpoOpcional: true`**, como `/analisar` e `/iniciar-atendimento`, porque o contrato declara
 * `requestBody: required: false` (`openapi.yaml:1856-1861`). É o critério 16.7 aplicado de novo: corpo
 * com zero byte vira `{}`; corpo presente continua sendo conferido.
 *
 * **Sem `recusar:`** — `camposSemDestino` é dos comandos que declaram `observacao` sem ter onde
 * guardá-la (`/atribuir-responsavel` e `/alterar-prioridade`). Aqui ela tem destino: é coluna do
 * registro de transição.
 *
 * **Sem envelope na resposta**, como nos quatro comandos anteriores: o corpo volta a ser
 * indistinguível de reler a ocorrência, inclusive em `acoesDisponiveis` — que é o que faz o botão
 * *Retomar* sumir sozinho depois do sucesso.
 *
 * *Capacidade: retomar, voltando ao status anterior · `NOSSO` (D8). Permissão: `ocorrencia.retomar` —
 * está em `SO_DO_GESTOR`, e o `comContexto` recusa o Solicitante antes de ler o recurso.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.retomar",
    corpo: comandoComObservacaoSchema,
    corpoOpcional: true,
  },
  async ({ ctx, repos, corpo, parametros }) => {
    const lida = await retomarOcorrencia(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e
      // é a mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      { ocorrenciaId: parametros["ocorrenciaId"] ?? "", observacao: corpo.observacao ?? null },
    );

    return projetarOcorrenciaDetalhe(lida, {
      pessoaId: ctx.pessoaId,
      permissoes: ctx.vinculo.permissoes,
    });
  },
);

export const dynamic = "force-dynamic";
