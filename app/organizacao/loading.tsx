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
 * **A forma é a da moldura das telas fora da casca desde o 44o**, e vale para os dois filhos do segmento:
 * as cinco faces de T-02 e a tela de criar organização.
 */
export default function EsperandoOContexto() {
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
