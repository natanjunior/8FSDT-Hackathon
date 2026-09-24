import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { AVISO_DE_AVALIACAO } from "@/interface/componentes/rotulos";
import { Alert } from "@/interface/componentes/ui/alert";

/**
 * **A faixa de avaliação de T-05** (item 66, critério 5) — a frase que explica o que a pessoa pode fazer, e
 * o botão que faz. O botão é o gatilho do `ModalDeAvaliacao`, que chega pronto por `children`: a faixa não
 * sabe enviar, e quem decide se ela aparece é `acoesDisponiveis`, na página.
 *
 * **É o único *Avaliar* da tela.** Em `resolvida`, `avaliar` sairia como primário da barra
 * (`ACAO_PRIMARIA`), e dois botões com o mesmo nome abrindo o mesmo modal é o que a página recusa: o
 * cabeçalho carrega troca de status, e avaliar não troca status (decisão de produto D1).
 *
 * **A peça é o `alert` do catálogo**, com a grade trocada por `flex`: o ícone e a frase numa linha, o botão
 * à direita, e no celular o botão desce em largura cheia. A estrela não é filha direta do `Alert`, então as
 * regras `[&>svg]` da peça não a alcançam, e a cor dela é a do token `--atencao`.
 */
export function AvisoDeAvaliacao({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-linha bg-superficie text-tinta flex flex-col gap-3 px-4 py-3 shadow-sm md:flex-row md:items-center md:gap-4">
      <div className="flex items-start gap-3 md:flex-1">
        <Star
          aria-hidden="true"
          strokeWidth={1.9}
          className="text-atencao mt-0.5 size-[18px] shrink-0"
        />
        <p className="text-corpo text-tinta">{AVISO_DE_AVALIACAO}</p>
      </div>
      <div className="w-full shrink-0 md:w-auto *:w-full">{children}</div>
    </Alert>
  );
}
