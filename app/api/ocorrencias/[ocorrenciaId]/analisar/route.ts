import { analisarOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { comandoComObservacaoSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/analisar`** — `Aberta` → `Em análise`, e **o primeiro comando do produto**.
 *
 * *"Marca que o Gestor começou a olhar — e é a transição que tira a ocorrência do limbo do ponto de vista
 * do Solicitante"* (`openapi.yaml`). Devolve `200` com a ocorrência atualizada e a `ultimaTransicao`
 * recém-gravada: é `200` e não `201` porque nenhum recurso endereçável nasceu — o registro de transição
 * não tem URL própria, por desenho.
 *
 * **A permissão é conferida ANTES de o recurso ser lido**, e é o critério 16.4 literal: quem não é Gestor
 * recebe `403 PERMISSAO_INSUFICIENTE` mesmo quando a ocorrência não existe. Isso **não** contradiz a §6.3
 * — *"não confirmar a existência do que você não pode alcançar"* —, porque o `403` depende apenas de quem
 * chama, e portanto não afirma nada sobre a ocorrência.
 *
 * **`corpoOpcional: true`** porque o contrato declara `requestBody: required: false` (critério 16.7).
 * Corpo com zero byte vira `{}`; corpo presente continua sendo conferido.
 *
 * *Capacidade: analisar · `ENUNCIADO · literal` (F2). Permissão: `ocorrencia.analisar` — Gestor.*
 */
export const POST = comContexto(
  { exige: "ocorrencia.analisar", corpo: comandoComObservacaoSchema, corpoOpcional: true },
  async ({ ctx, repos, corpo, parametros, lente }) => {
    const lida = await analisarOcorrencia(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é
      // a mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      { ocorrenciaId: parametros["ocorrenciaId"] ?? "", observacao: corpo.observacao ?? null },
    );

    // **A mesma projeção do `GET`**, e por isso a resposta do comando é indistinguível de reler a
    // ocorrência — inclusive em `acoesDisponiveis`, que é o que faz o botão sumir sozinho (critério 16.5).
    return projetarOcorrenciaDetalhe(
      lida,
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      lente,
    );
  },
);

export const dynamic = "force-dynamic";
