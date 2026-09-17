import { cancelarOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto, recusarEvolucaoPrevista } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { cancelamentoSchema } from "@/interface/schemas";

/**
 * **`POST /ocorrencias/{id}/cancelar`** — *"encerrada sem resolução"* (glossário), e **a última das dez
 * setas da máquina de estados** a ganhar código.
 *
 * **É o ÚNICO comando do produto em que duas pessoas diferentes chamam o mesmo endpoint com regras
 * diferentes**, e daí saem as duas recusas que ele traz de novo:
 *
 * - `403 SOMENTE_O_GESTOR_CANCELA_NESTE_ESTADO` — o Solicitante autor cancela a própria até
 *   `Em análise`; a partir de `Em atendimento` só o Gestor (D12). *"O Solicitante continua podendo
 *   **pedir** o cancelamento pelo comentário"* (`openapi.yaml:1964-1971`);
 * - `422 MOTIVO_NAO_PERMITIDO_PARA_O_PAPEL` — o Solicitante escolhe entre **quatro** motivos, o Gestor
 *   entre os **sete** (D5).
 *
 * **As duas só podem ser decididas com o recurso carregado**, e é por isso que nenhuma delas cabe aqui:
 * o `comContexto` decide **antes** de ler.
 *
 * **`exige` é `ocorrencia.cancelar_propria`, e é o portão certo mesmo sendo o comando de DUAS
 * permissões.** `comContexto` aceita uma, e o Gestor **acumula** as do Solicitante
 * (`Permissao.ts:71-72`) — então este portão deixa passar exatamente quem pode chamar o endpoint em
 * **algum** estado, e barra o Encarregado, que tem lista vazia. **A segunda permissão não é um segundo
 * portão: ela decide o que se pode fazer depois de entrar.**
 *
 * > **A alternativa recusada, escrita porque `exige: "…_propria"` num endpoint que o Gestor usa o tempo
 * > todo lê como engano à primeira vista:** dar a `exige` a forma `Permissao | readonly Permissao[]`
 * > resolveria um caso que não existe — nenhum outro comando tem duas — e alargaria o contrato do
 * > ajudante por onde passam os 36 endpoints do produto.
 *
 * **SEM `corpoOpcional`**, como `/pausar`: `requestBody: required: true` (`openapi.yaml:1985`). Corpo
 * ausente é `415` pelo caminho normal do `comContexto`; corpo `{}` é `400` com os **dois** campos em
 * `erros[]` — o critério **18.1**.
 *
 * **COM `recusar:`, e é o terceiro endpoint do produto a ter um** — critério **18.5**.
 * `ocorrenciaOrigemId` ligaria a ocorrência *"duplicada"* àquela de que ela é cópia, e **o vínculo é
 * evolução prevista**: não há coluna, e o próprio protótipo pede a referência em texto livre na
 * observação. **A lista é OUTRA, e não uma linha a mais em `camposSemDestino`** — aquela é
 * `["observacao"]`, e este endpoint **exige** `observacao`.
 *
 * **Sem envelope na resposta:** o `200` aponta para `ComandoExecutado`, que é `OcorrenciaDetalhe` puro.
 * Desta vez `acoesDisponiveis` volta **vazia** — e é a resposta certa, não um payload pela metade:
 * `cancelada` é terminal.
 *
 * *Capacidade: cancelar com motivo estruturado · `ENUNCIADO · literal` (F3) + D12.
 * Permissão: `ocorrencia.cancelar_propria` — está em `DO_SOLICITANTE`, e o Gestor a acumula.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.cancelar_propria",
    corpo: cancelamentoSchema,
    recusar: recusarEvolucaoPrevista,
  },
  async ({ ctx, repos, corpo, parametros }) => {
    const lida = await cancelarOcorrencia(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela — e
      // aqui ele deriva três coisas, `ehGestor` inclusive.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        motivo: corpo.motivo,
        observacao: corpo.observacao,
      },
    );

    return projetarOcorrenciaDetalhe(lida, {
      pessoaId: ctx.pessoaId,
      permissoes: ctx.vinculo.permissoes,
    });
  },
);

export const dynamic = "force-dynamic";
