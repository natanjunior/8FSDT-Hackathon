/**
 * ============================================================================
 *  O painel de compartilhar — a metade conferível (item 87)
 * ============================================================================
 *
 * **O produto não tem biblioteca de teste de componente React**, então o que fica dentro do `.tsx` não tem
 * teste nenhum. É o precedente literal de `busca-de-candidatos.ts` e de `vazio-da-lista.ts`: a decisão sai
 * do componente e vem para cá, onde um teste a prende.
 *
 * O que mora aqui é o que uma pessoa notaria errado: quando o pedido sai, que frase o vazio mostra, que
 * motivo aparece embaixo de quem já vê, e o que muda na lista depois de compartilhar e de desfazer.
 */

export const MINIMO_DA_BUSCA = 2;

/**
 * **A espera antes de pedir, em milissegundos.** O painel é de celular e a busca é do servidor: pedir a
 * cada tecla mandaria um pedido por letra de um nome inteiro. 250 ms é curto o bastante para não parecer
 * travado e longo o bastante para um nome de duas sílabas virar um pedido, não cinco.
 */
export const ESPERA_DA_BUSCA_MS = 250;

export type CandidatoNaTela = {
  pessoaId: string;
  nome: string;
  /** O papel **em palavra**, já passado por `rotuloDoPapel`. */
  papel: string;
  situacao: "disponivel" | "ja_compartilhada" | "ja_ve";
  motivo: "le_todas" | "autor" | null;
};

/** Aparado antes de contar, porque espaço não é letra — a mesma regra do servidor. */
export function buscaProntaParaPedir(texto: string): boolean {
  return texto.trim().length >= MINIMO_DA_BUSCA;
}

/**
 * **Quem já vê aparece com o motivo escrito, e não só ao tocar.** O cenário aprovado manda a tela recusar
 * *"dizendo por quê"*, e uma opção desabilitada sem explicação é a metade que não cumpre isso.
 */
export function motivoEscrito(candidato: CandidatoNaTela): string | null {
  if (candidato.motivo === "le_todas") return "Já vê todas as ocorrências.";
  if (candidato.motivo === "autor") return "Registrou esta ocorrência.";
  return null;
}

/** Só a linha tocada muda. Compartilhar e desfazer são o mesmo gesto, ao contrário. */
export function aposCompartilhar(
  itens: readonly CandidatoNaTela[],
  pessoaId: string,
): readonly CandidatoNaTela[] {
  return itens.map((item) =>
    item.pessoaId === pessoaId ? { ...item, situacao: "ja_compartilhada" as const } : item,
  );
}

export function aposDesfazer(
  itens: readonly CandidatoNaTela[],
  pessoaId: string,
): readonly CandidatoNaTela[] {
  return itens.map((item) =>
    item.pessoaId === pessoaId ? { ...item, situacao: "disponivel" as const } : item,
  );
}

/**
 * **Duas frases, e trocar uma pela outra é o defeito.** Antes do mínimo a tela diz o que fazer; depois
 * dele, que não achou. Uma frase só faria *"Ninguém com esse nome"* aparecer antes de haver nome.
 */
export function textoDoVazioDaBusca(texto: string): string {
  return buscaProntaParaPedir(texto)
    ? "Ninguém com esse nome."
    : "Digite o nome de quem vai ver esta ocorrência.";
}
