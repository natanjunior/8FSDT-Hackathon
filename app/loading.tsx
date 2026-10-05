import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";
import { EsperaDaMolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/**
 * **A espera da raiz** (item 103, critério 4). `/` é o losango: despacha para T-01, T-02 ou T-03, ou fica
 * em T-10, que é a única tela que ele desenha — e T-10 mora na moldura das telas fora da casca. É também o
 * destino de toda troca de organização, e o `start_url` do manifesto.
 *
 * **O `loading.tsx` da raiz vale para todo filho que não tenha o seu** (`loading.md:76`). As telas da
 * casca têm o delas, e as quatro de conta passaram a ter no mesmo item.
 *
 * O atraso de 2 s em CSS é o de `app/organizacao/loading.tsx`, pela mesma razão: nesta tela
 * não há JavaScript nosso rodando ainda.
 */
export default function EsperandoARaiz() {
  return (
    <EsperaDaMolduraDeConta>
      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in text-center opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        {FRASES_DE_ESPERA.porta}
      </p>
    </EsperaDaMolduraDeConta>
  );
}
