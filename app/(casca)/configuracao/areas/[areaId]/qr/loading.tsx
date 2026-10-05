import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";

/**
 * O cold start do QR da área: o cabeçalho e um cartão do tamanho do QR. Mesma regra e mesmo texto das
 * outras telas (RNF5): *"qualquer requisição que passe de ~2 s ganha o texto"*, e o texto **não promete
 * prazo**. Sem este arquivo, a navegação da lista para o QR mostraria o esqueleto da tabela de áreas.
 */
export default function EsperandoOQrDaArea() {
  return (
    <div className="flex flex-col gap-5.5">
      <div aria-hidden className="flex flex-col gap-5.5">
        <div className="flex flex-col gap-2">
          <div className="bg-secondary h-7 w-[26%] animate-pulse rounded" />
          <div className="bg-secondary h-4 w-[62%] animate-pulse rounded" />
        </div>

        <div className="border-linha bg-superficie flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
          <div className="bg-secondary size-56 animate-pulse rounded-sm" />
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
