import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";

/**
 * O cold start de T-06 (RNF5, escala a zero) — mesma regra e mesmo texto das outras telas: *"qualquer
 * requisição que passe de ~2 s ganha o texto"*, e o texto **não promete prazo**.
 *
 * **O cabeçalho já está aqui, e é o mesmo componente da página**: ele não depende da resposta. O que
 * depende — o título da ocorrência, o selo e a contagem — fica em barra cinza, e a contagem **não aparece**
 * porque prometer um número antes de saber é o que o estado de espera existe para não fazer.
 *
 * **Quatro registros em barra, com a marca do trilho**, e eles **não prometem quantidade**: só o registro
 * de criação é garantido (premissa P1).
 */
export default function EsperandoATrilha() {
  return (
    <div className="flex flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Trilha de auditoria"
        fato={<span aria-hidden="true" className="bg-secondary mt-1 block h-4 w-[46%] animate-pulse rounded" />}
      />

      <div className="border-linha bg-superficie rounded-lg border shadow-sm">
        <div aria-hidden="true" className="flex flex-col px-[15px] py-4 md:px-[18px] md:py-5">
          {[86, 62, 92, 48].map((largura, indice) => (
            <div key={largura} className="relative flex gap-3 pb-5 last:pb-0">
              {indice < 3 && <span className="bg-linha-suave absolute top-7 bottom-0 left-[12px] w-px" />}
              <span className="border-linha bg-secondary size-[26px] shrink-0 animate-pulse rounded-full border" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
                <div className="bg-secondary h-3 w-24 animate-pulse rounded" />
                <div className="bg-secondary h-3 animate-pulse rounded" style={{ width: `${String(largura)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-interface opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
