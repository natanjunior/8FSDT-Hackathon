/**
 * O cold start de T-07 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **Vale aqui mesmo não sendo a primeira requisição da sessão**, e é a única tela do produto em que isso
 * precisa ser dito: são **dez agregações numa chamada só**, a requisição mais pesada do produto.
 *
 * O esqueleto tem a forma **desta** tela (item 73): a faixa de período; na fileira de cima, os três
 * cartões em coluna à esquerda (em faixa de três abaixo de `lg`) e o quadro 1 ao lado; embaixo, os seis
 * quadros em duas colunas. Esqueleto que desenhasse outra grade seria o esqueleto mentindo sobre a forma.
 * A marca saiu daqui no item 44e, pelo mesmo motivo que saiu da página: a barra superior da casca já a
 * pinta. Os títulos não entram no esqueleto porque a página os desenha assim que existe.
 */
export default function EsperandoODashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-8 w-[38%] animate-pulse rounded-lg" />
        <div className="border-linha-suave border-b pb-4">
          <div className="bg-secondary h-11 w-64 animate-pulse rounded-sm" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(13rem,0.9fr)_3fr]">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:content-start">
            <div className="bg-secondary h-28 animate-pulse rounded-lg" />
            <div className="bg-secondary h-28 animate-pulse rounded-lg" />
            <div className="bg-secondary h-28 animate-pulse rounded-lg" />
          </div>
          <div className="bg-secondary h-96 animate-pulse rounded-lg" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
          <div className="bg-secondary h-72 animate-pulse rounded-lg" />
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-corpo opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
