/**
 * O cold start de T-15 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **O cabeçalho é de verdade, e o conteúdo é esqueleto** (guia §8: a casca e o cabeçalho não são
 * esqueleto). O título é o mesmo da página e do estado sem acesso, então quem chega sem permissão não vê
 * o título trocar; e **não há a linha do fato**, porque o estado sem acesso não a tem. O esqueleto tem a
 * forma dos dois cartões, e vale só para esta página: cada lista tem o seu.
 */
export default function EsperandoAConfiguracao() {
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="text-titulo-pagina text-tinta">Configuração da organização</h1>

      <div aria-hidden className="flex flex-col gap-5.5">
        <div className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
          <div className="bg-secondary h-6 w-[30%] animate-pulse rounded" />
          <div className="bg-secondary h-16 animate-pulse rounded" />
        </div>
        <div className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
          <div className="bg-secondary h-6 w-[40%] animate-pulse rounded" />
          <div className="bg-secondary h-11 animate-pulse rounded" />
          <div className="bg-secondary h-11 animate-pulse rounded" />
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
