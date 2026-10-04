import { EtiquetaNaoEncontrada, VinculoNaoEncontrado } from "./erros";
import type { EtiquetaLida, RepositorioEscopadoDeEtiquetas } from "./portas";

/**
 * ============================================================================
 *  As etiquetas dos participantes — item 115
 * ============================================================================
 *
 * **A permissão não é conferida aqui.** `vinculo.gerir` é exigida na porta de entrada, por
 * `comContexto({ exige })`, em toda rota — a mesma doutrina de `vinculos.ts`.
 *
 * **Nenhum desfecho vem de leitura prévia**: os desfechos são do banco, e aqui só se traduzem.
 */

/**
 * A lista da organização, inclusive as sem uso: é o que a seleção múltipla do detalhe sugere e o que o
 * cartão da configuração lista.
 */
export function listarEtiquetas(etiquetas: RepositorioEscopadoDeEtiquetas): Promise<readonly EtiquetaLida[]> {
  return etiquetas.listar();
}

/**
 * Cria sem atribuir, ou reaproveita (item 120). **Não há recusa de domínio**: a forma do nome é da rota,
 * e a unicidade é do banco, que reaproveita em vez de recusar.
 */
export function criarEtiqueta(
  etiquetas: RepositorioEscopadoDeEtiquetas,
  nome: string,
): Promise<{ etiqueta: EtiquetaLida; criada: boolean }> {
  return etiquetas.criar(nome);
}

/**
 * Cria ou reaproveita, e atribui. **Atribuir de novo é sucesso**, e `jaTinha` é o que deixa a rota
 * responder `200` em vez de `201`.
 */
export async function atribuirEtiqueta(
  etiquetas: RepositorioEscopadoDeEtiquetas,
  dados: { pessoaId: string; nome: string; porPessoaId: string },
): Promise<{ etiqueta: EtiquetaLida; criada: boolean; jaTinha: boolean }> {
  const resultado = await etiquetas.atribuir(dados);
  switch (resultado.desfecho) {
    case "nao-encontrado":
      throw new VinculoNaoEncontrado();
    case "ja-tinha":
      return { etiqueta: resultado.etiqueta, criada: false, jaTinha: true };
    case "atribuida":
      return { etiqueta: resultado.etiqueta, criada: resultado.criada, jaTinha: false };
  }
}

export async function tirarEtiqueta(
  etiquetas: RepositorioEscopadoDeEtiquetas,
  dados: { pessoaId: string; etiquetaId: string },
): Promise<void> {
  const resultado = await etiquetas.tirar(dados);
  switch (resultado.desfecho) {
    case "vinculo-nao-encontrado":
      throw new VinculoNaoEncontrado();
    case "etiqueta-nao-encontrada":
      throw new EtiquetaNaoEncontrada();
    case "tirada":
      return;
  }
}

export async function apagarEtiqueta(etiquetas: RepositorioEscopadoDeEtiquetas, etiquetaId: string): Promise<void> {
  const resultado = await etiquetas.apagar(etiquetaId);
  if (resultado.desfecho === "nao-encontrada") throw new EtiquetaNaoEncontrada();
}
