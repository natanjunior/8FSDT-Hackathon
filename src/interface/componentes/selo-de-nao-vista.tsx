import { Badge } from "@/interface/componentes/ui/badge";

import { SELO_NAO_VISTA } from "./rotulos";

/**
 * **A linha que quem recebeu ainda não abriu** — item 88.
 *
 * **Contorno, e não preenchimento.** Ele fica na mesma linha que o `SeloDeStatus`, e *Aberta* já veste o
 * preenchimento da marca: dois cheios de marca lado a lado se leem como uma coisa só. *"O selo de status é
 * a peça cheia da linha, e nenhuma outra é"* continua verdadeiro.
 *
 * **A borda leva a marca; o texto, a tinta.** `--accent` como texto mede 3,57:1 no tema claro, abaixo do
 * piso — é o achado que o item 89 conserta. Borda não é texto e tem piso de 3:1, que ela passa nos dois
 * temas.
 *
 * **Peça do catálogo, e não um componente novo de desenho:** a mesma `Badge` da prioridade e do status.
 */
export function SeloDeNaoVista() {
  return (
    <Badge variant="outline" className="border-marca text-tinta bg-transparent">
      {SELO_NAO_VISTA}
    </Badge>
  );
}
