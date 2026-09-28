/**
 * **Pular para o conteúdo** — item 94, critério 6.
 *
 * Sem ele, cada rota da casca custava onze paradas de Tab antes do primeiro controle da página (seletor
 * de organização, conta e os nove itens da barra) e cada página da documentação, dezessete. É a WCAG 2.4.1,
 * nível A.
 *
 * **Um componente, dois consumidores:** `app/(casca)/layout.tsx` e `app/documentacao/layout.tsx`. A moldura
 * de T-04, `app/(foco)/`, fica sem ele, porque não tem a barra lateral (spec do 94, §5).
 *
 * Escondido até receber foco, e então no canto de cima, acima da barra superior e da cortina da gaveta
 * (`z-50`). É controle como os outros: 44 px e o contorno do `@layer base`.
 */
export const ID_DO_CONTEUDO = "conteudo";

const CLASSE =
  "sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-sm focus:bg-superficie focus:px-4 focus:text-tinta focus:text-interface focus:shadow-lg";

export function PularParaOConteudo() {
  return (
    <a href={`#${ID_DO_CONTEUDO}`} className={CLASSE}>
      Pular para o conteúdo
    </a>
  );
}
