import { enviarComentario, verComentarios } from "@/aplicacao/ocorrencia";
import {
  comContexto,
  lerCursorDeConversaDaUrl,
  lerLimiteDaUrl,
  resposta,
  registrarLeituraDeQuemAgiu,
} from "@/interface/http";
import { projetarComentario, projetarPaginaDeComentarios } from "@/interface/projecoes";
import { comentarioSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  `GET` e `POST /ocorrencias/{id}/comentarios` — o canal 1, e SÓ ele
 * ============================================================================
 *
 * **Este arquivo exporta `GET` e `POST`, e nada mais** — é o critério **30.3** na camada em que ele é
 * estrutural, e não só testado: *"não há `PATCH` nem `DELETE` de mensagem"* deixa de ser promessa e passa
 * a ser **ausência de `export`**. É a forma que `app/api/ocorrencias/route.ts` já tem.
 *
 * **Os participantes são derivados, nunca listados** (critério 30.2): Gestores da organização mais o
 * autor da ocorrência. Quem não é nenhum dos dois recebe **`404` da ocorrência**, e não um `403` do
 * comentário — um erro que dissesse *"você não participa desta conversa"* confirmaria a existência da
 * ocorrência a quem não pode alcançá-la (§6.3). **Esse erro não existe e não vai existir.**
 *
 * **A permissão é `ocorrencia.comentar` nas DUAS operações**, inclusive no `GET`, como a §8.6 do contrato
 * manda. Hoje todo mundo que abre T-05 a tem — Solicitante e Gestor —, então a escolha não separa
 * ninguém: ela é a do contrato. Quem leva `403 PERMISSAO_INSUFICIENTE` é o Encarregado, cuja lista é
 * vazia por decisão do contrato §4.5, e o `comContexto` o recusa **antes** de o recurso ser lido.
 *
 * **Não existe nota interna nesta entrega** (critério 30.5), e o que o garante é o que **não** se
 * constrói: os canais 2 e 3 são ⬜ no `escopo.md`, e o contrato reserva `/notas-internas` e
 * `/atribuicoes/{id}/mensagens` para quando entrarem (§11).
 *
 * *Capacidade: comentar com os Gestores dentro da ocorrência · `ENUNCIADO · aberto` (S8, G6) + D9.*
 */
export const GET = comContexto(
  { exige: "ocorrencia.comentar" },
  async ({ ctx, repos, parametros, requisicao }) => {
    const pagina = await verComentarios(
      repos.ocorrencias,
      parametros["ocorrenciaId"] ?? "",
      { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
      { limite: lerLimiteDaUrl(requisicao), cursor: lerCursorDeConversaDaUrl(requisicao) },
    );

    return projetarPaginaDeComentarios(pagina);
  },
);

/**
 * **`201`, e sem `Location`** — ao contrário de `POST /ocorrencias`. Não existe `GET /comentarios/{id}`,
 * e um `Location` apontaria para endereço que o contrato não tem.
 *
 * **SEM `corpoOpcional`:** o `openapi.yaml` declara `requestBody: required: true`. Corpo ausente é `415`
 * pelo caminho normal do `comContexto`; corpo `{}` é `400` com o campo em `erros[]`.
 *
 * **Dois toques criam dois comentários**, e está publicado (contrato §7.10): não há chave de
 * idempotência, e esta é a única operação de escrita do contrato que não é protegida por repetição. O
 * freio contra o toque duplo é da tela, e não promete nada.
 */
export const POST = comContexto(
  { exige: "ocorrencia.comentar", corpo: comentarioSchema },
  async ({ ctx, repos, corpo, parametros, requisicao }) => {
    const criada = await enviarComentario(
      repos.ocorrencias,
      parametros["ocorrenciaId"] ?? "",
      { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
      { texto: corpo.texto },
    );

    // Agir marca como lida (item 117): depois do comando, e sem derrubar a resposta.
    await registrarLeituraDeQuemAgiu(
      repos.ocorrencias,
      parametros["ocorrenciaId"] ?? "",
      ctx.pessoaId,
      new URL(requisicao.url).pathname,
    );

    return resposta(projetarComentario(criada), { status: 201 });
  },
);

export const dynamic = "force-dynamic";
