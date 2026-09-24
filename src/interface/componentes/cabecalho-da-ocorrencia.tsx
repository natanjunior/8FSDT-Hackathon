import type { ReactNode } from "react";

import { SeloDeStatus } from "@/interface/componentes/selo-de-status";

/**
 * ============================================================================
 *  O cabeçalho de T-05 — título, selo e ações numa faixa só (item 66)
 * ============================================================================
 *
 * **A grade é o que segura o critério 66.1.** A partir de `md`, duas colunas: o título com o selo à
 * esquerda, em `minmax(0,1fr)`, e as ações à direita, em `auto`. O título tem `min-w-0` e `truncate`, então
 * é ele quem cede, e as ações nunca saem da tela. **Abaixo de `md` o título quebra**, com `break-words`
 * para palavra sem espaço: as ações já vão para a linha de baixo, e cortar ali deixaria o resto do título
 * só no `title`, que não existe em toque.
 *
 * **As ações chegam prontas por `acoes`** — é a `BarraDeAcoes`, que a partir de `md` é `display: contents`
 * e se encaixa sozinha nesta grade: os botões na coluna 2 da linha 1, a frase do `409` na linha 2 inteira.
 *
 * **O selo mora num grupo nomeado *Situação*, e só ele.** É o escopo do teste de ponta a ponta (a emenda
 * de teste do item 66): fora do grupo ficam o título, que é texto livre, e os botões. O nome não se vê, e
 * o leitor de tela ouve *"Situação, Em análise"*.
 *
 * **O vazio** (`vazioDaBarra`) ocupa o lugar das ações quando não há nenhuma. **Componente de servidor.**
 */
export function CabecalhoDaOcorrencia({
  titulo,
  status,
  statusRotulo,
  acoes,
  vazio,
}: {
  titulo: string;
  status: string;
  statusRotulo: string;
  acoes: ReactNode;
  vazio: string | null;
}) {
  return (
    <header className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-6">
      <div className="flex min-w-0 flex-col gap-2 md:col-start-1 md:row-start-1 md:flex-row md:items-center md:gap-3">
        <h1 title={titulo} className="text-titulo-pagina text-tinta min-w-0 break-words md:truncate">
          {titulo}
        </h1>
        <div role="group" aria-label="Situação" className="w-fit shrink-0">
          <SeloDeStatus status={status} rotulo={statusRotulo} />
        </div>
      </div>
      {acoes}
      {vazio !== null && (
        <p className="text-meta text-tinta-suave md:col-start-2 md:row-start-1 md:text-right">{vazio}</p>
      )}
    </header>
  );
}
