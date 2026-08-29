import { AnexoNaoEncontrado, type ArmazenamentoDeAnexos } from "@/aplicacao/anexo";

import { OcorrenciaNaoEncontrada } from "./erros";
import type {
  AtribuicaoLida,
  CursorDeListagem,
  FiltroDeOcorrencias,
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

/**
 * ============================================================================
 *  `GET /ocorrencias/{id}/linha-do-tempo` — a intercalação (item 29)
 * ============================================================================
 *
 * **Um evento é o par (instante, fato).** `ocorridoEm` sobe para o topo do tipo porque é a **chave de
 * ordenação**, e o fato fica embrulhado no modelo de leitura de origem — inteiro, sem cópia de campo.
 *
 * **É o que faz a terceira fonte custar uma linha.** No dia do item 30, `mensagens` entra como mais um
 * `map` no arranjo abaixo; a ordenação não muda, e o projetor ganha uma forma. Achatar os campos aqui
 * obrigaria a copiar oito propriedades da transição e a lê-las renomeadas na projeção.
 */
export type EventoLido =
  | { tipo: "transicao"; ocorridoEm: string; transicao: TransicaoLida }
  | { tipo: "atribuicao"; ocorridoEm: string; atribuicao: AtribuicaoLida };

/**
 * O desempate de tipo, **declarado e não emergente**: no mesmo instante, a transição vem antes da
 * atribuição. É a ordem em que os fatos acontecem — `atribuirResponsavel` é atividade *sobre* uma
 * ocorrência que já está no estado que a transição pôs.
 */
const PESO_DO_TIPO: Readonly<Record<EventoLido["tipo"], number>> = { transicao: 0, atribuicao: 1 };

/**
 * **Ordem crescente por instante** — do mais antigo para o mais recente, como a trilha e como o protótipo
 * desenha.
 *
 * **Comparação por `Date.parse`, não por string:** os dois ISO vêm de `toISOString()` e comparariam bem
 * como texto hoje, mas a igualdade textual é frágil (um `+00:00` no lugar do `Z` bastaria), e a ordenação
 * é o que a tela inteira significa.
 *
 * **O segundo desempate é `sequencia`, e não é preciosismo:** o `UNIQUE (ocorrencia_id, sequencia)` da
 * migração 005 existe precisamente para que *"a ordenação passe a ser determinística"*
 * (`modelo-de-dados.md:1430`). Reordenar por data e jogar fora a sequência seria desfazer no código o que
 * o banco garante.
 */
function porInstante(a: EventoLido, b: EventoLido): number {
  const instante = Date.parse(a.ocorridoEm) - Date.parse(b.ocorridoEm);
  if (instante !== 0) return instante;

  const tipo = PESO_DO_TIPO[a.tipo] - PESO_DO_TIPO[b.tipo];
  if (tipo !== 0) return tipo;

  if (a.tipo === "transicao" && b.tipo === "transicao") {
    return a.transicao.sequencia - b.transicao.sequencia;
  }
  return 0;
}

/**
 * `GET /ocorrencias/{id}/linha-do-tempo` — **e a estrada direta do bloco 3 de T-05**, que é a mesma
 * função.
 *
 * **Recebe `quem`, ao contrário do endpoint irmão, e a diferença é medida.** `verTrilhaDeAuditoria`
 * confere só a existência e deixa a visibilidade no handler — que por isso chama `verOcorrencia` antes e
 * paga um `porId` inteiro, e a função paga outro. Como `porId` lê trilha e anexos em paralelo, aquele
 * endpoint custa **duas ocorrências e três trilhas** para devolver uma trilha (achado A-2 da spec). Aqui
 * há **um `porId` só**, e a rota fica em três linhas.
 *
 * **`null` e `podeLerOcorrencia` falso dão o MESMO `404`** — é a §6.3 do contrato, *"não confirmar a
 * existência do que você não pode alcançar"*, e é o critério 29.4.
 *
 * **As duas fontes vão em paralelo:** é uma ida e volta ao banco, não duas.
 *
 * **Recusado — deduzir o autor do registro `sequencia = 1`** (premissa P1) para economizar o `porId`.
 * Funcionaria, e amarraria a regra de **visibilidade** a uma premissa de **escrita**; e usaria *"trilha
 * vazia"* como sinal de `404`, que é o que o comentário de `verTrilhaDeAuditoria` proíbe em voz alta.
 */
export async function verLinhaDoTempo(
  repositorio: RepositorioEscopadoDeOcorrencias,
  id: string,
  quem: QuemPergunta,
): Promise<readonly EventoLido[]> {
  const ocorrencia = await repositorio.porId(id);
  if (ocorrencia === null) throw new OcorrenciaNaoEncontrada();
  if (!podeLerOcorrencia(ocorrencia, quem)) throw new OcorrenciaNaoEncontrada();

  const [trilha, atribuicoes] = await Promise.all([
    repositorio.trilha(id),
    repositorio.atribuicoes(id),
  ]);

  const eventos: EventoLido[] = [
    ...trilha.map((transicao) => ({
      tipo: "transicao" as const,
      ocorridoEm: transicao.ocorreuEm,
      transicao,
    })),
    // **`ocorridoEm` é `atribuidoEm`, nunca `encerradaEm`.** A atribuição encerrada fica no lugar em que
    // começou — é o *"aparece duas vezes"* do critério 29.3 lido literalmente.
    ...atribuicoes.map((atribuicao) => ({
      tipo: "atribuicao" as const,
      ocorridoEm: atribuicao.atribuidoEm,
      atribuicao,
    })),
  ];

  return eventos.sort(porInstante);
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
  pagina: {
    limite?: number;
    cursor?: CursorDeListagem | null;
    filtro?: FiltroDeOcorrencias;
  } = {},
): Promise<PaginaDeOcorrencias> {
  const limite = pagina.limite ?? LIMITE_PADRAO;

  /**
   * **Duas coisas produzem `apenas_minhas`, e só uma delas é permissão.**
   *
   * A primeira é não ter `ocorrencia.ler_todas` — a regra de visibilidade da primeira entrega. A segunda é
   * o `?autor=eu` do item 15, que é como *"o síndico morador"* vê as próprias **sem um segundo vínculo**
   * (contrato §8.5). Quem já só vê as próprias não muda de nada ao pedir: o parâmetro *"só faz diferença
   * para quem tem `ler_todas`"* (critério 28.1).
   */
  const autorPessoaId =
    quem.podeLerTodas && pagina.filtro?.apenasDoAutor !== true ? undefined : quem.pessoaId;

  const lidas = await repositorio.listar({
    ...(autorPessoaId === undefined ? {} : { autorPessoaId }),
    // **Uma linha a mais do que se devolve** — é como se sabe que há próxima página sem `count` (§7.7).
    // Quem editar esta função não pode perder isto: sem o `+ 1`, `temMais` fica falso para sempre.
    limite: limite + 1,
    cursor: pagina.cursor ?? null,
    ...(pagina.filtro === undefined ? {} : { filtro: pagina.filtro }),
  });

  return {
    itens: lidas.slice(0, limite),
    temMais: lidas.length > limite,
    visibilidadeAplicada: autorPessoaId === undefined ? "todas" : "apenas_minhas",
  };
}
