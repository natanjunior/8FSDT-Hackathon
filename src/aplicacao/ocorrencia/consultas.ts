import { OcorrenciaNaoEncontrada } from "./erros";
import type {
  CursorDeListagem,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  RepositorioEscopadoDeOcorrencias,
  TransicaoLida,
} from "./portas";

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

/** O padrão do contrato (`openapi.yaml`, parâmetro `Limite`). */
export const LIMITE_PADRAO = 20;
/** O teto do contrato. Quem pedir acima leva `400` — a recusa é da camada de Interface. */
export const LIMITE_MAXIMO = 100;

/** Quem está perguntando, reduzido ao que a listagem precisa saber. */
export type QuemPergunta = { pessoaId: string; podeLerTodas: boolean };

/** O recorte aplicado, declarado na resposta *"para que o cliente possa dizer ao usuário o que está
 *  vendo"* (`contrato-de-api.md` §8.5). */
export type VisibilidadeAplicada = "todas" | "apenas_minhas";

export type PaginaDeOcorrencias = {
  itens: readonly OcorrenciaResumoLida[];
  /** Há pelo menos mais uma linha depois desta página. Quem projeta transforma isto em `proximoCursor`. */
  temMais: boolean;
  visibilidadeAplicada: VisibilidadeAplicada;
};

/**
 * `GET /ocorrencias` — e a **estrada direta** de T-03, que é a mesma função.
 *
 * **A visibilidade desce até o `where`, e isso não é otimização.** Em T-05 ela é uma pergunta sobre *uma*
 * ocorrência e pode ser respondida depois de ler. Numa lista, não: filtrar depois de paginar devolveria
 * páginas de tamanho aleatório e uma última página falsamente vazia. Por isso ela chega aqui como
 * `podeLerTodas` — calculado por `vinculo.pode("ocorrencia.ler_todas")`, nunca pelo papel (contrato §4.5)
 * — e sai como `autorPessoaId` no filtro.
 *
 * **Pede uma linha a mais do que devolve.** É como se sabe que há próxima página sem um `count`, que o
 * contrato recusou (§7.7): a linha excedente é lida, contada e descartada. E é o que garante que
 * `proximoCursor` só existe quando há mesmo o que carregar — um cursor que abre página vazia é pior que
 * nenhum.
 */
export async function listarOcorrencias(
  repositorio: RepositorioEscopadoDeOcorrencias,
  quem: QuemPergunta,
  pagina: { limite?: number; cursor?: CursorDeListagem | null } = {},
): Promise<PaginaDeOcorrencias> {
  const limite = pagina.limite ?? LIMITE_PADRAO;

  const lidas = await repositorio.listar({
    ...(quem.podeLerTodas ? {} : { autorPessoaId: quem.pessoaId }),
    limite: limite + 1,
    cursor: pagina.cursor ?? null,
  });

  return {
    itens: lidas.slice(0, limite),
    temMais: lidas.length > limite,
    visibilidadeAplicada: quem.podeLerTodas ? "todas" : "apenas_minhas",
  };
}
