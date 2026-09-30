import { registrarSolucaoAplicada } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { solucaoAplicadaSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/registrar-solucao-aplicada`** — grava **o que foi efetivamente feito**, e é o
 * **primeiro comando do produto que muda a ocorrência sem deixar rastro na trilha**.
 *
 * *"Não transiciona status e não gera registro na trilha"* (`openapi.yaml`). Admitido em `em_atendimento`
 * e `pausada`; nos outros quatro, `409 TRANSICAO_NAO_PERMITIDA` — *"solução aplicada descreve trabalho
 * feito, e antes de o atendimento começar não há trabalho a descrever"*, e nos dois terminais a razão é
 * mais forte: mudar o detalhe de uma ocorrência encerrada **sem nada na linha do tempo dizendo quando nem
 * por quem** é a mutação silenciosa que a ADR-0001 existe para impedir (contrato §8.4).
 *
 * **Este endpoint deixaria de existir se o campo vivesse só no modal de resolver** — o inventário o diz em
 * letra (`inventario-de-telas.md`). O que lhe dá caso de uso é a metade de tela deste item: o campo no
 * corpo de T-05, para o Gestor que registra o que foi feito **antes** de conferir e fechar.
 *
 * **SEM `corpoOpcional`**, como `/pausar` e ao contrário de `/analisar`, `/iniciar-atendimento`,
 * `/retomar` e `/resolver`: o contrato declara `requestBody: required: true`. Corpo ausente é `415` pelo
 * caminho normal do `comContexto`; corpo `{}` é `400` com o campo em `erros[]`.
 *
 * **Sem `recusar:`** — este endpoint **não declara `observacao`** no corpo **nem `422`** nas respostas.
 * Recusar um campo seria responder um status que a especificação versionada não lista para a operação.
 *
 * **Sem envelope na resposta:** o `openapi.yaml` aponta o `200` para `ComandoExecutado`, que é
 * `OcorrenciaDetalhe` puro. O corpo volta a ser indistinguível de reler a ocorrência — inclusive em
 * `acoesDisponiveis`, que continua trazendo este mesmo comando, porque ele **não** é "uma vez só".
 *
 * *Capacidade: registrar a solução aplicada · `ENUNCIADO · aberto` (G7) + D22.
 * Permissão: `ocorrencia.registrar_solucao` — está em `SO_DO_GESTOR`, e o `comContexto` recusa o
 * Solicitante e o Encarregado antes de ler o recurso.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.registrar_solucao",
    corpo: solucaoAplicadaSchema,
  },
  async ({ ctx, repos, corpo, parametros, lente }) => {
    const lida = await registrarSolucaoAplicada(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é a
      // mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        solucaoAplicada: corpo.solucaoAplicada,
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
