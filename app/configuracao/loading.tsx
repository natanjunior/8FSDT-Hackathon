/**
 * O cold start de T-09 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * O esqueleto tem a forma **desta** tela: título, e duas colunas com a altura de uma lista.
 */
export default function EsperandoAConfiguracao() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-6 pt-10 pb-12">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>

      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-6 w-[38%] animate-pulse rounded" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-secondary h-72 animate-pulse rounded" />
          <div className="bg-secondary h-72 animate-pulse rounded" />
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-sm opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </main>
  );
}
