import { garantirConvitePessoal } from "@/aplicacao/organizacao";
import { comContexto, montarLinkDoConvitePessoal, novoTokenDeConvite } from "@/interface/http";
import { projetarConviteDoGestor } from "@/interface/projecoes";

/**
 * **`POST /vinculos/{pessoaId}/convite`** — garante o convite pessoal (item 121). `POST` porque pode criar;
 * idempotente, porque abrir o modal de novo devolve o mesmo link.
 */
export const POST = comContexto({ exige: "vinculo.gerir" }, async ({ repos, parametros, ctx }) => {
  const vivo = await garantirConvitePessoal(repos, parametros["pessoaId"] ?? "", ctx.pessoaId, novoTokenDeConvite);
  return projetarConviteDoGestor(vivo, await montarLinkDoConvitePessoal(vivo.token));
});

export const dynamic = "force-dynamic";
