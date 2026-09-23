import { Skeleton } from "@/interface/componentes/ui/skeleton";

/**
 * ============================================================================
 *  A primeira carga — guia §8
 * ============================================================================
 *
 * *"Esqueleto com a forma da lista. A casca e o cabeçalho não são esqueleto: já estão no cliente."*
 *
 * **Dois consumidores, e é a razão de o componente existir:** o `loading.tsx` da rota e a fronteira de
 * espera dentro da página. Duas cópias da mesma forma divergiriam no primeiro ajuste, e a pessoa veria
 * dois esqueletos diferentes em sequência na mesma navegação.
 *
 * **O `Skeleton` do catálogo pinta com `bg-accent`, que resolve para `--accent-bg` — um azul tingido.**
 * O ground é sobrescrito para `bg-secondary`, que é neutro, e é o que o esqueleto de hoje já usa. Espera
 * é ausência de informação, e tingi-la faz a tela parecer estar dizendo alguma coisa.
 *
 * **A frase de cold start é do RNF5** e aparece depois de dois segundos. Ela não promete prazo.
 */
export function EsqueletoDaLista({
  comCabecalhoDePagina = false,
}: {
  comCabecalhoDePagina?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {comCabecalhoDePagina && (
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-titulo-pagina text-tinta">Ocorrências</h1>
          <Skeleton className="bg-secondary h-11 w-full rounded-sm md:w-80" />
        </header>
      )}

      <section className="border-linha bg-superficie overflow-hidden rounded-lg border shadow-sm">
        <div aria-hidden className="flex flex-col">
          {[58, 34, 64, 44, 61].map((largura) => (
            <div
              key={largura}
              className="border-linha-suave flex flex-col gap-2 border-b px-4 py-3 last:border-b-0"
            >
              <Skeleton className="bg-secondary h-4" style={{ width: `${String(largura)}%` }} />
              <Skeleton className="bg-secondary h-4 w-[86%]" />
              <Skeleton className="bg-secondary h-3 w-[46%]" />
            </div>
          ))}
        </div>
      </section>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-interface opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
