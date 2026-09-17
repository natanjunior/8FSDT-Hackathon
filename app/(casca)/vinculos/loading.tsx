/**
 * O cold start de T-08 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas, e o texto
 * **não promete prazo**.
 *
 * **O título é de verdade, e o conteúdo é esqueleto** (guia §8). Ele é o mesmo da página e o mesmo do
 * estado sem acesso, então quem chega sem permissão não vê o título trocar. **Sem a linha do fato**, que
 * depende das contagens. O esqueleto tem a forma desta tela: o filtro rápido e o cartão com a faixa da
 * busca e seis linhas.
 */
export default function EsperandoOsParticipantes() {
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="text-titulo-pagina text-tinta leading-snug font-semibold">Participantes</h1>

      <div aria-hidden className="flex flex-col gap-5.5">
        <div className="bg-secondary h-13 w-full animate-pulse rounded-sm md:w-[34rem]" />

        <div className="border-linha bg-superficie overflow-hidden rounded-lg border shadow-sm">
          <div className="border-linha-suave border-b px-4 py-3">
            <div className="bg-secondary h-11 animate-pulse rounded md:w-[24rem]" />
          </div>
          <div className="bg-background border-linha h-9 border-b" />
          {["a", "b", "c", "d", "e", "f"].map((linha) => (
            <div key={linha} className="border-linha-suave flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <div className="bg-secondary size-7 animate-pulse rounded-full" />
              <div className="bg-secondary h-4 w-[38%] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
