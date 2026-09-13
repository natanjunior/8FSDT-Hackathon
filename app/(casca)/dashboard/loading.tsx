/**
 * O cold start de T-07 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **Vale aqui mesmo não sendo a primeira requisição da sessão**, e é a única tela do produto em que isso
 * precisa ser dito: são **cinco agregações numa chamada só**, a requisição mais pesada do produto.
 *
 * O esqueleto tem a forma **desta** tela: a faixa de período, o bloco largo da recorrência e os quatro
 * blocos em duas colunas. Os títulos não entram no esqueleto porque a página os desenha assim que existe.
 */
export default function EsperandoODashboard() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>

      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-6 w-[38%] animate-pulse rounded" />
        <div className="bg-secondary h-10 w-full animate-pulse rounded" />
        <div className="bg-secondary h-56 w-full animate-pulse rounded" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-secondary h-44 animate-pulse rounded" />
          <div className="bg-secondary h-44 animate-pulse rounded" />
          <div className="bg-secondary h-44 animate-pulse rounded" />
          <div className="bg-secondary h-44 animate-pulse rounded" />
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-sm opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
