import type { VisibilidadeAplicada } from "@/aplicacao/ocorrencia";

/**
 * ============================================================================
 *  Qual dos três vazios T-03 mostra — o critério 14.4
 * ============================================================================
 *
 * *"Trocar uma pela outra faz o Gestor pensar que perdeu dados."* O erro clássico não é escrever mal as
 * frases: é **usar uma no lugar da outra**, que é uma decisão — e por isso ela mora numa função com teste,
 * e não num `?:` dentro do JSX.
 *
 * **O filtro ganha da visibilidade**, e é a decisão nº 1 do `respostas.md`: quem chega por URL filtrada e
 * recebe zero lê *"Nenhuma ocorrência com estes filtros"* **mesmo sendo Solicitante e mesmo sem barra na
 * tela**. Dizer-lhe *"você ainda não registrou nenhuma"* é literalmente a mentira que o critério proíbe.
 *
 * **Nesta fatia `algumFiltroAplicado` é sempre `false`** — não há filtro até o item 15, que é quem torna o
 * terceiro ramo alcançável e quem acrescenta o subtítulo com os valores e o *"Limpar filtros"* (critério
 * 15.6). O ramo existe aqui, testado, para que o 15 **reuse** em vez de escrever a segunda cópia.
 */
export type TipoDeVazio = "organizacao" | "solicitante" | "filtro";

export function vazioDaLista(
  visibilidadeAplicada: VisibilidadeAplicada,
  algumFiltroAplicado: boolean,
): TipoDeVazio {
  if (algumFiltroAplicado) return "filtro";
  return visibilidadeAplicada === "todas" ? "organizacao" : "solicitante";
}

/**
 * As três frases, literais do `inventario-de-telas.md` (T-03) e do protótipo.
 *
 * **`corpo` do vazio de filtro é `null` de propósito:** o subtítulo é *"Nenhuma pausada com prioridade
 * alta em Recanto Azul"*, montado com os **valores aplicados** — e quem os tem é o item 15.
 */
export const TEXTO_DO_VAZIO: Readonly<Record<TipoDeVazio, { titulo: string; corpo: string | null }>> = {
  organizacao: {
    titulo: "Nenhuma ocorrência ainda.",
    corpo:
      "A organização foi criada com áreas genéricas. Confira se elas descrevem o seu prédio — é a lista " +
      "que o Solicitante vê na hora de registrar.",
  },
  solicitante: {
    titulo: "Você ainda não registrou nenhuma ocorrência.",
    corpo: "Quando registrar, ela aparece aqui com o andamento.",
  },
  filtro: {
    titulo: "Nenhuma ocorrência com estes filtros.",
    corpo: null,
  },
};
