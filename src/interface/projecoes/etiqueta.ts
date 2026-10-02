import type { EtiquetaLida } from "@/aplicacao/organizacao";

/** O schema `EtiquetaDeParticipante` (item 115): `id` e `nome`, e mais nada. */
export type EtiquetaProjetada = { id: string; nome: string };

export function projetarEtiqueta(etiqueta: EtiquetaLida): EtiquetaProjetada {
  return { id: etiqueta.id, nome: etiqueta.nome };
}
