import { FRASES_DE_ESPERA } from "@/interface/componentes/frases-de-espera";
import { EsperaDaMolduraDeConta } from "@/interface/componentes/moldura-de-conta";

/**
 * **O cold start, onde ele aparece pela primeira vez** (RNF5, escala a zero).
 *
 * A primeira requisição de uma sessão tem espera nomeada, e o texto é o mesmo das outras esperas do
 * produto. **Ele não promete prazo**, o que o faz servir também para o banco pausado há sete dias: *"um
 * giro de oito segundos sem explicação lê-se como defeito, e o RNF5 declara o cold start como esperado"*.
 *
 * **A frase espera ~2 s antes de aparecer**, com atraso de animação em CSS e sem JavaScript: nesta tela
 * não há JavaScript nosso rodando ainda — é justamente a espera pelo servidor.
 *
 * **A forma é a da moldura das telas fora da casca desde o 44o.** Ela vale para as cinco faces de T-02; a
 * tela de criar organização tem a sua desde o item 103, com o convite à esquerda.
 */
export default function EsperandoOContexto() {
  return (
    <EsperaDaMolduraDeConta>
      <p
        role="status"
        className="text-tinta-suave text-interface animate-in fade-in text-center opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        {FRASES_DE_ESPERA.dentro}
      </p>
    </EsperaDaMolduraDeConta>
  );
}
