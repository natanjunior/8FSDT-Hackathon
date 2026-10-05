import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";

/**
 * O cold start de T-09 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **A forma é a da tela nova** (item 44k): um bloco para o cabeçalho, um para as abas do filtro rápido e
 * um cartão com as linhas da tabela. A marca saiu do conteúdo, porque a barra superior já a carrega.
 */
export default function EsperandoAsCategorias() {
  return (
    <div className="flex flex-col gap-5.5">
      <div aria-hidden className="flex flex-col gap-5.5">
        <div className="flex flex-col gap-2">
          <div className="bg-secondary h-7 w-[32%] animate-pulse rounded" />
          <div className="bg-secondary h-4 w-[58%] animate-pulse rounded" />
        </div>

        <div className="bg-secondary h-13 w-full animate-pulse rounded-sm md:w-80" />

        <div className="border-linha bg-superficie flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
          {[0, 1, 2, 3, 4, 5].map((linha) => (
            <div key={linha} className="bg-secondary h-9 w-full animate-pulse rounded" />
          ))}
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-meta opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        {FRASES_DE_ESPERA.dentro}
      </p>
    </div>
  );
}
