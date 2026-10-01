import { EsperaDaMolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/** **A espera de T-11** (item 103, critério 4), com a frase e o atraso de `app/organizacao/loading.tsx`. */
export default function EsperandoOCadastro() {
  return (
    <EsperaDaMolduraDeConta>
      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in text-center opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </EsperaDaMolduraDeConta>
  );
}
