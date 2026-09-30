import { resolverOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { resolucaoSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/resolver`** — `Em atendimento` → `Resolvida`, e **o primeiro estado terminal
 * do produto**.
 *
 * *"Estado terminal de verdade: não existe reabertura. Problema que volta é uma ocorrência nova vinculada
 * à original"* (D24, `openapi.yaml`). **Não há endpoint de `reabrir` em lugar nenhum**, e o critério 26.4
 * é a conferência de que ele não existe.
 *
 * **Só o Gestor resolve, sempre** — *"a regra de autorização mais firme do produto… apareceu idêntica nas
 * duas personas da pesquisa"*. O `exige` abaixo é o critério 26.3 inteiro: `ocorrencia.resolver` está em
 * `SO_DO_GESTOR`, e o `comContexto` recusa **antes de ler o recurso**, então o Solicitante autor leva
 * `403` sem um único `if` sobre autoria.
 *
 * **`corpoOpcional: true`** porque o contrato declara `requestBody: required: false`. Corpo com zero byte
 * vira `{}`; corpo presente continua sendo conferido.
 *
 * **`resolucaoSchema`, e não `comandoComObservacaoSchema`:** é o primeiro corpo de comando com **dois**
 * campos. `solucaoAplicada` viaja aqui *"para que o formulário da D22 seja uma requisição, não duas"*
 * (contrato §8.4) — e o registro de transição continua sendo **um**.
 *
 * **Sem `recusar:`.** `camposSemDestino` é dos comandos que declaram `observacao` sem ter onde guardá-la;
 * aqui os dois campos têm destino.
 *
 * **Sem envelope na resposta:** nenhum campo extra, e o corpo volta a ser indistinguível de reler a
 * ocorrência — inclusive em `acoesDisponiveis`, que é o que faz a barra sumir sozinha e a frase do
 * critério 26.6 aparecer no lugar dela.
 *
 * *Capacidade: resolver · `ENUNCIADO · literal` (F2). Permissão: `ocorrencia.resolver` — Gestor apenas.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.resolver",
    corpo: resolucaoSchema,
    corpoOpcional: true,
  },
  async ({ ctx, repos, corpo, parametros, lente }) => {
    const lida = await resolverOcorrencia(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é
      // a mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        observacao: corpo.observacao ?? null,
        solucaoAplicada: corpo.solucaoAplicada ?? null,
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
