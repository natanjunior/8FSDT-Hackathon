import { renovarConvitePessoal } from "@/aplicacao/organizacao";
import { comContexto, montarLinkDoConvitePessoal, novoTokenDeConvite, resposta } from "@/interface/http";
import { projetarConviteDoGestor } from "@/interface/projecoes";

/**
 * **`POST /vinculos/{pessoaId}/convite/renovacao`** — *Gerar novo link* (item 121). O convite vivo é
 * carimbado e outro nasce no mesmo `COMMIT`: o link anterior deixa de funcionar, inclusive onde já foi
 * enviado.
 */
export const POST = comContexto({ exige: "vinculo.gerir" }, async ({ repos, parametros, ctx }) => {
  const vivo = await renovarConvitePessoal(repos, parametros["pessoaId"] ?? "", ctx.pessoaId, novoTokenDeConvite);
  return resposta(projetarConviteDoGestor(vivo, await montarLinkDoConvitePessoal(vivo.token)), { status: 201 });
});

export const dynamic = "force-dynamic";
