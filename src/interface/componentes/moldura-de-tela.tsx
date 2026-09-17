import type { ReactNode } from "react";

import { ErroDoFormulario } from "@/interface/componentes/campo";

/**
 * A moldura das telas de celular.
 *
 * O protótipo desenha as duas telas da fatia com a mesma forma — marca, título, e uma coluna de campos que
 * cabe sem rolar (`docs/prototipo/telas.html`, T-01 e T-02). Escrito uma vez, pela razão que o próprio
 * protótipo declara: *"duas cópias divergem na primeira alteração, e a divergente é pior que a ausente"*.
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

/**
 * A linha de aviso acima do formulário das telas de credencial e de T-02.
 *
 * **`tom="recusa"` desenha o mesmo erro que o resto do produto** (`ErroDoFormulario`, item 44g). Até ali
 * ele pintava o erro com a cor da identidade, e o produto tinha dois desenhos para a mesma coisa.
 * `tom="nota"` é o aviso que não é erro: *"Conta confirmada."*, *"Você já está em …"*. A diferença entre
 * os dois é de forma e de ícone, não de cor sozinha (A-5).
 */
export function Aviso({ tom = "recusa", children }: { tom?: "recusa" | "nota"; children: ReactNode }) {
  if (tom === "recusa") return <ErroDoFormulario>{children}</ErroDoFormulario>;

  return (
    <p role="alert" className="border-linha bg-superficie text-tinta-suave rounded-md border px-3 py-2.5 text-sm">
      {children}
    </p>
  );
}
