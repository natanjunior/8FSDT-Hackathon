import { ConviteIndisponivel, VinculoNaoEncontrado } from "./erros";
import type {
  ConvitePessoalVivo,
  RepositorioEscopadoDeConvitesPessoais,
  RepositorioEscopadoDeVinculos,
} from "./portas";

/**
 * ============================================================================
 *  O convite pessoal — item 121
 * ============================================================================
 *
 * **O convite não cria vínculo.** Ele liga uma conta a um vínculo que o Gestor já aprovou ao cadastrar, e é
 * isso que torna legítimo o aceite direto e o token em claro.
 */

type ReposDoGestor = {
  vinculos: RepositorioEscopadoDeVinculos;
  convitesPessoais: RepositorioEscopadoDeConvitesPessoais;
};

/**
 * O lado do Gestor do convite pessoal. **A elegibilidade é decidida aqui**, e não no repositório:
 * Solicitante ou Gestor, vínculo ativo, sem conta. O vínculo vem de `porPessoa`, que só devolve vínculo
 * ativo desta organização, e por isso o revogado e o de outra organização dão o mesmo 404.
 */
async function conferirElegivel(vinculos: RepositorioEscopadoDeVinculos, pessoaId: string): Promise<void> {
  const vinculo = await vinculos.porPessoa(pessoaId);
  if (vinculo === null) throw new VinculoNaoEncontrado();
  if (vinculo.papel === "encarregado") throw new ConviteIndisponivel("encarregado");
  if (vinculo.temConta) throw new ConviteIndisponivel("ja-tem-conta");
}

/**
 * Devolve o convite vivo, ou cria um. O token é gerado na Infraestrutura e chega por parâmetro, para a
 * Aplicação não importar `node:crypto` e o teste passar um gerador fixo.
 */
export async function garantirConvitePessoal(
  repos: ReposDoGestor,
  pessoaId: string,
  porPessoaId: string,
  novoToken: () => string,
): Promise<ConvitePessoalVivo> {
  await conferirElegivel(repos.vinculos, pessoaId);
  return repos.convitesPessoais.garantir(pessoaId, novoToken(), porPessoaId);
}

/** *Gerar novo link*: o vivo é carimbado e outro nasce, no mesmo `COMMIT`. */
export async function renovarConvitePessoal(
  repos: ReposDoGestor,
  pessoaId: string,
  porPessoaId: string,
  novoToken: () => string,
): Promise<ConvitePessoalVivo> {
  await conferirElegivel(repos.vinculos, pessoaId);
  return repos.convitesPessoais.renovar(pessoaId, novoToken(), porPessoaId);
}
