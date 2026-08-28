import { atribuirResponsavel } from "@/aplicacao/ocorrencia";
import { comContexto, recusarSemDestino } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
import { atribuicaoDeResponsavelSchema } from "@/interface/schemas";

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
 *
 * **A recusa de `observacao` mudou de casa no item 17**, e é o critério 17.6 daquele item: o `if` que
 * morava aqui virou `recusarSemDestino` em `@/interface/http`, para que os **dois** endpoints com o mesmo
 * defeito de contrato chamem a mesma função em vez de copiarem o mesmo `throw`. A ordem não mudou: o `422`
 * continua vindo **antes** da validação de forma.
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
