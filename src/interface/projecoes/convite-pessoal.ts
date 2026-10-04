import type { ConvitePessoalVivo } from "@/aplicacao/organizacao";

/** O que o modal recebe. **O token só sai dentro do link**, e só para quem tem `vinculo.gerir`. */
export type ConviteDoGestorProjetado = { link: string; criadoEm: string; criadoPor: { nome: string } };

export function projetarConviteDoGestor(vivo: ConvitePessoalVivo, link: string): ConviteDoGestorProjetado {
  return { link, criadoEm: vivo.criadoEm, criadoPor: { nome: vivo.criadoPor.nome } };
}
