import { atribuirResponsavel } from "@/aplicacao/ocorrencia";
import { CampoNaoSuportado, comContexto } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { atribuicaoDeResponsavelSchema, camposSemDestino } from "@/interface/schemas";

/**
 * A recusa do `observacao`, **antes** da validação de forma — critério 19.6.
 *
 * A ordem importa, e a razão já está escrita em `app/api/vinculos/[pessoaId]/route.ts`: *"quem mandou o
 * campo precisa saber que ele não é aceito, não que faltou preencher algo"*.
 *
 * **O item 17 chama esta mesma `camposSemDestino`** — critério 17.6.
 */
function recusarSemDestino(corpo: unknown): void {
  const proibidos = camposSemDestino(corpo);
  if (proibidos.length > 0) throw new CampoNaoSuportado(proibidos);
}

/**
 * **`POST /ocorrencias/{id}/atribuir-responsavel`** — *"quem está fazendo isto?"*, que é a pergunta que a
 * D21 diz ser a que se perde hoje.
 *
 * **É o primeiro comando do produto que NÃO transiciona.** Não muda `status`, não grava registro na trilha
 * e não aparece na trilha de auditoria (critério 19.4) — escreve numa tabela própria, `atribuicoes`, e
 * carimba `ocorrencias.atualizada_em` porque atribuir é **atividade** na ocorrência.
 *
 * **`409 TRANSICAO_NAO_PERMITIDA` em `resolvida` e `cancelada`**, mesmo não havendo transição: é o código
 * que o contrato declara para este endpoint (§8.4). O nome do código é do contrato; a pergunta que o
 * produz — `comandoPermitido`, a união das duas tabelas da máquina — é nossa.
 *
 * **`reatribuicao` é campo do ENVELOPE**, não do recurso: o `openapi.yaml` declara a resposta como
 * `allOf: [OcorrenciaDetalhe, { reatribuicao }]`, e `GET /ocorrencias/{id}` não o tem. Por isso
 * `projetarOcorrenciaDetalhe` **não muda** e o campo é acrescentado aqui — o que mantém verdadeira a
 * promessa do item 16, *"a resposta do comando é indistinguível de reler a ocorrência"*, em tudo menos no
 * campo que o contrato acrescentou de propósito.
 *
 * **A auto-atribuição em um clique não é endpoint** (item 20): o cliente envia o próprio `pessoaId`, que
 * `GET /contexto` já lhe deu. **Reatribuir também não é**: é este mesmo caminho com atribuição vigente.
 *
 * *Capacidade: atribuir o responsável · `ENUNCIADO · aberto` (G4) + D21. Permissão: `ocorrencia.atribuir`
 * — Gestor.*
 */
export const POST = comContexto(
  {
    exige: "ocorrencia.atribuir",
    corpo: atribuicaoDeResponsavelSchema,
    recusar: recusarSemDestino,
  },
  async ({ ctx, repos, corpo, parametros }) => {
    const { ocorrencia, reatribuicao } = await atribuirResponsavel(
      repos.ocorrencias,
      // **`permissoes`, e não `podeLerTodas`.** Uma fonte só: o comando deriva o que precisar dela, e é a
      // mesma lista que monta `acoesDisponiveis` no corpo do `409`.
      { pessoaId: ctx.pessoaId, permissoes: ctx.vinculo.permissoes },
      {
        ocorrenciaId: parametros["ocorrenciaId"] ?? "",
        responsavelPessoaId: corpo.responsavelPessoaId,
      },
    );

    return {
      ...projetarOcorrenciaDetalhe(ocorrencia, {
        pessoaId: ctx.pessoaId,
        permissoes: ctx.vinculo.permissoes,
      }),
      reatribuicao,
    };
  },
);

export const dynamic = "force-dynamic";
