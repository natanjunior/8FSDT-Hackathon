/**
 * O cold start de *Meus dados* (RNF5). **O título é o mesmo da página**, e o esqueleto tem a forma dos
 * dois cartões — identidade e acesso. O molde é o de `vinculos/nova/loading.tsx`.
 */
export default function EsperandoMeusDados() {
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="text-titulo-pagina text-tinta">Meus dados</h1>

      <div aria-hidden className="flex flex-col gap-5.5">
        {["identidade", "acesso"].map((cartao) => (
          <div
            key={cartao}
            className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]"
          >
            <div className="bg-secondary h-6 w-[30%] animate-pulse rounded" />
            <div className="bg-secondary h-11 animate-pulse rounded" />
          </div>
        ))}
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
