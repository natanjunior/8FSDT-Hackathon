import type { VisibilidadeAplicada } from "@/aplicacao/ocorrencia";

import { semPaginacao } from "./filtros-da-lista";
import { RECORTE_COMPARTILHADAS, RECORTE_MINHAS, RECORTE_TODAS } from "./rotulos";

/**
 * ============================================================================
 *  As opções do recorte de T-03 — e elas mudaram de dono no item 87
 * ============================================================================
 *
 * **Até o item 87 só quem tinha `ocorrencia.ler_todas` via o controle**, porque para o Solicitante havia
 * uma opção só e um alvo de 44 px que não faz nada é pior que texto. Com a aba *Compartilhadas comigo*
 * ele passa a ter duas opções, então passa a haver o que escolher.
 *
 * **Por que um módulo, e não o `.tsx`:** `recorte-da-lista.tsx` tem `"use client"`, e a página é
 * componente de servidor. Uma função exportada de módulo de cliente chega ao servidor como referência, e
 * não como função. **E não vai para `filtros-da-lista.ts`** porque o cabeçalho dele declara que o único
 * `import` é o da busca do produto, e aqui os rótulos vêm de `rotulos.ts`.
 *
 * É o precedente de `busca-de-candidatos.ts`: o que fica dentro do `.tsx` não tem teste, então a decisão
 * sai dele.
 */

/**
 * **Duas formas, e a diferença é de significado** (item 88). `"total"` conta um conjunto que a pessoa pode
 * escolher ver; `"nao-vistas"` conta uma pendência, e pendência zero não é número, é ausência.
 */
export type FormaDoNumero = "total" | "nao-vistas";

export type OpcaoDoRecorte = {
  readonly valor: "todas" | "minhas" | "compartilhadas";
  readonly rotulo: string;
  /**
   * `null` quando a opção não mostra número. **O campo e a forma andam juntos** porque um sem o outro é
   * estado impossível: a pílula neutra conta o conjunto, o selo da marca conta o que ainda não foi visto.
   */
  readonly contagem: { readonly campo: keyof ContagensDoRecorte; readonly forma: FormaDoNumero } | null;
};

/**
 * Os números do painel que o seletor imprime. `todas` e `minhas` medem o mesmo conjunto; a terceira mede
 * outra coisa, e por isso o desenho dela é outro.
 */
export type ContagensDoRecorte = {
  readonly todas: number;
  readonly minhas: number;
  /** item 88 — as não abertas de quem recebe. `0` para quem tem `ler_todas`. */
  readonly compartilhadasNaoAbertas: number;
};

/**
 * **O número de *Compartilhadas comigo* conta as NÃO ABERTAS** (item 88), e por isso ele tem forma própria:
 * na mesma peça, com a cara do total, *Compartilhadas comigo 3* seria lido como *"3 compartilhadas"*.
 *
 * **Minhas continua sem número:** para quem não lê todas, *Minhas* é o padrão, e um número ali seria o
 * mesmo que o `total` da página, dois centímetros ao lado.
 *
 * **Quem tem `ler_todas` não ganha a terceira opção:** compartilhar com quem lê todas é recusado, então a
 * aba dele seria sempre vazia. O parâmetro `?compartilhadas=comigo` continua funcionando na API para
 * qualquer um — é filtro honesto sobre dado —, e só a tela não o oferece.
 */
export function opcoesDoRecorte(podeLerTodas: boolean): readonly OpcaoDoRecorte[] {
  if (podeLerTodas) {
    return [
      { valor: "todas", rotulo: RECORTE_TODAS, contagem: { campo: "todas", forma: "total" } },
      { valor: "minhas", rotulo: RECORTE_MINHAS, contagem: { campo: "minhas", forma: "total" } },
    ];
  }
  return [
    { valor: "minhas", rotulo: RECORTE_MINHAS, contagem: null },
    {
      valor: "compartilhadas",
      rotulo: RECORTE_COMPARTILHADAS,
      contagem: { campo: "compartilhadasNaoAbertas", forma: "nao-vistas" },
    },
  ];
}

/** Qual opção está marcada, a partir do que o servidor aplicou. */
export function valorDoRecorte(visibilidade: VisibilidadeAplicada): OpcaoDoRecorte["valor"] {
  if (visibilidade === "todas") return "todas";
  if (visibilidade === "compartilhadas_comigo") return "compartilhadas";
  return "minhas";
}

/**
 * Aplica a escolha sobre a *query string* e descarta a paginação — conjunto novo, corte novo.
 *
 * **`"minhas"` liga `?autor=eu` só para quem tem `ler_todas`:** para o Solicitante, *Minhas* é o padrão e
 * não parâmetro, e é o critério 28.1 — o parâmetro *"só faz diferença para quem tem `ler_todas`"*.
 */
export function consultaDoRecorte(
  consultaAtual: string,
  valor: OpcaoDoRecorte["valor"],
  podeLerTodas: boolean,
): URLSearchParams {
  const proximos = semPaginacao(new URLSearchParams(consultaAtual));
  proximos.delete("autor");
  proximos.delete("compartilhadas");
  if (valor === "minhas" && podeLerTodas) proximos.set("autor", "eu");
  if (valor === "compartilhadas") proximos.set("compartilhadas", "comigo");
  return proximos;
}
