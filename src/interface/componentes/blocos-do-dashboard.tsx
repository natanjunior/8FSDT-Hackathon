/**
 * ============================================================================
 *  Os três desenhos de T-07 — e nenhuma biblioteca de gráfico
 * ============================================================================
 *
 * **O componente de gráfico já saiu da primeira entrega** — `backlog.md:1258-1260`, no B-05: *"a Q-P6 (…)
 * estabeleceu o critério para este caso com todas as letras — 'a decisão é do hub porque é dependência,
 * não desenho'. **Foi assim que o componente de gráfico saiu da primeira entrega**"*. As barras são blocos
 * de HTML com largura em `%`, exatamente como o protótipo desenha (`telas.html:3423-3425`). **Nenhuma
 * dependência nova entra no `package.json` por este item.**
 *
 * *(Revisão de 29/08/2026: a citação era `backlog.md:1246-1248`, que é o B-03 — outro achado. E "a Q-P6
 * foi fechada" é forte demais: `prototipo-low-fi.md:1280` recomenda **(b)** e diz que a decisão é do hub,
 * e o R-04 da mesma página — `:1549` — ainda a lista como **aberta**. O que está fechado é o **fato**: a
 * dependência não entrou. O plano não a introduz, então a diferença não muda uma linha de código — mas a
 * frase, sim, e é achado do hub.)*
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
    <section className="border-linha bg-superficie flex flex-col gap-3 rounded-md border p-4">
      <h2 className="flex flex-wrap items-baseline gap-2">
        <span className="text-tinta-fraca text-xs font-semibold tracking-wide uppercase">
          {numero} · {titulo}
        </span>
        <span className="text-tinta-suave text-xs">{quando}</span>
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
 * A lista com barra — o desenho de quatro dos cinco blocos.
 *
 * **A barra é proporcional ao MAIOR item da própria lista**, não a um teto absoluto: o que a tela compara
 * é o item contra os irmãos dele. Com todos a zero, todas as barras têm largura zero — que é o estado da
 * organização recém-criada (critério 32.3), e continua mostrando a estrutura.
 */
export function Medidor({ itens }: { itens: readonly ItemDoMedidor[] }) {
  const maior = itens.reduce((maximo, item) => Math.max(maximo, item.quantidade), 0);

  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item) => (
        <li
          key={item.rotulo}
          className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_auto]"
        >
          <span className="text-tinta truncate">{item.rotulo}</span>

          {item.vazio === undefined ? (
            /* `aria-hidden` porque o número ao lado JÁ diz tudo — A-5. */
            <span aria-hidden className="bg-linha-suave h-2 w-full rounded">
              <span
                className="bg-marca block h-2 rounded"
                style={{ width: `${String(largura(item.quantidade, maior))}%` }}
              />
            </span>
          ) : (
            <span className="text-tinta-fraca text-xs">{item.vazio}</span>
          )}

          <span className="text-tinta-suave text-xs tabular-nums">
            {item.texto ?? String(item.quantidade)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export type SerieMensal = {
  rotulo: string;
  porMes: readonly { mes: string; quantidade: number }[];
};

const ALTURA_MAXIMA = 64;

/**
 * As colunas mensais do bloco 1, **só na tela grande** — no celular o mesmo dado vira `Medidor`.
 *
 * **Duas séries, e é decisão da tela**: com ~7 categorias e ~30 áreas, mais que duas cores não têm legenda
 * possível (achado **P-11**). Quem corta para duas é a página; a API não corta nada.
 *
 * **Cada coluna carrega o número acima dela** — A-5 de novo. E a legenda nomeia as duas séries em texto,
 * nunca só pela cor do bloco.
 */
export function ColunasMensais({
  series,
  meses,
}: {
  series: readonly SerieMensal[];
  meses: readonly string[];
}) {
  const rotulos = rotulosDosMeses(meses);
  const maior = series.reduce(
    (maximo, serie) =>
      serie.porMes.reduce((interno, ponto) => Math.max(interno, ponto.quantidade), maximo),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-6">
        {meses.map((mes, indice) => (
          <div key={mes} className="flex flex-col items-center gap-1">
            <div className="flex items-end gap-1">
              {series.map((serie, ordem) => {
                const ponto = serie.porMes.find((p) => p.mes === mes);
                const quantidade = ponto?.quantidade ?? 0;
                const altura =
                  maior === 0 ? 2 : Math.max(2, Math.round((quantidade / maior) * ALTURA_MAXIMA));
                return (
                  <span key={serie.rotulo} className="flex flex-col items-center gap-1">
                    <span className="text-tinta-suave text-xs tabular-nums">
                      {String(quantidade)}
                    </span>
                    <span
                      aria-hidden
                      className={ordem === 0 ? "bg-marca w-5 rounded-sm" : "bg-linha w-5 rounded-sm"}
                      style={{ height: `${String(altura)}px` }}
                    />
                  </span>
                );
              })}
            </div>
            <span className="text-tinta-suave text-xs">{rotulos[indice]}</span>
          </div>
        ))}
      </div>

      <p className="text-tinta-suave flex flex-wrap items-center gap-4 text-xs">
        {series.map((serie, ordem) => (
          <span key={serie.rotulo} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className={
                ordem === 0
                  ? "bg-marca inline-block h-2 w-4 rounded-sm"
                  : "bg-linha inline-block h-2 w-4 rounded-sm"
              }
            />
            {serie.rotulo}
          </span>
        ))}
        <span className="text-tinta-fraca">as duas categorias com mais ocorrências no período</span>
      </p>
    </div>
  );
}
