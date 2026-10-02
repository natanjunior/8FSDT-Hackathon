import type { Page } from "@playwright/test";

/**
 * ============================================================================
 *  O transbordo horizontal, medido de três jeitos — itens 93 e 112
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
 * **A terceira é sobre controles, e o 112 é a prova dela.** A tabela de áreas media 507 px num contêiner de
 * 356, e o botão de QR ficava depois da borda dele. Nada passava da janela, porque o `Table` do catálogo
 * embrulha toda tabela num contêiner que rola, e a segunda afirmação ignora quem rola. **Dado escondido
 * atrás de rolagem é aceito; controle não é**: quem toca não sabe que ele existe. Então todo elemento
 * interativo dentro de um contêiner que rola tem de terminar antes da borda visível dele, contada com o
 * contêiner na posição inicial. Fica de fora o controle mais largo que a área visível, que não cabe em
 * posição nenhuma e se aciona pelo pedaço que aparece.
 *
 * **Este módulo não importa `mundo.ts`**, e é de propósito: `nascimento-de-organizacao.spec.ts` roda sem a
 * semente, e `mundo.ts` exige `SENHA_DA_DEMONSTRACAO` ao carregar.
 */

export interface Transbordo {
  /** `scrollWidth − clientWidth` do documento. Zero é o único valor aceito. */
  documento: number;
  /** O elemento mais externo de cada trecho que passa da borda, já escrito para a mensagem de falha. */
  alemDaBorda: string[];
  /** Controle que termina além da borda visível do contêiner que rola, com o nome dele — item 112. */
  controlesEscondidos: string[];
}

export const SEM_TRANSBORDO: Transbordo = { documento: 0, alemDaBorda: [], controlesEscondidos: [] };

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

/**
 * O que recebe foco ou ação. **É a lista do que não pode ficar atrás de rolagem**: o resto é dado, e dado a
 * mais numa tabela larga é aceito (spec 112 §3.1). O `tabindex="-1"` fica de fora porque não está na ordem
 * de foco: é alvo de script, e não de gente.
 */
const INTERATIVOS = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Meio pixel, para o arredondamento de subpixel. */
const TOLERANCIA = 0.5;

export async function transbordo(pagina: Page): Promise<Transbordo> {
  return pagina.evaluate(
    ({ seletores, interativos, tolerancia }) => {
      const raiz = document.documentElement;
      const borda = raiz.clientWidth + tolerancia;

      const rolaNaHorizontal = (elemento: Element): boolean => {
        const overflow = getComputedStyle(elemento).overflowX;
        return overflow === "auto" || overflow === "scroll";
      };
      /** O contêiner que rola mais próximo, ou `null` se o elemento não mora em nenhum. */
      const conteinerQueRola = (elemento: Element): Element | null => {
        for (
          let acima = elemento.parentElement;
          acima !== null && acima !== document.body;
          acima = acima.parentElement
        ) {
          if (rolaNaHorizontal(acima)) return acima;
        }
        return null;
      };
      const visivel = (elemento: Element, caixa: DOMRect): boolean =>
        caixa.width > 0 &&
        caixa.height > 0 &&
        getComputedStyle(elemento).visibility !== "hidden" &&
        !seletores.some((seletor) => elemento.closest(seletor) !== null);
      const descrever = (elemento: Element, direita: number): string => {
        const nome =
          elemento.getAttribute("data-slot") ??
          elemento.getAttribute("aria-label") ??
          (elemento.getAttribute("class") ?? "").split(" ").slice(0, 3).join(" ");
        return `<${elemento.tagName.toLowerCase()}> ${nome} termina em ${Math.round(direita)} px, e a borda é ${raiz.clientWidth}`;
      };
      /** O nome que identifica o controle numa linha de cinco iguais: o rótulo, e a linha que o descreve. */
      const nomeDoControle = (controle: Element): string => {
        const rotulo =
          controle.getAttribute("aria-label") ?? (controle.textContent ?? "").trim().slice(0, 40);
        const descritoPor = controle.getAttribute("aria-describedby");
        const linha =
          descritoPor === null ? "" : (document.getElementById(descritoPor)?.textContent ?? "").trim();
        return linha === "" ? `«${rotulo}»` : `«${rotulo}» de «${linha.slice(0, 40)}»`;
      };

      const acusados: Element[] = [];
      const alemDaBorda: string[] = [];
      for (const elemento of document.body.querySelectorAll("*")) {
        const caixa = elemento.getBoundingClientRect();
        if (caixa.right <= borda) continue;
        if (!visivel(elemento, caixa)) continue;
        if (conteinerQueRola(elemento) !== null) continue;
        // Só o mais externo de cada trecho: os filhos de um grupo cortado repetiriam a mesma notícia.
        if (acusados.some((acusado) => acusado.contains(elemento))) continue;
        acusados.push(elemento);
        alemDaBorda.push(descrever(elemento, caixa.right));
      }

      const controlesEscondidos: string[] = [];
      for (const controle of document.body.querySelectorAll(interativos)) {
        const caixa = controle.getBoundingClientRect();
        if (!visivel(controle, caixa)) continue;
        const conteiner = conteinerQueRola(controle);
        // Fora de contêiner que rola, a afirmação de cima já vale.
        if (conteiner === null) continue;
        // Mais largo que a área visível: não cabe em posição nenhuma, e o pedaço que aparece se aciona.
        if (caixa.width > conteiner.clientWidth) continue;
        const moldura = conteiner.getBoundingClientRect();
        const bordaVisivel = moldura.left + conteiner.clientLeft + conteiner.clientWidth;
        // Somar o `scrollLeft` mede com o contêiner na posição inicial, seja qual for a posição de agora.
        const direita = caixa.right + conteiner.scrollLeft;
        if (direita <= bordaVisivel + tolerancia) continue;
        const nomeDoConteiner = conteiner.getAttribute("data-slot") ?? conteiner.tagName.toLowerCase();
        controlesEscondidos.push(
          `${nomeDoControle(controle)} termina em ${Math.round(direita)} px, e a borda visível de ${nomeDoConteiner} é ${Math.round(bordaVisivel)}`,
        );
      }

      return { documento: raiz.scrollWidth - raiz.clientWidth, alemDaBorda, controlesEscondidos };
    },
    {
      seletores: EXCLUSOES.map((exclusao) => exclusao.seletor),
      interativos: INTERATIVOS,
      tolerancia: TOLERANCIA,
    },
  );
}
