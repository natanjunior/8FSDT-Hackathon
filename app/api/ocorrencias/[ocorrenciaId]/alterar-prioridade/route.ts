import { alterarPrioridade } from "@/aplicacao/ocorrencia";
import { comContexto, recusarSemDestino, registrarLeituraDeQuemAgiu } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { alteracaoDePrioridadeSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/alterar-prioridade`** — *"isto aqui é urgente"*, dito pelo Gestor e não pelo
 * campo de urgência que a D7 recusou.
 *
 * **É o terceiro comando que não transiciona, e o PRIMEIRO cuja recusa de estado tem código próprio.**
 * `409 PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL` em `resolvida` e `cancelada` — a **invariante 7** (D6):
 * *"se a prioridade mudasse depois do fim, 'quantas ocorrências de prioridade alta resolvemos em setembro'
 * responderia coisas diferentes conforme o dia da pergunta"* (`openapi.yaml:1628-1630`).
 *
 * **Não transiciona, não gera registro na trilha e não aparece na linha do tempo** (PA-21). É o único
 * comando do produto do qual as três são verdade ao mesmo tempo — e é por isso que T-05 entrega uma
 * **janela de conserto** ao lado do seletor (critério 17.7), em vez de uma defesa aqui.
 *
 * **Nenhuma política altera prioridade sozinha** (D16, critério 17.5): o envelhecimento *"apenas
 * sinaliza"*. A partir desta fatia, os **dois** escritores da coluna são `Ocorrencia.registrar` — que grava
 * `PRIORIDADE_INICIAL` no nascimento — e este comando.
 *
 * **SEM `corpoOpcional`**, como `/pausar` e `/registrar-solucao-aplicada`: `requestBody: required: true`.
 *
 * **COM `recusar:`, e é o segundo endpoint do produto a ter um** — critério **17.6**. `observacao` é
 * declarada no corpo pelo `openapi.yaml:1649` e não tem destino em lugar nenhum: recusá-la em voz alta é o
 * que o `PATCH /vinculos` já faz com `papel`, *"em vez de fingir que o campo nunca chegou"*. **A
 * especificação versionada ainda não declara este `422`** — é o item 16 da `trabalho/fila-documentacao.md`,
 * e é achado, não conserto desta fatia.
 *
 * **Sem envelope na resposta:** o `openapi.yaml` aponta o `200` para `ComandoExecutado`, que é
 * `OcorrenciaDetalhe` puro. O corpo volta a ser indistinguível de reler a ocorrência — inclusive em
 * `acoesDisponiveis`, que continua trazendo este mesmo comando, porque ele **não** é "uma vez só".
 *
 * *Capacidade: alterar a prioridade · `ENUNCIADO · aberto` (G3) + D6.
 * Permissão: `ocorrencia.alterar_prioridade` — está em `SO_DO_GESTOR`, e o `comContexto` recusa o
 * Solicitante e o Encarregado antes de ler o recurso.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.alterar_prioridade",
    corpo: alteracaoDePrioridadeSchema,
    recusar: recusarSemDestino,
  },
  async ({ ctx, repos, corpo, parametros, lente, requisicao }) => {
    const lida = await alterarPrioridade(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é a
      // mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        prioridade: corpo.prioridade,
      },
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
