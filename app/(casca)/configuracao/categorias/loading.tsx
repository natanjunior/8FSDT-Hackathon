/**
 * O cold start de T-09 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **Este esqueleto vale para a subárvore de categorias**, e é o que `nova` e `[categoriaId]/editar`
 * passam a mostrar ao acordar o servidor. Antes da separação elas herdavam o de duas colunas de
 * `/configuracao`, que prometia duas listas para quem ia ver um formulário.
 */
export default function EsperandoAsCategorias() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>

      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-6 w-[38%] animate-pulse rounded" />
        <div className="bg-secondary h-72 animate-pulse rounded" />
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
