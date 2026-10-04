import { enviarConvitesPorEmail } from "@/aplicacao/organizacao";
import {
  comContexto,
  linkDoConvitePessoal,
  montarCarteiro,
  novoTokenDeConvite,
  origemDoPedido,
} from "@/interface/http";
import { projetarResumoDoEnvio } from "@/interface/projecoes";
import { envioDeConvitesSchema } from "@/interface/schemas";

/**
 * **`POST /convites-pessoais/envios`** — envia o convite pessoal por e-mail, a um ou a até vinte
 * participantes (item 122). Responde `200` com o resumo **mesmo quando nenhum saiu**: a requisição deu
 * certo, o que falhou foi cada envio, e o resumo diz qual.
 *
 * **Não fica sob `/convites`**: lá mora o Convite da organização. E não é o `[token]` vizinho, que roda sem
 * sessão: este exige sessão, organização ativa e `vinculo.gerir`. No App Router o segmento estático vence o
 * dinâmico, então `envios` nunca cai no `[token]`.
 *
 * **Não há fila**, então o envio acontece dentro desta requisição, um depois do outro, e o lote tem teto
 * (ADR-0022).
 */
export const POST = comContexto(
  { exige: "vinculo.gerir", corpo: envioDeConvitesSchema },
  async ({ repos, ctx, corpo, organizacao, requisicao }) => {
    // Uma resolução de origem por requisição, antes do laço.
    const origem = origemDoPedido(requisicao.headers);
    const resumo = await enviarConvitesPorEmail(repos, montarCarteiro(), {
      pessoaIds: corpo.pessoaIds,
      porPessoa: { pessoaId: ctx.pessoaId, nome: ctx.nome },
      organizacao,
      novoToken: novoTokenDeConvite,
      montarLink: (token) => linkDoConvitePessoal(origem, token),
    });
    return projetarResumoDoEnvio(resumo);
  },
);

export const dynamic = "force-dynamic";
