import type { LinhaDeParticipante, LinhaDeVinculo } from "@/interface/componentes/linhas-de-participantes";

/**
 * ============================================================================
 *  A seleção de linhas da lista de participantes — item 122
 * ============================================================================
 *
 * **A seleção é um valor fora das linhas**: pessoa marcada → nome. Por isso ela sobrevive a trocar de
 * página, de filtro, de etiqueta e à busca. **Não vai para o endereço**, porque é intenção de agora e não
 * estado copiável, e some ao recarregar e depois de um envio. O nome vai junto porque o resumo do servidor
 * pode não trazê-lo (a pessoa que deixou de participar no meio do caminho).
 */
export type Selecao = ReadonlyMap<string, string>;

export const SELECAO_VAZIA: Selecao = new Map();

/** Só linha de vínculo tem caixa: pedido não é participante. A seleção é livre entre os vínculos. */
export function selecionavel(linha: LinhaDeParticipante): linha is LinhaDeVinculo {
  return linha.tipo === "vinculo";
}

export function alternar(selecao: Selecao, linha: LinhaDeVinculo): Selecao {
  const proxima = new Map(selecao);
  const pessoaId = linha.vinculo.pessoa.pessoaId;
  if (proxima.has(pessoaId)) proxima.delete(pessoaId);
  else proxima.set(pessoaId, linha.nome);
  return proxima;
}

/** O estado da caixa do cabeçalho, sobre as linhas selecionáveis **da página visível**. */
export function estadoDaPagina(selecao: Selecao, pagina: readonly LinhaDeParticipante[]): boolean | "indeterminate" {
  const daPagina = pagina.filter(selecionavel);
  if (daPagina.length === 0) return false;
  const marcadas = daPagina.filter((linha) => selecao.has(linha.vinculo.pessoa.pessoaId)).length;
  if (marcadas === 0) return false;
  return marcadas === daPagina.length ? true : "indeterminate";
}

/** Marca a página inteira, ou desmarca, se ela já estava toda marcada. Não mexe fora da página. */
export function alternarPagina(selecao: Selecao, pagina: readonly LinhaDeParticipante[]): Selecao {
  const daPagina = pagina.filter(selecionavel);
  const proxima = new Map(selecao);
  if (estadoDaPagina(selecao, pagina) === true) {
    for (const linha of daPagina) proxima.delete(linha.vinculo.pessoa.pessoaId);
  } else {
    for (const linha of daPagina) proxima.set(linha.vinculo.pessoa.pessoaId, linha.nome);
  }
  return proxima;
}
