import { NotebookPen } from "lucide-react";

import { cn } from "@/interface/componentes/utilitarios";

/**
 * **A marca do produto, e ela é uma só.**
 *
 * O ícone mais o rótulo no sétimo papel da escala — mono, versal, `tracking-[0.11em]` (guia §3). O
 * `NotebookPen` é o que a direção do guia §1 descreve: *"o livro de ocorrências"*, o objeto da portaria
 * em que se escreve, se data e se assina.
 *
 * **Dois consumidores, e é por isso que ela é peça:** a barra superior de dentro do produto e a moldura
 * das telas de conta. Até o item 44m a barra escrevia a marca à mão e não tinha ícone; duas marcas
 * diferentes para o mesmo produto é o defeito que este arquivo existe para impedir.
 *
 * **Componente de servidor.**
 */
export function MarcaDoProduto({ className }: { className?: string }) {
  return (
    <span className={cn("text-marca flex items-center gap-2", className)}>
      <NotebookPen aria-hidden="true" className="size-4 shrink-0" />
      <span className="text-rotulo-coluna font-mono font-medium tracking-[0.11em] uppercase">
        Resolve Aí
      </span>
    </span>
  );
}
