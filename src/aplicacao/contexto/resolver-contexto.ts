import type { PedidoDaPessoa } from "@/aplicacao/organizacao";
import type { Vinculo } from "@/dominio/organizacao";

import { NaoAutenticado } from "./erros";
import type {
  EscolhaDaSessao,
  PessoaReferencia,
  PortasGlobais,
  VinculoNaOrganizacao,
} from "./portas";

/**
 * ============================================================================
 *  O ponto único de estrangulamento da ADR-0003
 * ============================================================================
 *
 * **É o único lugar do sistema que descobre em qual organização se está operando.** Roda uma vez por
 * requisição, lê o usuário autenticado, garante a Pessoa e monta o contexto.
 *
 * Ele é **três coisas de uma vez**, e é por isso que é o primeiro endpoint da implementação:
 *
 * 1. **O ACL** entre o provedor de autenticação e o núcleo (arquitetura.md, Parte I §3): é aqui, e só
 *    aqui, que `auth.users.id` vira `pessoas.id`, criando a `Pessoa` se ainda não existir — a resolução
 *    idempotente da §9.2 do modelo de dados.
 * 2. **O ponto único de resolução de escopo** (ADR-0003, ponto 1).
 * 3. **A consulta que parte de `vinculos`**, nunca de `pessoas` (contrato §4.6).
 *
 * Mora na camada de **Aplicação** e não na de Interface porque resolver o contexto exige consultar
 * `vinculos` — e a tabela de camadas proíbe a Interface de tocar o banco. É a correção de redação de
 * 20/08/2026 na ADR-0003.
 */

// ---------------------------------------------------------------------------

/** O que se sabe de quem está falando, antes de haver organização. */
export type ContextoDaSessao = {
  usuarioId: string;
  pessoaId: string;
  nome: string;
  /**
   * **O e-mail da conta, e ele existe para três leituras da própria pessoa**: T-16 (item 49), o menu de
   * pessoa da casca (item 44i) e o campo preenchido de T-12 (item 106). `null` quando o provedor não o devolve. **Nenhuma projeção o publica** —
   * ver `SessaoDoProvedor`.
   */
  email: string | null;
};

/**
 * O contexto completo: `{ usuarioId, pessoaId, organizacaoId, papel }` da ADR-0003, com `organizacaoId` e
 * `papel` dentro do agregado `Vinculo` — que é o que responde `pode(permissao)` (contrato §4.5).
 */
export type ContextoDaRequisicao = ContextoDaSessao & {
  vinculo: Vinculo;
};

/**
 * O resultado da resolução. Guarda o que a projeção de `GET /contexto` precisa **e** o que o anel externo
 * precisa para decidir sobre o cookie — sem que nenhum dos dois refaça a consulta.
 */
export type ResolucaoDeContexto = {
  sessao: ContextoDaSessao;
  /** `null` quando a Pessoa não tem vínculo, ou tem dois ou mais e não escolheu (contrato §4.3). */
  ativo: VinculoNaOrganizacao | null;
  /** Todos os vínculos ativos da Pessoa — o insumo do seletor de organização. */
  vinculos: readonly VinculoNaOrganizacao[];
  /**
   * Todos os pedidos de entrada da Pessoa, em `criadoEm` decrescente e **nas três situações** — o insumo
   * das faces B e C de T-02 (contrato, schema `Contexto`).
   *
   * **Nesta fatia só existe `pendente`**, porque `aprovado` e `recusado` são produzidos pelo item 8. É
   * forma correta esperando produtor, não código morto: quando aquele item entrar, a face C é só tela.
   */
  pedidos: readonly PedidoDaPessoa[];
  /**
   * `true` quando **o servidor escolheu sozinho** porque havia exatamente um vínculo. É o sinal para o
   * anel externo gravar o cookie na própria resposta (contrato §4.3), e existe para que todo login não
   * custe um `PUT` antes de qualquer tela.
   */
  escolhidaAutomaticamente: boolean;
};

/**
 * O nome de uma Pessoa criada por conta cujo metadado não traz nome.
 *
 * > **Achado.** O contrato §4.1 diz que `pessoas.nome` *"vem dos metadados da conta, preenchidos no
 * > cadastro"*, e T-11 torna o campo obrigatório no nosso formulário. **Nenhum documento diz o que
 * > acontece quando o metadado não existe** — conta criada por outro fluxo do provedor, ou semeada. A
 * > coluna é `NOT NULL`, então é preciso um valor. Cair no trecho local do e-mail poria credencial na
 * > trilha imutável, contra o RNF10; recusar o login inutiliza a conta e não há código para isso na §6.4.
 * > Fica este literal, e quem cair nele conserta o nome em **T-16 · Meus dados**, sem prazo
 * > (`PATCH /contexto/pessoa`, item 49).
 */
