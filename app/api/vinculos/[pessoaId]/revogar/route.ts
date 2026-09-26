import { revogarVinculo } from "@/aplicacao/organizacao";
import { comContexto } from "@/interface/http";

/**
 * **`POST /vinculos/{pessoaId}/revogar` — encerrar o acesso preservando o registro** (item 84).
 *
 * **É comando, e não `DELETE`:** a linha de `vinculos` fica, e o `DELETE` deste recurso continua sendo o
 * único do contrato (critério 10.5). A gramática é a de `…/aprovar` e `…/recusar`: o caminho diz o que
 * acontece.
 *
 * **Não declara `corpo`**, pelo mesmo motivo do `DELETE` vizinho: `lerCorpo` devolve `undefined` sem olhar
 * o `content-type`, então o cabeçalho que `cabecalhosDeEscrita` manda é inofensivo, e não há `400` nem
 * `415` a publicar. O handler não devolve nada, e `montarResposta` responde `204`.
 *
 * **A ordem das recusas é a de sempre:** `401` → `403` → `409 ORGANIZACAO_DIVERGENTE` → `404` / `409
 * ULTIMO_GESTOR` da Aplicação.
 */
export const POST = comContexto({ exige: "vinculo.gerir" }, async ({ repos, parametros }) => {
  await revogarVinculo(repos.vinculos, parametros["pessoaId"] ?? "");
});

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
