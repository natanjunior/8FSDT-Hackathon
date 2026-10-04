import { CodigoPublicoNaoEncontrado } from "./erros";
import type { OrganizacaoDoConvite, RepositorioDeConvites } from "./portas";

/**
 * **Ler um convite** — o modelo de leitura de `GET /convites/{codigo}` e da página `/convite/{codigo}`
 * (item 86).
 *
 * **A situação é decidida aqui, e não na tela**, para que a API e a página digam a mesma coisa. A ordem
 * é a ordem das perguntas: o código leva a algum lugar? há sessão? já participa? já pediu?
 *
 * **O revogado não tem situação própria.** `codigosComVinculoAtivo` só traz vínculo ativo
 * (`vinculos-globais.ts`), então quem teve o vínculo revogado cai em `pode-pedir`, como qualquer pessoa.
 * A página não sabe da revogação, e por isso não pode falar dela.
 */
export type SituacaoDoConvite = "sem-sessao" | "pode-pedir" | "ja-participa" | "pedido-pendente";

export type ConviteLido = { organizacao: OrganizacaoDoConvite; situacao: SituacaoDoConvite };

/** Quem abre o convite, quando há sessão. O anel externo o tira da resolução de contexto, sem consulta. */
export type QuemAbreOConvite = {
  pessoaId: string;
  /** Os `codigoPublico` das organizações em que a Pessoa tem vínculo **ativo**. */
  codigosComVinculoAtivo: readonly string[];
  /** Os `id` das mesmas organizações: o convite pessoal (item 121) conhece a organização pelo `id`. */
  organizacoesComVinculoAtivo: readonly string[];
};

export async function lerConvite(
  portas: { convites: RepositorioDeConvites },
  quem: QuemAbreOConvite | null,
  codigoPublico: string,
): Promise<ConviteLido> {
  const organizacao = await portas.convites.porCodigo(codigoPublico);
  // **Um desfecho só** para código nunca sorteado e organização apagada (critério 86.3).
  if (organizacao === null) throw new CodigoPublicoNaoEncontrado();

  if (quem === null) return { organizacao, situacao: "sem-sessao" };
  if (quem.codigosComVinculoAtivo.includes(organizacao.codigoPublico)) {
    return { organizacao, situacao: "ja-participa" };
  }
  if (await portas.convites.temPedidoPendente(quem.pessoaId, organizacao.codigoPublico)) {
    return { organizacao, situacao: "pedido-pendente" };
  }
  return { organizacao, situacao: "pode-pedir" };
}
