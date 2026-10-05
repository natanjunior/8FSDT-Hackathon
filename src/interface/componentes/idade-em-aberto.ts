/**
 * ============================================================================
 *  O quadro 2 de T-07 — a idade do que está em aberto, em palavra
 * ============================================================================
 *
 * **Os limites chegam na faixa, e não por import.** A resposta publica `deDias` e `ateDias` em número —
 * é o que o critério 59.10 comprou: trocar os limites é uma linha em `LIMITES_DAS_FAIXAS_DE_IDADE`, sem
 * renomear `enum`, sem reescrever tabela de rótulo e sem refazer teste de projeção. Ler o mesmo número de
 * uma segunda fonte poria duas verdades numa frase só, e a frase estaria errada justamente quando elas
 * discordassem — o caso normal durante um deploy.
 *
 * **Ele mora aqui, e não no `.tsx` que desenha**, pela razão dos itens 57 e 58: derivação dentro de um
 * componente é derivação que nenhum teste do laço curto alcança.
 *
 * **Nada de cor, de peso nem de ícone.** A faixa mais velha se distingue **por palavra** (critério 59.5),
 * numa oração do veredito que entra quando há alguém nela e sai quando não há. Desde o item 73 a oração
 * mora no veredito, no topo do quadro, e não mais no rodapé.
 */

/** O que a linha precisa saber da faixa. É a forma de `DashboardProjetado.abertasPorIdade[]`. */
export type FaixaDeIdadeNaTela = { deDias: number; ateDias: number | null; quantidade: number };

export const dias = (quantos: number): string =>
  `${String(quantos)} ${quantos === 1 ? "dia" : "dias"}`;

/**
 * `Até 7 dias` · `8 a 30 dias` · `31 a 90 dias` · `Mais de 90 dias`.
 *
 * **A faixa sem teto diz o limite dela, e não o começo:** ela abre em 91 e o que a define é o 90 que
 * ficou para trás. O singular existe porque os limites são de quem opera — um corte que comece em
 * `[1, …]` escreveria `Até 1 dias` sem ele.
 */
export function rotuloDaFaixaDeIdade(faixa: FaixaDeIdadeNaTela): string {
  if (faixa.ateDias === null) return `Mais de ${dias(faixa.deDias - 1)}`;
  if (faixa.deDias === 0) return `Até ${dias(faixa.ateDias)}`;
  return `${String(faixa.deDias)} a ${dias(faixa.ateDias)}`;
}

/** Quantas estão em aberto agora: a soma das faixas. É o número do cartão *Em aberto agora*. */
export function totalEmAberto(faixas: readonly FaixaDeIdadeNaTela[]): number {
  return faixas.reduce((soma, faixa) => soma + faixa.quantidade, 0);
}

/**
 * **O veredito conta acima do segundo limite**, e ganha a oração do último **só quando a faixa mais velha
 * tem alguém** — é o 59.5, a faixa mais velha distinguida por palavra.
 *
 * Os dois limites saem das faixas: o de 30 é o `ateDias` da segunda, e o de 90 é o começo da última menos
 * um. **Nenhum dos dois é escrito aqui.** Com menos de três faixas, que é impossível hoje, a contagem é
 * acima do último limite que houver.
 */
export function vereditoDaIdade(faixas: readonly FaixaDeIdadeNaTela[]): string {
  if (totalEmAberto(faixas) === 0) return "Nada em aberto agora.";

  const indiceDoCorte = faixas.length > 2 ? 1 : 0;
  const corte = faixas[indiceDoCorte]?.ateDias ?? 0;
  const acima = faixas.slice(indiceDoCorte + 1).reduce((soma, faixa) => soma + faixa.quantidade, 0);
  if (acima === 0) return `Nenhuma em aberto há mais de ${String(corte)} dias.`;

  const maisVelha = faixas.at(-1);
  const ultimoLimite = (maisVelha?.deDias ?? 1) - 1;
  const oracao =
    faixas.length > 2 && maisVelha !== undefined && maisVelha.quantidade > 0
      ? `, e ${String(maisVelha.quantidade)} delas há mais de ${String(ultimoLimite)}`
      : "";
  return `${String(acima)} em aberto há mais de ${String(corte)} dias${oracao}.`;
}

/**
 * O rodapé do quadro, **sempre**: a primeira oração do item 59, que cumpre o 59.6 (a organização
 * recém-criada lê o que o quadro mede), e a soma em texto, que deixa à vista a conferência com o quadro 5.
 */
export function rodapeDaIdade(faixas: readonly FaixaDeIdadeNaTela[]): string {
  return `Há quanto tempo o que está em aberto espera, contando do registro: ${String(totalEmAberto(faixas))} ao todo, entre Aberta, Em análise, Em atendimento e Pausada.`;
}

const PORCENTAGEM = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A parte de uma faixa no total, com uma casa (`74,7%`). Com total zero, o travessão, e nada de `NaN`. */
export function parteDoTotal(quantidade: number, total: number): string {
  if (total === 0) return "—";
  return `${PORCENTAGEM.format((quantidade / total) * 100)}%`;
}
