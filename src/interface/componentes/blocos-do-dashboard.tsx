/**
 * ============================================================================
 *  As duas molduras de T-07 — o quadro e o cartão de indicador
 * ============================================================================
 *
 * **Os desenhos dos quadros são gráficos do catálogo** desde o item 73: a barra horizontal
 * (`grafico-de-barras.tsx`) e as duas linhas (`grafico-do-fluxo-mensal.tsx`,
 * `grafico-do-tempo-de-resolucao.tsx`), numa ilha cliente cada, sobre a paleta categórica — a decisão do
 * componente está na ADR-0010. Este arquivo guarda só as molduras, que são do servidor.
 *
 * **Compromisso A-5 do Definition of Done:** *nada é comunicado só por cor*. Todo gráfico é `aria-hidden`,
 * e o número de cada linha existe em texto em outro lugar: na tabela do `Ver dados`, nos quadros que o
 * têm, ou na lista para leitor de tela que o `GraficoDeBarras` desenha junto, nos que não têm.
 */

/**
 * Os nomes dos meses moram em `fluxo-mensal.ts`, que é módulo puro: este arquivo tem JSX, e o módulo puro
 * não o importa. A página continua lendo daqui.
 */
export { nomeCompletoDoMes, rotulosDosMeses } from "./fluxo-mensal";

/**
 * Um quadro numerado, **com a pergunta de decisão que ele responde** logo abaixo do título (item 73,
 * critério 2): quadro sem pergunta não entra.
 *
 * **`quando` é união fechada de duas palavras, e não `string`** — a tela é obrigada a dizer o que é
 * fotografia de agora e o que é série dentro da janela (critérios 32.4 e 33.4), e um terceiro texto
 * inventado num quadro seria exatamente o segundo vocabulário que o glossário proíbe.
 *
 * **A palavra vai DENTRO do quadro, não num rodapé** — decisão 3 do protótipo
 * (`prototipo-low-fi.md:687-691`): *"quem lê um número não desce até o rodapé antes"*.
 *
 * **A ação fica no canto superior direito, na linha do título** (critério 73.12). Hoje ela só é o `Ver
 * dados`.
 *
 * O raio, o respiro e a sombra são os do guia, e são o mesmo literal que T-05 usa em três seções: escrever
 * o mesmo desenho de duas formas é como as telas divergem.
 */
export function Cartao({
  numero,
  titulo,
  quando,
  pergunta,
  acao,
  children,
}: {
  numero: number;
  titulo: string;
  quando: "agora" | "no período";
  pergunta: string;
  /** A ação do quadro, no canto superior direito, na linha do título. Hoje só o `Ver dados`. */
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-linha bg-superficie flex min-w-0 flex-col gap-3 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex flex-wrap items-baseline gap-2">
          <span className="text-tinta-suave text-rotulo-coluna font-mono uppercase">
            {numero} · {titulo}
          </span>
          <span className="text-tinta-suave text-meta">{quando}</span>
        </h2>
        {acao ? <div className="ml-auto">{acao}</div> : null}
      </div>
      <p className="text-tinta-suave text-corpo">{pergunta}</p>
      {children}
    </section>
  );
}

/**
 * Um dos três cartões do topo: o rótulo, o número e o segundo termo embaixo dele (critério 73.3).
 *
 * **Nenhum papel novo da escala tipográfica**: o número é `text-titulo-pagina`, como a média das
 * avaliações já era. Um oitavo papel para indicador seria mudança do guia, que não é decisão de um item de
 * tela.
 *
 * **Não é `section` e não tem `h2`**: o cartão não é quadro, não tem número, e assim o localizador de
 * quadros do ponta a ponta casa só os sete.
 */
export function CartaoDeIndicador({
  rotulo,
  valor,
  segundoTermo,
}: {
  rotulo: string;
  valor: React.ReactNode;
  segundoTermo: React.ReactNode;
}) {
  return (
    <div className="border-linha bg-superficie flex min-w-0 flex-col gap-1.5 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
      <p className="text-tinta-suave text-rotulo-coluna font-mono uppercase">{rotulo}</p>
      <p className="text-tinta text-titulo-pagina tabular-nums">{valor}</p>
      <p className="text-tinta-suave text-meta">{segundoTermo}</p>
    </div>
  );
}
