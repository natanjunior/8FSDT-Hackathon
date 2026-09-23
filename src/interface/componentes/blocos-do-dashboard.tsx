/**
 * ============================================================================
 *  Os dois desenhos de T-07 — o cartão e a lista com barra
 * ============================================================================
 *
 * **As colunas mensais saíram no item 44e**, e com elas o desenho feito de `<span>` com largura em `%`
 * para o bloco 1. Quem desenha a recorrência agora é o componente de gráfico do catálogo, numa ilha
 * cliente, sobre a paleta categórica re-escalonada — a decisão está na ADR-0010, e a recusa que a
 * ADR-0007 tinha escrito continua onde estava, válida para a data em que foi tomada.
 *
 * **Compromisso A-5 do Definition of Done, e aqui ele é literal:** *nada é comunicado só por cor*. Toda
 * barra é `aria-hidden` e vem **sempre** acompanhada do número em texto — a barra é enfeite de leitura, e o
 * número é o dado. Barra sem número seria a definição do defeito que o A-5 nomeia.
 */

const NOMES_DOS_MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/**
 * `2026-06` vira `jun` — **e vira `jun/26` quando a janela atravessa a virada do ano**.
 *
 * Sem isso, uma janela de 90 dias aberta em janeiro mostraria `nov · dez · jan` sem dizer que os dois
 * primeiros são do ano passado, e a série leria como se subisse quando desce. A decisão é do eixo inteiro,
 * não de cada rótulo: ou todos levam ano, ou nenhum leva.
 */
export function rotulosDosMeses(meses: readonly string[]): readonly string[] {
  const anos = new Set(meses.map((mes) => mes.slice(0, 4)));
  return meses.map((mes) => {
    const nome = NOMES_DOS_MESES[Number(mes.slice(5, 7)) - 1] ?? mes;
    return anos.size === 1 ? nome : `${nome}/${mes.slice(2, 4)}`;
  });
}

/** O total de uma série no período — é por ele que a tela ordena e corta. */
export function totalDaSerie(porMes: readonly { quantidade: number }[]): number {
  return porMes.reduce((total, ponto) => total + ponto.quantidade, 0);
}

function largura(quantidade: number, maior: number): number {
  return maior === 0 ? 0 : Math.round((quantidade / maior) * 100);
}

/**
 * Um bloco numerado.
 *
 * **`quando` é união fechada de duas palavras, e não `string`** — a tela é obrigada a dizer o que é
 * fotografia de agora e o que é série dentro da janela (critérios 32.4 e 33.4), e um terceiro texto
 * inventado num bloco seria exatamente o segundo vocabulário que o glossário proíbe.
 *
 * **A palavra vai DENTRO do bloco, não num rodapé** — decisão 3 do protótipo
 * (`prototipo-low-fi.md:687-691`): *"quem lê um número não desce até o rodapé antes"*.
 *
 * O raio, o respiro e a sombra são os do guia, e são o mesmo literal que T-05 usa em três seções: escrever
 * o mesmo desenho de duas formas é como as telas divergem.
 */
export function Cartao({
  numero,
  titulo,
  quando,
  children,
}: {
  numero: number;
  titulo: string;
  quando: "agora" | "no período";
  children: React.ReactNode;
}) {
  return (
    <section className="border-linha bg-superficie flex flex-col gap-3 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
      <h2 className="flex flex-wrap items-baseline gap-2">
        <span className="text-tinta-fraca text-rotulo-coluna font-mono uppercase">
          {numero} · {titulo}
        </span>
        <span className="text-tinta-suave text-meta">{quando}</span>
      </h2>
      {children}
    </section>
  );
}

export type ItemDoMedidor = {
  rotulo: string;
  quantidade: number;
  /** O que aparece à direita. Ausente, aparece a própria `quantidade`. */
  texto?: string;
  /** Quando há, **substitui a barra** por esta frase — é o mês sem resolução do critério 36.2. */
  vazio?: string;
};

/**
 * A lista com barra — o desenho de cinco dos seis blocos.
 *
 * **A barra é proporcional ao MAIOR item da própria lista**, não a um teto absoluto: o que a tela compara
 * é o item contra os irmãos dele. Com todos a zero, todas as barras têm largura zero — que é o estado da
 * organização recém-criada (critério 32.3), e continua mostrando a estrutura.
 *
 * **A barra ancora no zero, e é redonda só na ponta do dado.** Com as duas pontas redondas, um valor baixo
 * vira uma pílula flutuando e a marca da origem se descola da linha de base. O trilho continua redondo dos
 * dois lados, porque ele é a régua e não o dado.
 */
export function Medidor({ itens }: { itens: readonly ItemDoMedidor[] }) {
  const maior = itens.reduce((maximo, item) => Math.max(maximo, item.quantidade), 0);

  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <li
          key={item.rotulo}
          className="text-corpo grid grid-cols-[7rem_1fr_auto] items-center gap-3 sm:grid-cols-[10rem_1fr_auto]"
        >
          <span className="text-tinta truncate">{item.rotulo}</span>

          {item.vazio === undefined ? (
            /* `aria-hidden` porque o número ao lado JÁ diz tudo — A-5. */
            <span aria-hidden className="bg-linha-suave h-2 w-full rounded">
              <span
                className="bg-marca block h-2 rounded-r"
                style={{ width: `${String(largura(item.quantidade, maior))}%` }}
              />
            </span>
          ) : (
            <span className="text-tinta-fraca text-meta">{item.vazio}</span>
          )}

          <span className="text-tinta-suave text-meta tabular-nums">
            {item.texto ?? String(item.quantidade)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export type ItemEmTexto = { chave: string; rotulo: string; texto: string };

/**
 * A lista **sem barra** — o desenho das duas seções do bloco 1 que não comparam magnitudes.
 *
 * **A barra fica de fora, e é decisão.** O `Medidor` desenha uma barra por linha sobre um rótulo truncado
 * em `7rem`. A lista dos meses tem dois números por linha, e uma barra teria de escolher um deles; a lista
 * do par tem um rótulo de duas partes, e o `truncate` cortaria justamente a segunda, que é a metade que a
 * seção acrescenta às listas de baixo. O compromisso A-5 fica satisfeito do jeito mais simples que existe
 * — não há cor nem barra carregando informação, só o número.
 *
 * **A chave vem de fora**, e cada chamador sabe qual é a sua: o rótulo do mês, que é único por construção,
 * ou o par de identificadores da dupla.
 *
 * **Cada `<li>` tem exatamente dois `<span>` filhos diretos**, rótulo primeiro e texto por último. O
 * ponta a ponta lê `:scope > span` e pega o primeiro e o último; um terceiro `span` aqui, ou um rótulo
 * embrulhado, quebra a leitura de todas as listas do painel.
 */
export function ListaEmTexto({ itens }: { itens: readonly ItemEmTexto[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <li
          key={item.chave}
          className="text-corpo flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
        >
          <span className="text-tinta">{item.rotulo}</span>
          <span className="text-tinta-suave text-meta tabular-nums">{item.texto}</span>
        </li>
      ))}
    </ul>
  );
}

export type SerieMensal = {
  rotulo: string;
  porMes: readonly { mes: string; quantidade: number }[];
};
