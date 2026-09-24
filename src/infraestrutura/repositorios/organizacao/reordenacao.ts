import type { Reordenacao, ResultadoDaReordenacao } from "@/aplicacao/organizacao";
import type { ConsultaEscopada, TransacaoEscopada } from "@/infraestrutura/contexto";

/**
 * ============================================================================
 *  A reordenação, numa transação escopada — item 50
 * ============================================================================
 *
 * **As duas listas se reordenam do mesmo jeito**, e a transação mora num lugar só para não envelhecer em
 * duas cópias (plano do item 50, F-9). Quem decide é a Aplicação (`reordenarCategorias`,
 * `reordenarAreas`); este arquivo transcreve, com o predicado que guarda a premissa da decisão.
 *
 * **Os quatro passos, num `COMMIT` só** (spec §4.7):
 *
 * 1. **Trava** as linhas da lista com `for no key update`. Duas reordenações simultâneas passam a correr
 *    em fila, e a segunda enxerga o que a primeira gravou. `for update` conflitaria com a `key share` da
 *    verificação de FK de `ocorrencias` (e de `vinculos.area_id`, em `areas`), e seguraria um registro
 *    durante a reordenação.
 * 2. **Confere** que o conjunto travado é o conjunto pedido. Um item criado depois da leitura da
 *    Aplicação faz o predicado falhar, e o desfecho é o mesmo da recusa de lá.
 * 3. **Grava** `ordem` e `atualizado_por_pessoa_id` numa instrução só, e **só onde a
 *    `ordem` muda** (spec §4.2). A reordenação idêntica não grava linha.
 * 4. **Relê** a lista inteira, dentro da mesma transação, na ordem nova.
 *
 * **Toda instrução menciona `$1`**, que é a trava do `escoparTransacao`, e o `update` filtra por
 * `organizacao_id = $1` além do id: nem um predicado com defeito alcançaria linha de outra organização.
 */

/** **Lista fechada.** O nome entra no SQL por interpolação, e só pode vir daqui. */
type TabelaOrdenavel = "categorias" | "areas";

export function reordenarNaTransacao<L>(
  emTransacao: TransacaoEscopada,
  tabela: TabelaOrdenavel,
  reordenacao: Reordenacao,
  lerLista: (consulta: ConsultaEscopada) => Promise<readonly L[]>,
): Promise<ResultadoDaReordenacao<L>> {
  return emTransacao<ResultadoDaReordenacao<L>>(async (dentro) => {
    // **`order by id`, e é a ordem das travas:** duas reordenações travam as linhas na mesma sequência,
    // e nenhuma das duas fica esperando por uma linha que a outra travou antes (revisão do plano).
    const travadas = await dentro<{ id: string }>(
      `select id from ${tabela} where organizacao_id = $1 order by id for no key update`,
    );

    const pedidos = reordenacao.posicoes.map((posicao) => posicao.id);
    if (!mesmoConjunto(travadas.map((linha) => linha.id), pedidos)) {
      return { desfecho: "lista-desatualizada" };
    }

    await dentro(
      `update ${tabela} t
          set ordem = p.ordem,
              atualizado_por_pessoa_id = $4
         from unnest($2::uuid[], $3::smallint[]) as p(id, ordem)
        where t.organizacao_id = $1
          and t.id = p.id
          and t.ordem is distinct from p.ordem`,
      [pedidos, reordenacao.posicoes.map((posicao) => posicao.ordem), reordenacao.atualizadaPorPessoaId],
    );

    return { desfecho: "reordenada", itens: await lerLista(dentro) };
  });
}

/** Mesmo tamanho, sem repetição, e todo pedido entre os travados. Comparado em minúsculas. */
function mesmoConjunto(travados: readonly string[], pedidos: readonly string[]): boolean {
  if (travados.length !== pedidos.length) return false;
  const conjunto = new Set(travados.map((id) => id.toLowerCase()));
  const vistos = new Set<string>();
  for (const id of pedidos) {
    const chave = id.toLowerCase();
    if (!conjunto.has(chave) || vistos.has(chave)) return false;
    vistos.add(chave);
  }
  return true;
}
