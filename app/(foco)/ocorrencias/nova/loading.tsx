/**
 * O cold start de T-04 (RNF5), e é a tela cronometrada pelo RNF6 — menos de um minuto do toque ao `201`.
 * Abrir em branco enquanto o servidor acorda gasta 20,7 s desse minuto sem dizer nada.
 *
 * **A segunda coluna não entra no esqueleto.** Ela só existe a partir de `lg` (item 44l), e esqueleto que
 * desenha o que talvez não apareça é ruído. O molde é o de `vinculos/nova/loading.tsx`.
 */
export default function EsperandoORegistro() {
  return (
    <div className="flex flex-col gap-5.5">
      <h1 className="text-titulo-pagina text-tinta leading-snug font-semibold">Registrar ocorrência</h1>

      <div
        aria-hidden
        className="border-linha bg-superficie flex flex-col gap-4 rounded-lg border p-[15px] shadow-sm md:p-[18px]"
      >
        <div className="bg-secondary h-6 w-[30%] animate-pulse rounded" />
        <div className="bg-secondary h-11 animate-pulse rounded" />
        <div className="bg-secondary h-11 animate-pulse rounded" />
        <div className="bg-secondary h-24 animate-pulse rounded" />
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
