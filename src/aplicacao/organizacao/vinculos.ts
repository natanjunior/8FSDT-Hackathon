import { AreaInvalida, PessoaComContaNaoEditavel, VinculoNaoEncontrado } from "./erros";
import type {
  DadosDaCorrecao,
  DadosDoCadastro,
  RepositorioEscopadoDeVinculos,
  VinculoLido,
} from "./portas";

/**
 * ============================================================================
 *  Os vínculos — item 9a, capacidade `NOSSO` (D27)
 * ============================================================================
 *
 * **A regra do vínculo primeiro, dos dois lados** (contrato §4.6): a leitura parte de `vinculos`, e a
 * escrita entra pelo vínculo — nunca por um endereço de `Pessoa`, que não existe e não deve existir.
 *
 * **A permissão não é conferida aqui.** `vinculo.gerir` é exigida na porta de entrada, por
 * `comContexto({ exige })`, que não compila sem a permissão declarada (contrato §4.5).
 *
 * **Nenhum desfecho vem de leitura prévia.** Os quatro são traduções de garantias do banco — a FK composta
 * da Área, o `where organizacao_id = $1` do escopo, o `where usuario_id is null` da guarda. É a doutrina
 * do item 8, e a razão é a mesma: uma leitura antes perde a corrida.
 */

/** A lista de T-08, e a lista de candidatos a responsável que o item 19 vai consumir (D21). */
export function listarVinculos(
  vinculos: RepositorioEscopadoDeVinculos,
): Promise<readonly VinculoLido[]> {
  return vinculos.ativos();
}

/**
 * Um vínculo desta organização, ou `null`.
 *
 * **Devolve `null` em vez de lançar `VinculoNaoEncontrado`**, e a diferença é de destino: quem consome é
 * a página de correção, e ela traduz a ausência em `notFound()`. `VinculoNaoEncontrado` é vocabulário de
 * resposta HTTP — a tela não emite `problem+json`.
 *
 * **Um vínculo de outra organização é inalcançável**, não escondido: o `where organizacao_id = $1` do
 * escopo já o tira da consulta, que é o que produz o `404` idêntico ao de inexistente da §6.3.
 */
export function verVinculo(
  vinculos: RepositorioEscopadoDeVinculos,
  pessoaId: string,
): Promise<VinculoLido | null> {
  return vinculos.porPessoa(pessoaId);
}

/**
 * O cadastro do Encarregado sem conta.
 *
 * **Sempre cria uma Pessoa nova, e não há como ser diferente:** não existe nesta função, nem na porta,
 * nada que procure Pessoa por nome ou por contato. Procurar exigiria consultar `pessoas` globalmente — a
 * consulta proibida —, e a resposta vazaria a existência de um cadastro em outra organização.
 */
export async function cadastrarVinculo(
  vinculos: RepositorioEscopadoDeVinculos,
  dados: DadosDoCadastro,
): Promise<VinculoLido> {
  // O nome vai para a trilha de auditoria, que é **imutável**: o que entrar com espaço de sobra fica
  // assim para sempre. O schema já recusa o vazio; aqui só se apara.
  const resultado = await vinculos.cadastrar({ ...dados, nome: dados.nome.trim() });

  switch (resultado.desfecho) {
    case "area-invalida":
      throw new AreaInvalida();
    case "cadastrado":
      return resultado.vinculo;
  }
}

/**
 * A correção dos dados de um vínculo.
 *
 * **A guarda de `PESSOA_COM_CONTA_NAO_EDITAVEL` é por campo, não por endpoint** (contrato §8.2): `nome`
 * pertence à `Pessoa`, que é global, e mudá-lo alteraria o cadastro daquela pessoa em todas as outras
 * organizações. `areaId` pertence ao `Vínculo`, é escopado, e o Gestor tem toda a legitimidade para dizer
 * em qual unidade a pessoa mora **aqui** — inclusive quando ela tem conta.
 */
export async function corrigirVinculo(
  vinculos: RepositorioEscopadoDeVinculos,
  dados: DadosDaCorrecao,
): Promise<VinculoLido> {
  const resultado = await vinculos.corrigir(
    dados.nome === undefined ? dados : { ...dados, nome: dados.nome.trim() },
  );

  switch (resultado.desfecho) {
    case "nao-encontrado":
      throw new VinculoNaoEncontrado();
    case "pessoa-com-conta":
      throw new PessoaComContaNaoEditavel();
    case "area-invalida":
      throw new AreaInvalida();
    case "corrigido":
      return resultado.vinculo;
  }
}
