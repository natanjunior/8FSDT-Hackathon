import { compartilharOcorrencia } from "@/aplicacao/ocorrencia";
import { comContexto, resposta } from "@/interface/http";
import { projetarCompartilhamento } from "@/interface/projecoes";
import { compartilhamentoSchema } from "@/interface/schemas";

/**
 * ============================================================================
 *  `POST /ocorrencias/{id}/compartilhamentos` — item 87
 * ============================================================================
 *
 * **`201` quando nasce, `200` quando já existia**, e as duas com a linha: duas abas mandando o mesmo
 * pedido terminam com uma linha e nenhuma vê erro.
 *
 * **A permissão na porta é `ocorrencia.ler_propria`**, como `GET /ocorrencias`: o Gestor acumula as do
 * Solicitante, e a regra fina — quem pode compartilhar com quem — é da Aplicação, depois de ler o
 * recurso. Quem recebeu a ocorrência compartilhada leva `403` ali, e não aqui: ele **tem** a permissão da
 * porta, e o que ele não tem é relação com este recurso.
 *
 * **Não existe `GET` da coleção.** A lista vem no detalhe da ocorrência, que é o único lugar que a
 * desenha.
 */
export const POST = comContexto(
  { exige: "ocorrencia.ler_propria", corpo: compartilhamentoSchema },
  async ({ ctx, repos, corpo, parametros }) => {
    const quem = {
      pessoaId: ctx.pessoaId,
      podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas"),
    };
    const { criado, compartilhamento } = await compartilharOcorrencia(repos.ocorrencias, quem, {
      ocorrenciaId: parametros["ocorrenciaId"] ?? "",
      pessoaId: corpo.pessoaId,
    });

    // **Não é `true` fixo:** no `200` a linha pode ser do Gestor, e a autora que repetiu o pedido não a
    // desfaz.
    const podeDesfazer = quem.podeLerTodas || compartilhamento.por.pessoaId === quem.pessoaId;
    return resposta(projetarCompartilhamento(compartilhamento, podeDesfazer), {
      status: criado ? 201 : 200,
    });
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
