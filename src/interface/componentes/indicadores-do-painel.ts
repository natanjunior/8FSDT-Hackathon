import type { SaldoDoPeriodo } from "./fluxo-mensal";

/**
 * ============================================================================
 *  Os textos dos três cartões de T-07, da categoria e da satisfação
 * ============================================================================
 *
 * **Módulo puro, sem componente**, pela razão dos irmãos (`fluxo-mensal.ts`, `idade-em-aberto.ts`):
 * derivação dentro de um componente é derivação que nenhum teste do laço curto alcança. O único `import` é
 * de tipo.
 *
 * **Nenhum limite é escrito aqui.** O `7` do *há mais de 7 dias* chega por parâmetro, e quem o passa é a
 * página, lendo o `ateDias` da primeira faixa de idade.
 */

/** O sinal de menos da tipografia, U+2212, e não o hífen. */
const MENOS = "−";

/**
 * `+71`, `−3` ou `0`. **O sinal é sempre escrito**, e é ele que diz se a fila cresceu: nenhum cartão muda
 * de cor, porque saldo positivo pode ser a organização começando a usar o produto.
 */
export function textoDoSaldo(saldo: number): string {
  if (saldo > 0) return `+${String(saldo)}`;
  if (saldo < 0) return `${MENOS}${String(Math.abs(saldo))}`;
  return "0";
}

/** `117 entraram, 46 saíram` — o segundo termo do cartão do saldo, com o singular dos dois lados. */
export function segundoTermoDoSaldo(saldo: SaldoDoPeriodo): string {
  const entrou = saldo.entraram === 1 ? "entrou" : "entraram";
  const saiu = saldo.sairam === 1 ? "saiu" : "saíram";
  return `${String(saldo.entraram)} ${entrou}, ${String(saldo.sairam)} ${saiu}`;
}

/** `eram 4 no início do período` — o segundo termo do cartão *Em aberto agora*, com qualquer janela. */
export function segundoTermoDoEmAberto(noInicio: number): string {
  if (noInicio === 0) return "nenhuma no início do período";
  if (noInicio === 1) return "era 1 no início do período";
  return `eram ${String(noInicio)} no início do período`;
}

/**
 * `7 · 4 há mais de 7 dias` — **o segundo número da categoria vai em texto**, nunca em cor nem em
 * empilhamento (critério 73.9). Categoria sem nada em aberto escreve só o `0`.
 */
export function textoDoValorDaCategoria(
  quantidade: number,
  envelhecidas: number,
  limite: number,
): string {
  if (quantidade === 0) return "0";
  const quantas = envelhecidas === 0 ? "nenhuma" : String(envelhecidas);
  return `${String(quantidade)} · ${quantas} há mais de ${String(limite)} dias`;
}

/**
 * `26 de 37 resolvidas avaliadas · 70% responderam`. A taxa arredonda para inteiro, e some quando não há
 * resolvidas.
 *
 * **Sem avaliação, a frase é a do critério 34.2, literal**, com o `0 de 0` mesmo quando há resolvidas:
 * mudá-la é mudar um critério fechado, e este item não o reabre.
 */
export function denominadorDaSatisfacao(m: {
  media: number | null;
  avaliadas: number;
  resolvidas: number;
}): string {
  if (m.media === null) return "Nenhuma ocorrência avaliada ainda — 0 de 0 resolvidas.";
  const base = `${String(m.avaliadas)} de ${String(m.resolvidas)} resolvidas avaliadas`;
  if (m.resolvidas === 0) return base;
  return `${base} · ${String(Math.round((m.avaliadas / m.resolvidas) * 100))}% responderam`;
}

/** `Nota 5`. **A nota não é estrela** (`modal-de-avaliacao.tsx`), e o painel não abre o segundo vocabulário. */
export function rotuloDaNota(nota: number): string {
  return `Nota ${String(nota)}`;
}