export const NOME_AUSENTE = "Sem nome";

/**
 * Resolve a sessão em contexto.
 *
 * @param portas   as portas globais, **recebidas** do anel externo — nunca fabricadas aqui (ADR-0005;
 *                 emenda de 21/08/2026 à ADR-0003).
 * @param escolha  de onde vem a organização que a sessão já escolheu. `null` no primeiro acesso.
 *
 * @throws NaoAutenticado quando não há sessão.
 */
export async function resolverContexto(
  portas: PortasGlobais,
  escolha: EscolhaDaSessao,
): Promise<ResolucaoDeContexto> {
  const sessaoDoProvedor = await portas.autenticacao.sessaoAtual();
  if (sessaoDoProvedor === null) throw new NaoAutenticado();

  const pessoa = await garantirPessoa(portas, sessaoDoProvedor.usuarioId, sessaoDoProvedor.nomeSugerido);

  const sessao: ContextoDaSessao = {
    usuarioId: sessaoDoProvedor.usuarioId,
    pessoaId: pessoa.pessoaId,
    nome: pessoa.nome,
    email: sessaoDoProvedor.email,
  };

  // **Em paralelo, e é o que torna a leitura nova barata:** duas consultas independentes numa ida só. Em
  // série, `GET /contexto` — que roda em toda requisição — pagaria uma latência de rede a mais.
  const [vinculos, pedidos] = await Promise.all([
    portas.vinculos.ativosDaPessoa(pessoa.pessoaId),
    portas.pedidosDeEntrada.daPessoa(pessoa.pessoaId),
  ]);

  const pedida = escolha.organizacaoEscolhida(sessao.usuarioId);

  return { sessao, vinculos, pedidos, ...escolherAtivo(vinculos, pedida) };
}

/**
 * Constrói o contexto completo a partir de uma resolução que **tem** organização ativa.
 *
 * Separado de `resolverContexto` porque as cinco operações da §4.4 rodam com a resolução sem organização,
 * e os outros 36 exigem esta. É o anel externo que escolhe qual das duas exige.
 */
export function contextoDaRequisicao(
  resolucao: ResolucaoDeContexto,
  ativo: VinculoNaOrganizacao,
): ContextoDaRequisicao {
  return { ...resolucao.sessao, vinculo: ativo.vinculo };
}

// ---------------------------------------------------------------------------

async function garantirPessoa(
  portas: PortasGlobais,
  usuarioId: string,
  nomeSugerido: string | null,
): Promise<PessoaReferencia> {
  const existente = await portas.pessoas.porUsuario(usuarioId);
  if (existente !== null) return existente;

  const nome = (nomeSugerido ?? "").trim();
  return portas.pessoas.garantirParaUsuario(usuarioId, nome === "" ? NOME_AUSENTE : nome);
}

/**
 * **A regra do estado inicial** (contrato §4.3, acrescentada em 20/08/2026):
 *
 * > Se a Pessoa tem **exatamente um** vínculo ativo, o servidor escolhe esse e grava o cookie na própria
 * > resposta. Se tem **dois ou mais**, `organizacaoAtiva` vem `null` e o cliente precisa chamar o `PUT`.
 * > Se tem **zero**, vem `null` e não há o que escolher.
 *
 * A escolha automática não afrouxa nada: só existe vínculo porque um Gestor o criou, e o `PUT` validaria a
 * mesma coisa que já se sabe aqui. E um cookie que aponte para vínculo **revogado** cai nesta mesma
 * regra — a organização pedida simplesmente não está na lista, e o caminho segue como se não houvesse
 * cookie.
 */
function escolherAtivo(
  vinculos: readonly VinculoNaOrganizacao[],
  organizacaoPedida: string | null,
): { ativo: VinculoNaOrganizacao | null; escolhidaAutomaticamente: boolean } {
  if (organizacaoPedida !== null) {
    const pedido = vinculos.find((v) => v.organizacao.id === organizacaoPedida);
    if (pedido !== undefined) return { ativo: pedido, escolhidaAutomaticamente: false };
  }

  const unico = vinculos.length === 1 ? vinculos[0] : undefined;
  if (unico !== undefined) return { ativo: unico, escolhidaAutomaticamente: true };

  return { ativo: null, escolhidaAutomaticamente: false };
}
