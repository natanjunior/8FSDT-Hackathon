/**
 * O cold start de T-08 (RNF5, escala a zero) — mesma regra e mesmo texto de `app/organizacao/loading.tsx`:
 * *"a primeira requisição de uma sessão tem espera nomeada"*, e o texto **não promete prazo**.
 *
 * O esqueleto tem a forma **desta** tela: título, e um cartão de pedido com a altura do bloco de papéis.
 */
export default function EsperandoOsPedidos() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-12">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>

      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-6 w-[52%] animate-pulse rounded" />
        <div className="bg-secondary h-4 w-[30%] animate-pulse rounded" />
        <div className="bg-secondary h-64 animate-pulse rounded" />
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
