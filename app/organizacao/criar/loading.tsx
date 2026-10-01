import { EsperaDaMolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/**
 * **A espera da tela de criar organização** (item 103, critério 5). Até o item 103 ela herdava a de T-02,
 * de coluna única, e a tela resolvia numa fileira de 960 px com o convite à esquerda: o layout saltava.
 * O `loading.tsx` de um segmento não sabe qual filho está servindo, e por isso a forma certa só chega com
 * um arquivo no filho.
 */
export default function EsperandoACriacao() {
  return (
    <EsperaDaMolduraDeConta convite={{ lado: "esquerda" }}>
      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in text-center opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </EsperaDaMolduraDeConta>
  );
}
