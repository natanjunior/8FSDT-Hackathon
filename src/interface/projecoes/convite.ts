import type { ConviteLido } from "@/aplicacao/organizacao";

/**
 * O corpo de `GET /convites/{codigo}`. **Copia campo a campo**, e não espalha o objeto: o que sai para
 * quem não tem conta é decidido aqui, uma chave por vez (critério 86.2).
 */
export type ConviteProjetado = {
  organizacao: { nome: string; codigoPublico: string };
  situacao: ConviteLido["situacao"];
};

export function projetarConvite(lido: ConviteLido): ConviteProjetado {
  return {
    organizacao: { nome: lido.organizacao.nome, codigoPublico: lido.organizacao.codigoPublico },
    situacao: lido.situacao,
  };
}
