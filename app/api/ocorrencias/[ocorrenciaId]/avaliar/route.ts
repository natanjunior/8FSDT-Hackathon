import { avaliarOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { avaliacaoSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/avaliar`** — a nota que o **Solicitante autor** dá à resolução, e **o décimo
 * e último comando do produto**.
 *
 * *"Não é um sexto estado"* (D1): a ocorrência continua `Resolvida` depois de avaliada — é ação sobre um
 * estado terminal, não um estado novo. É a **única medida de qualidade que o produto tem**
 * (`openapi.yaml:2040`), e o objetivo **O4** depende inteiro de ela ser fácil de dar.
 *
 * **Cinco recusas, e é a maior escada do produto** — `cancelar` tem quatro. O `403` de papel é do
 * `comContexto` e barra exatamente um vínculo, o **Encarregado**; o `403` de **relação** é do comando, e
 * barra o Gestor que não é o autor. **É o primeiro endpoint em que as duas camadas de `403` da §4.5 do
 * contrato são observáveis no mesmo caminho.**
 *
 * **`exige: "ocorrencia.avaliar"`, e ele deixa o Gestor passar de propósito.** A permissão está em
 * `DO_SOLICITANTE`, e o Gestor **acumula** — é o que faz o contrato dizer que este endpoint *"aceita um
 * Gestor sem nenhuma exceção escrita"* (`contrato-de-api.md:427`). O Gestor **autor** avalia a própria
 * ocorrência.
 *
 * **SEM `corpoOpcional`**, como `/pausar`, `/cancelar`, `/alterar-prioridade` e
 * `/registrar-solucao-aplicada`: o contrato declara `requestBody: required: true`. Corpo ausente é `415`
 * pelo caminho normal do `comContexto`; corpo `{}` é `400` com `nota` em `erros[]`.
 *
 * **Sem `recusar:`** — este endpoint **não declara `observacao`** no corpo **nem `422`** nas respostas.
 * Recusar um campo seria responder um status que a especificação versionada não lista para a operação.
 *
 * **Sem envelope na resposta:** o `openapi.yaml` aponta o `200` para `ComandoExecutado`, que é
 * `OcorrenciaDetalhe` puro. E desta vez `acoesDisponiveis` volta **vazia** — o que é a resposta certa e
 * não um payload pela metade: `avaliar` some depois de avaliada (critério 27.4), e é
 * `projetarOcorrenciaDetalhe` quem o tira, informando `jaAvaliada` a partir do dado que acabou de ser
 * gravado.
 *
 * *Capacidade: avaliar a resolução · `ENUNCIADO · aberto` (S10) + D1.
 * Permissão: `ocorrencia.avaliar`.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.avaliar",
    corpo: avaliacaoSchema,
  },
  async ({ ctx, repos, corpo, parametros, lente }) => {
    const lida = await avaliarOcorrencia(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é a
      // mesma lista que monta `acoesDisponiveis` no corpo dos três erros.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        nota: corpo.nota,
        comentario: corpo.comentario,
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
