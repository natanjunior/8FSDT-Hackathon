import {
  ehChaveDeRotulo,
  fraseDaMudancaDeRotulo,
  type ChaveDeRotulo,
} from "./rotulos-do-solicitante";

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

/**
 * **As chaves de regra**, que são as três colunas de `organizacoes`. As seis chaves de texto de quem
 * abriu moram em `rotulos-do-solicitante.ts`, e `ChaveDaTrilha` é a soma das duas metades: elas dividem
 * a mesma pilha na tela e não dividem a forma do valor.
 */
export type ChaveDaTela =
  | "exigir_solucao_ao_resolver"
  | "limite_cancelamento_solicitante"
  | "dias_para_parada";

export type ChaveDaTrilha = ChaveDaTela | ChaveDeRotulo;

export type Regras = {
  exigirSolucaoAoResolver: boolean;
  limiteDeCancelamentoDoSolicitante: "em_analise" | "em_atendimento";
  /** De 1 a 90, padrão 7 (item 101). */
  diasParaParada: number;
};

export const MENSAGEM_DA_SOLUCAO_OBRIGATORIA = "Esta organização exige a solução aplicada para resolver.";

/** O erro do campo de solução no modal de resolver: só existe com a regra ligada. */
export function erroDaSolucaoObrigatoria(solucao: string, exige: boolean): string | undefined {
  return exige && solucao.trim() === "" ? MENSAGEM_DA_SOLUCAO_OBRIGATORIA : undefined;
}

export const ROTULO_DA_REGRA: Readonly<Record<ChaveDaTela, string>> = {
  exigir_solucao_ao_resolver: "Exigir a solução aplicada ao resolver",
  limite_cancelamento_solicitante: "O Solicitante pode cancelar também em atendimento",
  dias_para_parada: "Dias até contar como parada",
};

/**
 * **O rótulo do campo em T-15, e ele é uma frase** — item 101. Ali o rótulo explica a regra a quem vai
 * mudá-la; na linha do histórico e no cartão, ao lado de outras duas, a frase inteira empurraria os
 * valores para fora da coluna, e por isso os dois usam o rótulo curto de `ROTULO_DA_REGRA`.
 */
export const ROTULO_DO_CAMPO_DE_DIAS = "Dias sem atividade até a ocorrência contar como parada";

/** O apoio do campo, e é onde a tela diz que pausada não entra (item 101). */
export const APOIO_DOS_DIAS = "De 1 a 90. Pausadas não contam.";

/** A recusa do campo, antes de qualquer ida ao servidor (item 101). */
export const DIAS_FORA_DA_FAIXA = "Use um número de 1 a 90.";

/** O apoio do segundo interruptor: a resposta P1 da spec, dita a quem liga. */
export const APOIO_DO_LIMITE = "Inclui as ocorrências pausadas.";

/** Salvar sem mudar acende esta frase, pela regra do critério 44g.9 (`regras-do-nome.ts`). */
export const REGRAS_SEM_MUDANCA = "Altere uma regra antes de salvar.";

export const SEM_MUDANCAS = "Nenhuma regra foi alterada desde a criação da organização.";

export const TITULO_DAS_REGRAS = "Regras do atendimento";
export const DESCRICAO_DAS_REGRAS = "O que muda no caminho de cada ocorrência desta organização.";
export const APOIO_DO_CARTAO_DE_REGRAS = "O que muda no caminho de cada ocorrência.";
export const TITULO_DAS_MUDANCAS = "Mudanças de configuração";

/**
 * **Sim é o valor que liga**: `true`, ou o limite estendido. A tela nunca mostra o valor cru.
 *
 * **A unidade vai junto nos dias** (item 101): o cartão escreve *"7 dias"* e a trilha escreve *"de 7
 * dias para 15 dias"*. Num histórico em que as outras linhas dizem *Sim* e *Não*, um número nu seria a
 * única linha sem unidade.
 */
export function valorEmPalavra(chave: ChaveDaTela, valor: string): string {
  if (chave === "dias_para_parada") return `${valor} ${valor === "1" ? "dia" : "dias"}`;
  const liga = chave === "exigir_solucao_ao_resolver" ? "true" : "em_atendimento";
  return valor === liga ? "Sim" : "Não";
}

/**
 * **O que o campo de dias aceita** — item 101, o cenário *"dias fora da faixa"*.
 *
 * `null` é *"não envie"*, e a tela acende `DIAS_FORA_DA_FAIXA` no campo. A faixa é a mesma do schema da
 * borda e a mesma do `check` do banco; as três existem porque cada uma protege de um lado diferente, e a
 * daqui é a que evita a ida ao servidor.
 */
export function diasValidos(bruto: string): number | null {
  if (!/^\d+$/u.test(bruto.trim())) return null;
  const dias = Number(bruto.trim());
  return dias >= 1 && dias <= 90 ? dias : null;
}

/**
 * A linha da pilha de *Mudanças de configuração*, qualquer que seja a chave.
 *
 * **As duas metades moram separadas** (item 100): a regra tem valor em palavra — *Sim* e *Não* —, e o
 * texto de quem abre tem texto livre, que aparece entre aspas curvas. Quem escreve a frase do texto é
 * `fraseDaMudancaDeRotulo`, ao lado dos outros textos do cartão dele.
 */
export function fraseDaMudanca(m: {
  chave: ChaveDaTrilha;
  valorAnterior: string;
  valorNovo: string;
}): string {
  if (ehChaveDeRotulo(m.chave)) {
    return fraseDaMudancaDeRotulo({ ...m, chave: m.chave });
  }
  const chave = m.chave;
  return `${ROTULO_DA_REGRA[chave]}: de ${valorEmPalavra(chave, m.valorAnterior)} para ${valorEmPalavra(
    chave,
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
    ...(escolhidas.diasParaParada === atuais.diasParaParada
      ? {}
      : { diasParaParada: escolhidas.diasParaParada }),
  };
}
