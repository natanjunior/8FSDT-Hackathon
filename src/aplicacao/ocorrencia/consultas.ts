import { AnexoNaoEncontrado, type ArmazenamentoDeAnexos } from "@/aplicacao/anexo";

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
 * **A visibilidade da primeira entrega, numa função só** — autor **ou** `ocorrencia.ler_todas`
 * (`escopo.md` §3.3).
 *
 * Ela estava escrita duas vezes, copiada: em `app/api/ocorrencias/[ocorrenciaId]/route.ts` e em
 * `app/ocorrencias/[ocorrenciaId]/page.tsx`. O `verOcorrencia` acima explica por que ela é **aplicada
 * pelo handler** — é ele quem tem o `Vinculo` —, e isso justifica **onde ela é chamada**, não que ela
 * seja escrita três vezes. Agora é uma, com três chamadores.
 */
export function podeLerOcorrencia(
  lida: { autor: { pessoaId: string } },
  quem: QuemPergunta,
): boolean {
  return quem.podeLerTodas || lida.autor.pessoaId === quem.pessoaId;
}

/** A representação pedida. `?variante=miniatura` é **outra representação do mesmo anexo**, não outro
 *  recurso — e é por isso que a autorização é a mesma (contrato §10.4). */
export type VarianteDoAnexo = "original" | "miniatura";

/**
 * `GET /ocorrencias/{id}/anexos/{anexoId}` — devolve a **URL assinada**, e o `302` é do handler.
 *
 * **Quatro passos, e o terceiro é o que faz a chave nunca sair:** a chave é lida, entregue ao assinador e
 * descartada dentro desta função. Ela não volta ao chamador e não existe em tipo nenhum que alimente
 * payload.
 *
 * **A autorização acontece a cada leitura** — é a ocorrência que decide quem vê, nunca a posse de um
 * link. Por isso a mesma regra de `GET /ocorrencias/{id}` roda aqui, e a recusa é o mesmo `404`.
 */
export async function verAnexoDaOcorrencia(
  repositorio: RepositorioEscopadoDeOcorrencias,
  armazenamento: ArmazenamentoDeAnexos,
  quem: QuemPergunta,
  pedido: { ocorrenciaId: string; anexoId: string; variante: VarianteDoAnexo },
): Promise<string> {
  const ocorrencia = await repositorio.porId(pedido.ocorrenciaId);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  if (!podeLerOcorrencia(ocorrencia, quem)) throw new OcorrenciaNaoEncontrada();

  const objeto = await repositorio.objetoDoAnexo(pedido.ocorrenciaId, pedido.anexoId);
  if (objeto === null) throw new AnexoNaoEncontrado();

  const chave = pedido.variante === "miniatura" ? objeto.thumbnailChave : objeto.chave;
  // Miniatura ausente é `404 ANEXO_NAO_ENCONTRADO`, e não o objeto principal disfarçado de prévia —
  // critério 13b.5 e §6.3.
  if (chave === null) throw new AnexoNaoEncontrado();

  return armazenamento.urlDeLeitura(chave);
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
