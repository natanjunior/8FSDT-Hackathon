/**
 * ============================================================================
 *  O quadro 4 de T-07 — o que está voltando
 * ============================================================================
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela razão dos itens 57, 58 e 59: derivação dentro de um
 * componente é derivação que nenhum teste do laço curto alcança.
 *
 * **Nenhum rótulo viaja na resposta.** O texto da dupla são os dois nomes com um separador, e escrevê-lo é
 * da tela — o mesmo corte que o item 59 fez com a faixa de idade e o 55 com a unidade de tempo.
 * `statusRotulo` continua sendo a exceção, porque ele depende de quem lê.
 *
 * **O tipo é declarado aqui e não importado da Aplicação**, como `FaixaDeIdadeNaTela`: ler a mesma forma
 * de duas fontes poria duas verdades numa linha só.
 */

/** O que a linha precisa saber da dupla. É a forma de `DashboardProjetado.duplasRecorrentes[]`. */
export type DuplaNaTela = {
  area: { id: string; nome: string };
  categoria: { id: string; nome: string };
  quantidade: number;
};

/**
 * A chave da lista — **o par de identificadores, e nunca o rótulo**.
 *
 * Dois nomes iguais em organizações diferentes não colidem, mas uma Área e uma Categoria homônimas na
 * mesma organização sim, e `key` duplicada em React é defeito silencioso.
 */
export function chaveDaDupla(dupla: DuplaNaTela): string {
  return `${dupla.area.id}:${dupla.categoria.id}`;
}

/**
 * `Garagem — Subsolo 1 · Vazamentos` — **área primeiro**, como o critério 60.4 escreve a dupla.
 *
 * Os critérios dizem *"área e categoria"* três vezes seguidas, e o gráfico do quadro segue a mesma ordem:
 * área na linha de cima do rótulo, categoria na de baixo.
 *
 * **O separador é ` · `**, o mesmo do resto do painel. Nenhum separador novo entra no
 * vocabulário da tela.
 */
export function rotuloDaDupla(dupla: DuplaNaTela): string {
  return `${dupla.area.nome} · ${dupla.categoria.nome}`;
}

/**
 * O que a seção escreve quando nenhuma dupla se repetiu no período — critério 60.3.
 *
 * **Duas orações curtas e nenhum aviso de defeito.** A primeira diz o que aconteceu; a segunda diz o que
 * vai aparecer ali, que é o critério literal. Ela não promete prazo, não pede ação e não explica o produto.
 */
export const SEM_DUPLA_RECORRENTE =
  "Nenhuma dupla se repetiu no período. Aqui aparece a mesma categoria voltando na mesma área, " +
  "a partir da segunda vez.";

/**
 * O rodapé do quadro 4 — **o todo de que cada barra é parte** (item 110, critério 6, decidido em
 * `respostas.md` P1). São as registradas do período, o mesmo `entraram` do cartão do saldo: as duplas
 * contam pela mesma `registrada_em` na mesma janela, e área e categoria são obrigatórias, então nenhuma
 * ocorrência fica de fora.
 *
 * **Sem singular a tratar**: a frase só aparece quando há dupla, e dupla exige ao menos duas.
 */
export function fraseDoDenominadorDasDuplas(entraram: number): string {
  return `Parte das ${String(entraram)} registradas no período.`;
}

/** Quantas duplas o quadro mostra antes de cortar — **cinco**, e o critério 14 do item 73 pede o corte. */
const DUPLAS_NO_TOPO = 5;

/**
 * **As cinco primeiras, mais as empatadas com a quinta** (critério 73.14). O corte nunca separa um
 * empate, e é isso que torna verdadeira a frase de baixo: tudo o que ficou de fora tem, no máximo, a
 * contagem da maior das restantes, e ela é menor que a da última mostrada.
 *
 * **Recebe a lista já ordenada**: quem ordena é a Aplicação, e ordenar aqui de novo seria afirmar a
 * mesma regra em duas camadas.
 */
export function corteDeTopo<T extends { quantidade: number }>(
  duplas: readonly T[],
  topo: number = DUPLAS_NO_TOPO,
): { mostradas: readonly T[]; restantes: number; maiorDasRestantes: number } {
  const limite = duplas[topo - 1]?.quantidade;
  const mostradas =
    limite === undefined
      ? duplas
      : duplas.filter((dupla, i) => i < topo || dupla.quantidade === limite);
  const fora = duplas.slice(mostradas.length);
  return {
    mostradas,
    restantes: fora.length,
    maiorDasRestantes: fora[0]?.quantidade ?? 0,
  };
}

/** `Mais 23 duplas com 5 ocorrências ou menos`, e o singular quando sobra uma. */
export function fraseDoResto(restantes: number, maior: number): string {
  const duplas = restantes === 1 ? "dupla" : "duplas";
  const ocorrencias = maior === 1 ? "ocorrência" : "ocorrências";
  return `Mais ${String(restantes)} ${duplas} com ${String(maior)} ${ocorrencias} ou menos`;
}
