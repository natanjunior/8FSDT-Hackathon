import { AREAS_SEMENTE, CATEGORIAS_SEMENTE, gerarCodigoPublico } from "@/dominio/organizacao";

import { CodigoPublicoEmUso } from "./erros";
import type { OrganizacaoCriada, RepositorioDeOrganizacoes } from "./portas";

/**
 * ============================================================================
 *  A POL-01 — *"ao registrar a Organização, semear categorias e áreas"*
 * ============================================================================
 *
 * É o **bootstrap da D26**: quem cria vira o Gestor inicial, porque o primeiro Gestor não tem quem o
 * aprove. Roda **sem organização ativa** — é uma das cinco operações da lista fechada (contrato §4.4) —,
 * e **também não a recusa**: um Gestor de A pode fundar B, e a nova fica ativa pelo `Set-Cookie` da
 * própria resposta.
 *
 * O que esta função decide, e é tudo o que ela decide: **sortear o código, mandar a semente do domínio
 * junto, e repetir o sorteio na colisão.** As quatro escritas acontecerem juntas é promessa da porta.
 */

/**
 * Cinco.
 *
 * Com 32⁸ códigos e a escala do RNF3 — cinquenta organizações —, a chance de uma colisão já é
 * desprezível, e a de cinco seguidas não é um número que valha escrever. O laço existe pela corrida entre
 * duas criações simultâneas, não pela probabilidade; o teto existe para que um banco em estado
 * inesperado **falhe alto** em vez de girar para sempre.
 */
const TENTATIVAS_DE_CODIGO = 5;

export async function criarOrganizacao(
  organizacoes: RepositorioDeOrganizacoes,
  entrada: { nome: string; criadaPorPessoaId: string },
): Promise<OrganizacaoCriada> {
  for (let tentativa = 1; tentativa <= TENTATIVAS_DE_CODIGO; tentativa += 1) {
    try {
      return await organizacoes.criar({
        nome: entrada.nome,
        // Sorteado a cada volta: repetir o mesmo código colidiria de novo, e o laço nunca terminaria.
        codigoPublico: gerarCodigoPublico(),
        criadaPorPessoaId: entrada.criadaPorPessoaId,
        categorias: CATEGORIAS_SEMENTE,
        areas: AREAS_SEMENTE,
      });
    } catch (erro) {
      // Só a colisão é retentável. Qualquer outro erro sobe na primeira vez — repetir uma falha de
      // conexão cinco vezes atrasa a resposta e não conserta nada.
      const ultima = tentativa === TENTATIVAS_DE_CODIGO;
      if (!(erro instanceof CodigoPublicoEmUso) || ultima) throw erro;
    }
  }

  // Inalcançável: o laço ou devolve, ou lança na última volta. O `throw` existe porque o compilador não
  // consegue ver isso, e devolver algo aqui esconderia o dia em que a condição acima mudar.
  throw new Error("criarOrganizacao saiu do laço de tentativas sem devolver nem lançar.");
}
