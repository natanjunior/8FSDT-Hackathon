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

export type OpcaoDoRecorte = {
  readonly valor: "todas" | "minhas" | "compartilhadas";
  readonly rotulo: string;
  /** `null` quando a opção não mostra número — as duas de quem não tem `ler_todas`. */
  readonly contagem: keyof ContagensDoRecorte | null;
};

/** Os dois números do painel que o seletor imprime — os dois medem o mesmo conjunto. */
export type ContagensDoRecorte = { readonly todas: number; readonly minhas: number };

/**
 * **Sem número nas duas opções de quem não tem `ler_todas`, e a ausência é decisão.** O lugar do número em
 * *Compartilhadas comigo* é do item 88, e ele conta **não abertas**: mostrar agora o total e trocá-lo
 * depois pelo não aberto faria o mesmo lugar significar duas coisas em duas versões. Pôr número só em
 * *Minhas* deixaria o controle torto.
 *
 * **Quem tem `ler_todas` não ganha a terceira opção:** compartilhar com quem lê todas é recusado, então a
 * aba dele seria sempre vazia. O parâmetro `?compartilhadas=comigo` continua funcionando na API para
 * qualquer um — é filtro honesto sobre dado —, e só a tela não o oferece.
 */
export function opcoesDoRecorte(podeLerTodas: boolean): readonly OpcaoDoRecorte[] {
  if (podeLerTodas) {
    return [
      { valor: "todas", rotulo: RECORTE_TODAS, contagem: "todas" },
      { valor: "minhas", rotulo: RECORTE_MINHAS, contagem: "minhas" },
    ];
  }
  return [
    { valor: "minhas", rotulo: RECORTE_MINHAS, contagem: null },
    { valor: "compartilhadas", rotulo: RECORTE_COMPARTILHADAS, contagem: null },
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
