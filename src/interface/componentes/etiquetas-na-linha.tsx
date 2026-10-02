import {
  cortarParaALinha,
  nomeDoRestante,
  type EtiquetaNaTela,
} from "@/interface/componentes/etiquetas-de-participante";
import { Badge } from "@/interface/componentes/ui/badge";

/**
 * **Duas etiquetas e "+N"**, na lista de participantes e na escolha do responsável (critérios 4 e 10).
 *
 * **O "+N" não abre nada**: o detalhe do participante mostra todas. O nome acessível dele diz quais
 * ficaram de fora, para quem usa leitor de tela não ter de abrir o detalhe para saber.
 *
 * `max-w-full` e `truncate` são o que segura 30 caracteres numa coluna estreita: a etiqueta corta com
 * reticências e o `title` mostra o nome inteiro.
 */
export function EtiquetasNaLinha({ etiquetas }: { etiquetas: readonly EtiquetaNaTela[] }) {
  if (etiquetas.length === 0) return null;
  const { visiveis, restantes } = cortarParaALinha(etiquetas);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {visiveis.map((etiqueta) => (
        <Badge
          key={etiqueta.id}
          variant="outline"
          title={etiqueta.nome}
          className="text-meta max-w-full truncate rounded-sm font-normal"
        >
          {etiqueta.nome}
        </Badge>
      ))}
      {restantes.length > 0 && (
        <span className="text-meta text-tinta-suave font-mono tabular-nums">
          <span aria-hidden="true">+{restantes.length}</span>
          <span className="sr-only">{nomeDoRestante(restantes)}</span>
        </span>
      )}
    </span>
  );
}
