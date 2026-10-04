import type {
  ConvitePessoalLido,
  ConvitePessoalVivo,
  SituacaoDoConvitePessoal,
} from "@/aplicacao/organizacao";
import type { Papel } from "@/dominio/organizacao";

/** O que o modal recebe. **O token só sai dentro do link**, e só para quem tem `vinculo.gerir`. */
export type ConviteDoGestorProjetado = { link: string; criadoEm: string; criadoPor: { nome: string } };

export function projetarConviteDoGestor(vivo: ConvitePessoalVivo, link: string): ConviteDoGestorProjetado {
  return { link, criadoEm: vivo.criadoEm, criadoPor: { nome: vivo.criadoPor.nome } };
}

/**
 * O corpo de `GET /convites-pessoais/{token}`. **`nao-vale` vai sozinho**, sem nome nenhum: nada revela se
 * o token existiu nem de que organização era.
 */
export type ConvitePessoalProjetado =
  | { situacao: "nao-vale" }
  | { situacao: SituacaoDoConvitePessoal; pessoa: { nome: string }; organizacao: { nome: string }; papel: Papel };

export function projetarConvitePessoal(lido: ConvitePessoalLido | null): ConvitePessoalProjetado {
  if (lido === null) return { situacao: "nao-vale" };
  return {
    situacao: lido.situacao,
    pessoa: { nome: lido.pessoa.nome },
    organizacao: { nome: lido.organizacao.nome },
    papel: lido.papel,
  };
}
