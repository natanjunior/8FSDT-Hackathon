import { aceitarConvitePessoal, ConvitePessoalNaoVale } from "@/aplicacao/organizacao";
import { FORMATO_DO_TOKEN, semOrganizacao } from "@/interface/http";

/**
 * **`POST /convites-pessoais/{token}/aceite`** — o aceite com conta (item 121).
 *
 * **Sem organização ativa**: a conta pode não ter vínculo nenhum. É a sétima operação da lista do §4.4 e a
 * sexta rota de `ROTAS_SEM_ORGANIZACAO`, pelo critério que a ADR-0021 amplia: escreve pela chave da sessão
 * e pelo token apresentado. A fusão da Pessoa cadastrada na Pessoa da conta acontece numa transação, e a
 * organização do convite vira a ativa da sessão.
 */
export const POST = semOrganizacao(async ({ ctx, portasGlobais, parametros, definirOrganizacaoAtiva }) => {
  const token = parametros["token"] ?? "";
  if (!FORMATO_DO_TOKEN.test(token)) throw new ConvitePessoalNaoVale();
  const { organizacaoId } = await aceitarConvitePessoal(portasGlobais, ctx.pessoaId, token);
  definirOrganizacaoAtiva(organizacaoId);
  return { organizacaoId };
});

export const dynamic = "force-dynamic";
