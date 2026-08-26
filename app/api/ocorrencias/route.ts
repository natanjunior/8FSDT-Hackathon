import { registrarOcorrencia } from "@/aplicacao/ocorrencia";
import { CampoNaoSuportado, comContexto, resposta } from "@/interface/http";
import { projetarOcorrenciaDetalhe } from "@/interface/projecoes";
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
    const lida = await registrarOcorrencia(repos, { pessoaId: ctx.pessoaId }, corpo);

    return resposta(
      projetarOcorrenciaDetalhe(lida, {
        pessoaId: ctx.pessoaId,
        permissoes: ctx.vinculo.permissoes,
      }),
      { status: 201, cabecalhos: { Location: `/api/ocorrencias/${lida.id}` } },
    );
  },
);

export const dynamic = "force-dynamic";
