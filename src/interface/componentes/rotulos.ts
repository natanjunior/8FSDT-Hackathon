import type { Prioridade } from "@/dominio/ocorrencia";

/**
 * A prioridade **em palavra**, que é o compromisso **A-5**: *"`prioridade`, `status` e `motivoPausa`
 * sempre carregam a palavra. Marcador colorido sem texto é defeito, em qualquer tela."*
 *
 * **Mora num módulo, e não dentro da tela**, porque três telas a exibem: T-03 (aqui), T-05 (o bloco de
 * identidade) e a barra de filtros do item 15, cujo chip diz *"Prioridade: Alta"*. A terceira cópia é
 * sempre a que diverge.
 */
export function rotuloDePrioridade(prioridade: Prioridade): string {
  return { baixa: "Baixa", normal: "Normal", alta: "Alta" }[prioridade];
}
