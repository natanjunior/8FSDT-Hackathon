import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";
import { EsperaDaMolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/** **A espera de T-11** (item 103, critério 4), com a frase e o atraso de `app/organizacao/loading.tsx`. */
export default function EsperandoOCadastro() {
  return (
    <EsperaDaMolduraDeConta apresentacao>
      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in text-center opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        {FRASES_DE_ESPERA.dentro}
      </p>
    </EsperaDaMolduraDeConta>
  );
}
