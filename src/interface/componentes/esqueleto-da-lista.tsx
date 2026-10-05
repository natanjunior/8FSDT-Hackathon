import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";
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
/**
 * **As seis colunas da tabela, na mesma ordem**: Status, Título, Onde, Prioridade, Responsável, Tempo. As
 * larguras imitam o que chega com a semente, e não são régua de nada: o que importa é a forma.
 */
const COLUNAS = "grid grid-cols-[96px_minmax(0,1fr)_150px_80px_160px_112px] gap-4";
const LARGURAS_DO_TITULO = [58, 34, 64, 44, 61] as const;

export function EsqueletoDaLista({
  comCabecalhoDePagina = false,
  linhas,
}: {
  comCabecalhoDePagina?: boolean;
  /**
   * **Quantas linhas a tabela vai ter**, que é o limite da página (critério 102.10). Quem a chama passa
   * `LIMITE_PADRAO`: a página não lê `limite` da URL, e o `loading.tsx` não vê a URL.
   */
  linhas: number;
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
        {/* **Abaixo de `lg`, a forma da linha do celular**, como sempre foi. */}
        <div aria-hidden data-esqueleto-celular className="flex flex-col lg:hidden">
          {LARGURAS_DO_TITULO.map((largura) => (
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

        {/* **A partir de `lg`, a forma da tabela** (critério 102.10): a faixa do cabeçalho e uma linha por
            item da página. Antes eram os cinco blocos do celular em toda largura, e a lista que chegava era
            uma tabela de vinte linhas: o cartão quase quadruplicava e a paginação descia de uma vez (A-106).
            Seis colunas sempre: o `loading.tsx` não sabe a permissão, e dois esqueletos diferentes em
            sequência é o defeito que este componente existe para impedir. */}
        <div aria-hidden data-esqueleto-tabela className="hidden lg:block">
          <div className={`${COLUNAS} bg-background border-linha-suave border-b px-4 py-3`}>
            {Array.from({ length: 6 }, (_, coluna) => (
              <Skeleton key={coluna} className="bg-secondary h-2.5 w-14" />
            ))}
          </div>
          {Array.from({ length: linhas }, (_, indice) => (
            <div
              key={indice}
              className={`${COLUNAS} border-linha-suave items-start border-b px-4 py-3 last:border-b-0`}
            >
              <Skeleton className="bg-secondary h-5 w-20 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton
                  className="bg-secondary h-4"
                  style={{ width: `${String(LARGURAS_DO_TITULO[indice % LARGURAS_DO_TITULO.length])}%` }}
                />
                <Skeleton className="bg-secondary h-3 w-[40%]" />
              </div>
              <Skeleton className="bg-secondary h-4 w-[70%]" />
              <Skeleton className="bg-secondary h-5 w-14 rounded-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="bg-secondary size-6 rounded-full" />
                <Skeleton className="bg-secondary h-4 w-[60%]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="bg-secondary h-3 w-24" />
                <Skeleton className="bg-secondary h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-interface opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        {FRASES_DE_ESPERA.dentro}
      </p>
    </div>
  );
}
