import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Combina classes utilitárias resolvendo conflitos — o `cn` que o `shadcn/ui` espera encontrar.
 *
 * Vive em `interface/componentes/` porque é infraestrutura de estilo, não de dados: a ADR-0007 escolheu
 * Tailwind justamente para que *"estilo declarado no próprio componente elimine a folha de estilo global
 * como lugar onde regras colidem"*, e esta função é o que torna isso composável.
 *
 * ---------------------------------------------------------------------------
 *  Por que o `twMerge` precisa ser ESTENDIDO — e o que acontecia sem isto
 * ---------------------------------------------------------------------------
 *
 * **Ele não lê o `@theme` do projeto.** Os sete papéis da escala são nomes nossos, e o dicionário de
 * sufixos do `tailwind-merge` não os conhece: `text-interface` cai no grupo genérico de **cor de texto**
 * e colide com `text-marca-foreground`, que é cor de verdade. Medido, com o pacote deste repositório:
 *
 * ```
 * twMerge("bg-marca text-marca-foreground text-sm", "text-interface")
 *   → "bg-marca text-sm text-interface"
 * ```
 *
 * A cor **some**, e o `text-sm` do catálogo — que está fora da escala — **sobrevive**. Os dois avessos do
 * que se queria. Declarar os sete como `font-size` conserta os dois lados de uma vez: a cor atravessa, e
 * o papel da escala passa a vencer o `text-sm`, que é o trabalho que a escala existe para fazer.
 */
const mesclar = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "titulo-pagina",
            "titulo-bloco",
            "titulo-linha",
            "corpo",
            "interface",
            "meta",
            "rotulo-coluna",
          ],
        },
      ],
    },
  },
});

export function cn(...entradas: ClassValue[]): string {
  return mesclar(clsx(entradas));
}
