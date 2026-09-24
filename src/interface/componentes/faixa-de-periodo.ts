/**
 * ============================================================================
 *  A faixa de período de T-07 — a tradução entre o dia do endereço e o do calendário
 * ============================================================================
 *
 * **Módulo puro, sem um único `import`**, pelo mesmo requisito de `datas.ts`: ele é consumido por
 * servidor e por cliente, e um módulo que só recebe e devolve `string` e `Date` atravessa a fronteira sem
 * arrastar nada.
 *
 * **Aqui mora o defeito clássico de um dia, e é por isso que ele tem arquivo e teste.** O calendário
 * trabalha com `Date`; a URL, o contrato e o banco trabalham com `YYYY-MM-DD`. As duas conversões óbvias
 * erram:
 *
 * | O que se faria | O que dá errado |
 * |---|---|
 * | `new Date("2026-07-01")` | meia-noite em tempo universal, que em São Paulo é 30 de junho |
 * | `data.toISOString().slice(0, 10)` | o dia seguinte para quem escolhe depois das 21h em Brasília |
 *
 * Por isso `deDia` monta o instante ao **meio-dia local** e `paraDia` lê as partes **locais** e monta a
 * string à mão.
 *
 * **`dataCurta` de `datas.ts` não serve aqui.** Ela recebe um instante em formato de intercâmbio e
 * formata no fuso de São Paulo; dar-lhe `"2026-07-01"` produz `30/06/2026`. `diaEmTexto` só reordena os
 * três pedaços da string e não toca em fuso nenhum.
 */

/** As duas pontas do recorte, em `YYYY-MM-DD` e as duas dentro do período. */
export type Faixa = { readonly de: string; readonly ate: string };

/**
 * Os quatro atalhos, pelas mesmas chaves que `atalhosDaJanela` devolve.
 *
 * **A lista é escrita aqui e não importada da Aplicação**, pela razão que `ordenacao-das-ocorrencias.ts`
 * já dá: este arquivo é lido do navegador. O que impede as duas de divergirem é um teste que compara as
 * quatro chaves com as quatro janelas.
 */
export const CHAVES_DE_ATALHO = ["sete", "trinta", "noventa", "mes"] as const;

export type ChaveDeAtalho = (typeof CHAVES_DE_ATALHO)[number];

export type AtalhosDoPeriodo = Readonly<Record<ChaveDeAtalho, Faixa>>;

/** Meio-dia: a hora que sobrevive a qualquer fuso sem trocar de dia. */
const MEIO_DIA = 12;

/** Cinco anos para trás é o que o menu de anos oferece sem virar rolagem. */
const ANOS_PARA_TRAS = 5;

export function deDia(dia: string): Date {
  return new Date(
    Number(dia.slice(0, 4)),
    Number(dia.slice(5, 7)) - 1,
    Number(dia.slice(8, 10)),
    MEIO_DIA,
  );
}

export function paraDia(data: Date): string {
  const ano = String(data.getFullYear()).padStart(4, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** `dd/mm/aaaa`, do guia. */
export function diaEmTexto(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
}

/** O rótulo visível do gatilho, com travessão curto entre as duas datas. */
export function rotuloDaFaixa(periodo: Faixa): string {
  return `${diaEmTexto(periodo.de)} – ${diaEmTexto(periodo.ate)}`;
}

/**
 * O nome acessível do gatilho.
 *
 * **Ele contém o rótulo visível inteiro**, e é o que faz a regra de rótulo no nome valer: trocar o
 * travessão por outra palavra quebraria a correspondência que ela exige. O que a palavra *Período*
 * acrescenta é o assunto, que o leitor de tela anuncia antes das duas datas.
 */
export function nomeDaFaixa(periodo: Faixa): string {
  return `Período: ${rotuloDaFaixa(periodo)}`;
}

/**
 * Este atalho é o recorte aplicado?
 *
 * **A pergunta é por atalho, e não *"qual dos quatro"*, porque dois deles empatam.** No dia 7 de qualquer
 * mês, *últimos 7 dias* e *este mês* são a mesma janela; no dia 30, *últimos 30 dias* e *este mês* também.
 * Uma função que devolvesse um único vencedor apagaria o primeiro da lista e deixaria o outro aceso,
 * oferecendo um toque que não faz nada. A janela de 90 dias nunca empata, então o critério 2 vale nos dois
 * desenhos; o defeito é dos outros três.
 */
export function ehAFaixaAplicada(periodo: Faixa, atalho: Faixa): boolean {
  return atalho.de === periodo.de && atalho.ate === periodo.ate;
}

/**
 * O alcance que os menus de mês e de ano do calendário oferecem.
 *
 * **Ele repõe o que o campo nativo dava de graça:** quem digitava uma data de 2021 agora escolheria o mês
 * clicando na seta sessenta vezes. O teto e o piso são da tela, e não do contrato — o endereço continua
 * aceitando qualquer data válida.
 *
 * **O começo desce até o recorte aplicado**, para que um endereço antigo não abra um calendário incapaz
 * de mostrar o que está selecionado.
 */
export function limitesDoCalendario(periodo: Faixa): { readonly inicio: Date; readonly fim: Date } {
  const anoDoFim = Number(periodo.ate.slice(0, 4));
  const anoDoInicio = Math.min(Number(periodo.de.slice(0, 4)), anoDoFim - ANOS_PARA_TRAS);
  return { inicio: new Date(anoDoInicio, 0, 1, MEIO_DIA), fim: new Date(anoDoFim + 1, 11, 31, MEIO_DIA) };
}
