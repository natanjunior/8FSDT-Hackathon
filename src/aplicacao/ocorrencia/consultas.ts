import { OcorrenciaNaoEncontrada } from "./erros";
import type { OcorrenciaLida, RepositorioEscopadoDeOcorrencias, TransicaoLida } from "./portas";

/**
 * `GET /ocorrencias/{id}`.
 *
 * **O repositório escopado é a defesa**: ele não recebe o identificador da organização, e portanto não
 * tem como devolver a ocorrência de outra. `null` vira `404` — o mesmo `404` de inexistente, que é a
 * §6.3.
 *
 * **A visibilidade da primeira entrega** — autor ou `ocorrencia.ler_todas` — é aplicada pelo handler,
 * que é quem tem o `Vinculo`. Aqui fica o que não depende de quem pergunta.
 */
export async function verOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
): Promise<OcorrenciaLida> {
  const ocorrencia = await repositorio.porId(id);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  return ocorrencia;
}

/**
 * `GET /ocorrencias/{id}/trilha-de-auditoria`.
 *
 * **É a única forma de alcançar um registro de transição pela API, e é somente leitura.** Não existe
 * `POST`, `PATCH` nem `DELETE` neste recurso — se um dia aparecer escrita aqui, a garantia central do
 * produto terá sido perdida.
 *
 * Confere a ocorrência **antes** da trilha: uma ocorrência que não é desta organização tem de dar `404`,
 * não uma lista vazia — lista vazia diria *"existe e não tem registros"*, que é falso nos dois sentidos.
 */
export async function verTrilhaDeAuditoria(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
): Promise<readonly TransicaoLida[]> {
  if ((await repositorio.porId(id)) === null) throw new OcorrenciaNaoEncontrada();
  return repositorio.trilha(id);
}
