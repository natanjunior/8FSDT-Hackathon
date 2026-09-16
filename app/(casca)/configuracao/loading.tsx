/**
 * O cold start de T-15 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **O esqueleto tem a forma desta tela: título e dois destinos.** Até 16/09/2026 ele desenhava duas
 * colunas de lista e valia para a subárvore inteira, então `/configuracao/categorias/nova` mostrava duas
 * listas antes de um formulário. Cada lista tem o seu esqueleto agora, e este vale só para esta página.
 */
export default function EsperandoAConfiguracao() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>

      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-6 w-[38%] animate-pulse rounded" />
        <div className="flex flex-col gap-3">
          <div className="bg-secondary h-16 animate-pulse rounded" />
          <div className="bg-secondary h-16 animate-pulse rounded" />
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
