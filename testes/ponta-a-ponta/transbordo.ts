import type { Page } from "@playwright/test";

/**
 * ============================================================================
 *  O transbordo horizontal, medido de dois jeitos — item 93
 * ============================================================================
 *
 * **`scrollWidth === clientWidth` não basta, e o 93 é a prova.** O `Cartao` recorta o que passa dele
 * (`overflow-hidden`), e o que é recortado não cria rolagem no documento. O código da organização saiu
 * cortado a 360, 390 e 414 px com as duas medidas antigas verdes: a do 92.2 e a do 86.7.
 *
 * **A segunda afirmação é sobre elementos**: nenhum elemento visível termina além da borda direita da
 * janela. Ficam de fora o que não tem área, o que está escondido, e o que mora dentro de um contêiner que
 * rola na horizontal, porque esse se alcança rolando. O resto da lista de exclusões está em `EXCLUSOES`, e
 * cada linha diz por quê.
 *
 * **Este módulo não importa `mundo.ts`**, e é de propósito: `nascimento-de-organizacao.spec.ts` roda sem a
 * semente, e `mundo.ts` exige `SENHA_DA_DEMONSTRACAO` ao carregar.
 */

export interface Transbordo {
  /** `scrollWidth − clientWidth` do documento. Zero é o único valor aceito. */
  documento: number;
  /** O elemento mais externo de cada trecho que passa da borda, já escrito para a mensagem de falha. */
  alemDaBorda: string[];
}

export const SEM_TRANSBORDO: Transbordo = { documento: 0, alemDaBorda: [] };

/**
 * Seletores que a medida ignora, com a razão. **Nenhum entra por padrão genérico**: a lista nasce vazia, e
 * só cresce com o que a medida acusou e não é defeito.
 */
const EXCLUSOES: ReadonlyArray<{ seletor: string; razao: string }> = [
  {
    seletor: ".sr-only",
    razao:
      "a lista para leitor de tela do `GraficoDeBarras` é uma caixa de 1 px com `overflow: hidden` e " +
      "`clip-path: inset(50%)`; o texto dentro dela mede a largura que quiser e não aparece na tela. " +
      "A medida acusou o `<span>` de `4 · 4 há mais de 7 dias` no painel a 390 px, e ele é invisível " +
      "por recorte, que é o meio que esta medida não lê.",
  },
];

/** Meio pixel, para o arredondamento de subpixel. */
const TOLERANCIA = 0.5;

export async function transbordo(pagina: Page): Promise<Transbordo> {
  return pagina.evaluate(
    ({ seletores, tolerancia }) => {
      const raiz = document.documentElement;
      const borda = raiz.clientWidth + tolerancia;

      const rolaNaHorizontal = (elemento: Element): boolean => {
        const overflow = getComputedStyle(elemento).overflowX;
        return overflow === "auto" || overflow === "scroll";
      };
      const alcancaRolando = (elemento: Element): boolean => {
        for (
          let acima = elemento.parentElement;
          acima !== null && acima !== document.body;
          acima = acima.parentElement
        ) {
          if (rolaNaHorizontal(acima)) return true;
        }
        return false;
      };
      const descrever = (elemento: Element, direita: number): string => {
        const nome =
          elemento.getAttribute("data-slot") ??
          elemento.getAttribute("aria-label") ??
          (elemento.getAttribute("class") ?? "").split(" ").slice(0, 3).join(" ");
        return `<${elemento.tagName.toLowerCase()}> ${nome} termina em ${Math.round(direita)} px, e a borda é ${raiz.clientWidth}`;
      };

      const acusados: Element[] = [];
      const alemDaBorda: string[] = [];
      for (const elemento of document.body.querySelectorAll("*")) {
        const caixa = elemento.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0) continue;
        if (caixa.right <= borda) continue;
        if (getComputedStyle(elemento).visibility === "hidden") continue;
        if (seletores.some((seletor) => elemento.closest(seletor) !== null)) continue;
        if (alcancaRolando(elemento)) continue;
        // Só o mais externo de cada trecho: os filhos de um grupo cortado repetiriam a mesma notícia.
        if (acusados.some((acusado) => acusado.contains(elemento))) continue;
        acusados.push(elemento);
        alemDaBorda.push(descrever(elemento, caixa.right));
      }

      return { documento: raiz.scrollWidth - raiz.clientWidth, alemDaBorda };
    },
    { seletores: EXCLUSOES.map((exclusao) => exclusao.seletor), tolerancia: TOLERANCIA },
  );
}
