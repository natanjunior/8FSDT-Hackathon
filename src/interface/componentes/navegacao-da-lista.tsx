"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ReactNode } from "react";

/**
 * ============================================================================
 *  Quem escreve a URL de T-03 — e o estado de espera que os três compartilham
 * ============================================================================
 *
 * **Três consumidores, um estado.** A barra de filtros, o controle de paginação e a linha de deriva
 * escrevem a mesma *query string*; o cartão precisa saber quando qualquer uma delas está em voo, para
 * desenhar o estado *atualizando* do guia §8. Com um `useTransition` por peça, o cartão não teria como
 * ler o de ninguém.
 *
 * **A navegação acontece DENTRO da transição, e é o que sustenta o critério 44c.4.** O React não revela
 * a espera de uma fronteira já montada durante uma transição, então a lista anterior fica pintada
 * enquanto a nova chega — que é o critério 14.7 como o 14b o reescreveu, e sem ele o 15.4 cai junto.
 *
 * **Este provedor tem de ficar ACIMA do `<Suspense>` da listagem, e não dentro dele.** É o que faz o
 * mecanismo inteiro funcionar: `pendente` muda de forma urgente, e a árvore **antiga** — que continua
 * pintada porque a transição ainda não concluiu — recebe o valor novo pelo contexto e escurece. Se o
 * provedor nascesse dentro da fronteira, ele seria parte do que está sendo trocado, e o estado
 * *atualizando* só apareceria depois que não houvesse mais o que atualizar. **Quem "simplificar" movendo
 * o provedor para dentro derruba o critério 44c.4 sem quebrar nenhum teste.**
 *
 * **`push`, e não `replace`:** numa tela cuja interação principal é filtrar e paginar, voltar como
 * desfazer vale mais que sair da tela num toque. O preço, dito: cada marca é uma entrada de histórico.
 * **A exceção é o campo de texto** (item 67), que passa `substituir` — ver o tipo, logo abaixo.
 *
 * **Recebe `children` do servidor e não os torna cliente.** A lista e a barra continuam renderizadas no
 * servidor; o que atravessa é o elemento pronto.
 */
type Navegacao = {
  /**
   * Escreve a *query string* e navega. Vazia vira o caminho limpo.
   *
   * **`substituir` é a exceção do texto** (item 67). Cada marca de filtro é um gesto e merece uma entrada
   * de histórico; **digitar não é**. Com `push` a cada pausa da digitação, o voltar do navegador desfaria
   * o campo de busca letra por letra em vez de sair do recorte.
   */
  navegar: (proximos: URLSearchParams, opcoes?: { substituir?: boolean }) => void;
  /** Há navegação em voo. É o insumo do estado *atualizando* do cartão. */
  pendente: boolean;
};

const Contexto = createContext<Navegacao | null>(null);

export function useNavegacaoDaLista(): Navegacao {
  const valor = useContext(Contexto);
  if (valor === null) {
    throw new Error("useNavegacaoDaLista fora de <NavegacaoDaLista>.");
  }
  return valor;
}

/**
 * **`semPaginacao` mudou de casa no item 67, e continua exportada daqui.** Ela passou para
 * `filtros-da-lista.ts`, que é puro e por isso tem teste; este arquivo é `"use client"` e não tem. O
 * reexporte existe para que os chamadores de hoje não precisem saber disso.
 */
export { semPaginacao } from "./filtros-da-lista";

export function NavegacaoDaLista({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const [pendente, comecar] = useTransition();

  function navegar(proximos: URLSearchParams, opcoes?: { substituir?: boolean }): void {
    const consulta = proximos.toString();
    const destino = consulta === "" ? caminho : `${caminho}?${consulta}`;
    comecar(() => {
      if (opcoes?.substituir === true) router.replace(destino);
      else router.push(destino);
    });
  }

  return <Contexto.Provider value={{ navegar, pendente }}>{children}</Contexto.Provider>;
}
