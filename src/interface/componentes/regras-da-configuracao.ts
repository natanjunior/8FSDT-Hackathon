/**
 * ============================================================================
 *  As regras da organização, na tela — item 99
 * ============================================================================
 *
 * **Funções e textos puros, com teste**, pela regra do item 20: decisão de texto de produto não mora num
 * `?:` dentro do JSX. Servem o modal de resolver e a tela de configuração.
 *
 * **A frase da solução obrigatória é a do `detail` do `422`**, e o teste prende as duas juntas: são o
 * mesmo aviso dito pelo cliente e pelo servidor.
 *
 * **Os tipos são declarados aqui**, e não importados de `@/aplicacao`: a camada de Interface que roda no
 * navegador não atravessa a fronteira (ADR-0006).
 */

export type ChaveDaTela = "exigir_solucao_ao_resolver" | "limite_cancelamento_solicitante";

export type Regras = {
  exigirSolucaoAoResolver: boolean;
  limiteDeCancelamentoDoSolicitante: "em_analise" | "em_atendimento";
};

export const MENSAGEM_DA_SOLUCAO_OBRIGATORIA = "Esta organização exige a solução aplicada para resolver.";

/** O erro do campo de solução no modal de resolver: só existe com a regra ligada. */
export function erroDaSolucaoObrigatoria(solucao: string, exige: boolean): string | undefined {
  return exige && solucao.trim() === "" ? MENSAGEM_DA_SOLUCAO_OBRIGATORIA : undefined;
}

export const ROTULO_DA_REGRA: Readonly<Record<ChaveDaTela, string>> = {
  exigir_solucao_ao_resolver: "Exigir a solução ao resolver",
  limite_cancelamento_solicitante: "O Solicitante pode cancelar também em atendimento",
};

/** O apoio do segundo interruptor: a resposta P1 da spec, dita a quem liga. */
export const APOIO_DO_LIMITE = "Inclui as ocorrências pausadas.";

/** Salvar sem mudar acende esta frase, pela regra do critério 44g.9 (`regras-do-nome.ts`). */
export const REGRAS_SEM_MUDANCA = "Altere uma regra antes de salvar.";

export const SEM_MUDANCAS = "Nenhuma regra foi alterada desde a criação da organização.";

export const TITULO_DAS_REGRAS = "Regras do atendimento";
export const DESCRICAO_DAS_REGRAS = "O que muda no caminho de cada ocorrência desta organização.";
export const APOIO_DO_CARTAO_DE_REGRAS = "O que muda no caminho de cada ocorrência.";
export const TITULO_DAS_MUDANCAS = "Mudanças de configuração";

/** **Sim é o valor que liga**: `true`, ou o limite estendido. A tela nunca mostra o valor cru. */
export function valorEmPalavra(chave: ChaveDaTela, valor: string): "Sim" | "Não" {
  const liga = chave === "exigir_solucao_ao_resolver" ? "true" : "em_atendimento";
  return valor === liga ? "Sim" : "Não";
}

export function fraseDaMudanca(m: {
  chave: ChaveDaTela;
  valorAnterior: string;
  valorNovo: string;
}): string {
  return `${ROTULO_DA_REGRA[m.chave]}: de ${valorEmPalavra(m.chave, m.valorAnterior)} para ${valorEmPalavra(
    m.chave,
    m.valorNovo,
  )}`;
}

/** **Só o que mudou vai no corpo.** Nada mudou é objeto vazio, e o modal acende `REGRAS_SEM_MUDANCA`. */
export function regrasQueMudaram(atuais: Regras, escolhidas: Regras): Partial<Regras> {
  return {
    ...(escolhidas.exigirSolucaoAoResolver === atuais.exigirSolucaoAoResolver
      ? {}
      : { exigirSolucaoAoResolver: escolhidas.exigirSolucaoAoResolver }),
    ...(escolhidas.limiteDeCancelamentoDoSolicitante === atuais.limiteDeCancelamentoDoSolicitante
      ? {}
      : { limiteDeCancelamentoDoSolicitante: escolhidas.limiteDeCancelamentoDoSolicitante }),
  };
}
