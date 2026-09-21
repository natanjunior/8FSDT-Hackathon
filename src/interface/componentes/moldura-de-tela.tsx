import type { ReactNode } from "react";

/**
 * A moldura de **T-02 · Sem organização ativa** e de **T-10 · Vínculo sem permissões**.
 *
 * **Ela já foi a moldura das telas de credencial**, e deixou de ser no item 44m: T-01, T-11, T-12 e T-13
 * passaram para a `MolduraDeConta`, que tem marca com ícone, cartão e segunda coluna. **As duas telas que
 * sobraram não foram redesenhadas** — elas têm item próprio quando chegar a vez, e até lá esta moldura
 * fica como está, com os três tamanhos soltos que o critério 44m.3 não alcança.
 *
 * O `Aviso`, que morava aqui, foi para `campo.tsx` no mesmo item.
 */
export function MolduraDeTela({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-6 pt-10 pb-12">
      <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
      <h1 className="text-tinta text-xl leading-snug font-semibold">{titulo}</h1>
      {children}
    </main>
  );
}
