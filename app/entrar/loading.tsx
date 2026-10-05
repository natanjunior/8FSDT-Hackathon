import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";
import { EsperaDaMolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/**
 * **A espera da porta** (item 103, critério 4): a primeira requisição de uma sessão cai aqui, e é aqui que
 * o cold start do RNF5 aparece pela primeira vez.
 *
 * **Com a apresentação**, porque T-01 é uma linha de duas colunas a partir de `lg`: uma espera de coluna
 * única saltaria de forma quando a tela chegasse. O pé de T-01 fica de fora, porque é absoluto e não ocupa
 * lugar na linha.
 */
export default function EsperandoAPorta() {
  return (
    <EsperaDaMolduraDeConta apresentacao>
      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in text-center opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        {FRASES_DE_ESPERA.porta}
      </p>
    </EsperaDaMolduraDeConta>
  );
}
