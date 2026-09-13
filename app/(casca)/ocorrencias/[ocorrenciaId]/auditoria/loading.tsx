/**
 * O cold start de T-06 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **O cabeçalho da tela já está aqui**, e é o quadro 4 do protótipo: ele não depende da resposta. As
 * quatro linhas cinzas são arbitrárias e **não prometem quantidade** — só o registro de criação é
 * garantido.
 */
export default function EsperandoATrilha() {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
      <h1 className="text-tinta text-xl leading-snug font-semibold">Trilha de auditoria</h1>

      <div aria-hidden className="flex flex-col gap-3">
        <div className="bg-secondary h-4 w-[46%] animate-pulse rounded" />
        <div className="bg-secondary h-6 w-full animate-pulse rounded" />
        {[86, 62, 92, 48].map((largura) => (
          <div key={largura} className="flex flex-col gap-1.5">
            <div className="bg-secondary h-4 w-full animate-pulse rounded" />
            <div
              className="bg-secondary h-3 animate-pulse rounded"
              style={{ width: `${String(largura)}%` }}
            />
          </div>
        ))}
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
