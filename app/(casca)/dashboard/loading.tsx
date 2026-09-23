/**
 * O cold start de T-07 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **Vale aqui mesmo não sendo a primeira requisição da sessão**, e é a única tela do produto em que isso
 * precisa ser dito: são **seis agregações numa chamada só**, a requisição mais pesada do produto.
 *
 * O esqueleto tem a forma **desta** tela: a faixa de período, o bloco largo da recorrência — o gráfico à
 * esquerda e a lista de áreas à direita — e os cinco blocos em duas colunas. A marca saiu daqui no item
 * 44e, pelo mesmo motivo que saiu da página: a barra superior da casca já a pinta. Os títulos não entram
 * no esqueleto porque a página os desenha assim que existe.
 */
export default function EsperandoODashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden className="flex flex-col gap-5">
        <div className="bg-secondary h-8 w-[38%] animate-pulse rounded-lg" />
        <div className="bg-secondary h-[74px] w-full animate-pulse rounded-lg" />

        {/* O bloco 1, na forma que ele passou a ter: gráfico e lista lado a lado na tela grande. */}
        <div className="border-linha bg-superficie flex flex-col gap-3 rounded-lg border p-[15px] shadow-sm md:p-[18px]">
          <div className="bg-secondary h-3 w-40 animate-pulse rounded" />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="bg-secondary hidden h-56 w-full animate-pulse rounded lg:block" />
              <div className="bg-secondary h-28 w-full animate-pulse rounded" />
            </div>
            <div className="bg-secondary h-28 w-full animate-pulse rounded" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-secondary h-44 animate-pulse rounded-lg" />
          <div className="bg-secondary h-44 animate-pulse rounded-lg" />
          <div className="bg-secondary h-44 animate-pulse rounded-lg" />
          <div className="bg-secondary h-44 animate-pulse rounded-lg" />
          <div className="bg-secondary h-44 animate-pulse rounded-lg" />
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-corpo opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
