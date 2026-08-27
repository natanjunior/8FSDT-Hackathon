import { listarOcorrencias, registrarOcorrencia } from "@/aplicacao/ocorrencia";
import {
  CampoNaoSuportado,
  armazenamentoDeAnexos,
  comContexto,
  lerCursorDaUrl,
  lerLimiteDaUrl,
  resposta,
} from "@/interface/http";
import { projetarOcorrenciaDetalhe, projetarPaginaDeOcorrencias } from "@/interface/projecoes";
import { camposEscritosPeloServidor, registroDeOcorrenciaSchema } from "@/interface/schemas";

/**
 * A recusa dos cinco campos do critério 11.3, **antes** da validação de forma.
 *
 * A ordem importa: quem enviou `status: "resolvida"` junto com um título vazio precisa saber que o
 * produto não aceita o primeiro, e não só que o segundo está errado.
 */
function recusarEscritosPeloServidor(corpo: unknown): void {
  const proibidos = camposEscritosPeloServidor(corpo);
  if (proibidos.length > 0) throw new CampoNaoSuportado(proibidos);
}

/**
 * **`POST /ocorrencias`** — registra a ocorrência **e grava o primeiro registro da trilha**, com
 * `statusAnterior` nulo (premissa P1). Ele volta na resposta, em `ultimaTransicao`.
 *
 * **Três coisas o servidor escreve e o cliente não pode enviar:** `status` (nasce `aberta`), `prioridade`
 * (nasce `normal`, D6) e `areaTipo` (a cópia congelada que decide a visibilidade para sempre). E uma
 * quarta, que é o requisito central do desafio: o registro de transição.
 *
 * **E o anexo é reivindicado aqui, na mesma transação.** `anexos: [{chave, ticket}]` chega como
 * referência a um objeto que já subiu ao storage; o servidor confere o ticket, lê o objeto, troca a
 * etiqueta para `confirmado` e grava a terceira linha do mesmo `COMMIT`. Nenhum byte de anexo atravessa
 * este contêiner (contrato §10.1).
 *
 * *Permissão: `ocorrencia.registrar` — Solicitante **e** Gestor, que acumula (§4.5).*
 */
export const POST = comContexto(
  // **`corpo:`, nao `schema:`** — e o nome que `OpcoesEscopadas` tem hoje, e e o que
  // `POST /categorias` e `PATCH /vinculos` ja usam.
  {
    exige: "ocorrencia.registrar",
    corpo: registroDeOcorrenciaSchema,
    recusar: recusarEscritosPeloServidor,
  },
  async ({ ctx, repos, corpo }) => {
    const lida = await registrarOcorrencia(
      // **`repos` mais uma porta que não é repositório escopado.** `RepositoriosEscopados` continua sem
      // membro que não seja repositório escopado — quem junta as duas coisas é o anel externo, que é
      // quem monta (ADR-0005).
      { ...repos, armazenamento: armazenamentoDeAnexos() },
      { pessoaId: ctx.pessoaId, organizacaoId: ctx.vinculo.organizacaoId },
      corpo,
    );

    return resposta(
      projetarOcorrenciaDetalhe(lida, {
        pessoaId: ctx.pessoaId,
        permissoes: ctx.vinculo.permissoes,
      }),
      { status: 201, cabecalhos: { Location: `/api/ocorrencias/${lida.id}` } },
    );
  },
);

/**
 * **`GET /ocorrencias`** — a mesma URL, conjuntos diferentes conforme quem pergunta (contrato §8.5).
 *
 * **A permissão exigida é `ocorrencia.ler_propria`, e não é engano.** O contrato diz *"`ler_todas` **ou**
 * `ler_propria`"*, e `comContexto` aceita **uma**. Não há caso a resolver: o Gestor **acumula** as do
 * Solicitante (§4.5), então `ler_propria` é verdadeira para os dois papéis que leem, e falsa só para o
 * `encarregado` — que é justamente quem tem de levar `403`. Qual dos dois conjuntos volta é decidido
 * **depois**, por `ler_todas`, e sai declarado em `visibilidadeAplicada`.
 *
 * *Capacidades: listar todas da organização · `ENUNCIADO · aberto` (G1).*
 */
export const GET = comContexto({ exige: "ocorrencia.ler_propria" }, async ({ ctx, repos, requisicao }) => {
  const pagina = await listarOcorrencias(
    repos.ocorrencias,
    { pessoaId: ctx.pessoaId, podeLerTodas: ctx.vinculo.pode("ocorrencia.ler_todas") },
    { limite: lerLimiteDaUrl(requisicao), cursor: lerCursorDaUrl(requisicao) },
  );

  return projetarPaginaDeOcorrencias(pagina);
});

export const dynamic = "force-dynamic";
