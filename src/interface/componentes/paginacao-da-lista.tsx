"use client";

import type { MouseEvent } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/interface/componentes/ui/pagination";

import { useNavegacaoDaLista } from "./navegacao-da-lista";

/**
 * ============================================================================
 *  A navegação numerada de T-03 — o item 14b, desenhado
 * ============================================================================
 *
 * **O link copia `totalNoCorte`, e NUNCA `total`** — critério 44c.5. Os dois são números parecidos e a
 * troca não tem sintoma: `total` é recalculado a cada página e encolhe quando uma ocorrência sai do
 * recorte, então usá-lo aqui zera a compensação de deslocamento e a lista passa a **pular** itens,
 * respondendo `200` com vinte linhas. É por isso que o envelope devolve o eco: para o controle copiar
 * sempre o mesmo campo, em vez de escolher.
 *
 * **Os links são endereços de verdade.** Sem `href` a página deixa de ser copiável, e o endereço
 * compartilhável é metade da razão de os três parâmetros viverem na URL. O clique simples com o botão
 * principal é interceptado para navegar dentro da transição — que é o critério 44c.4 —, e clique do
 * meio, `Ctrl`, `Cmd`, `Shift` e `Alt` seguem o caminho do navegador.
 */
export function PaginacaoDaLista({
  consultaAtual,
  pagina,
  totalDePaginas,
  totalNoCorte,
  ate,
  total,
}: {
  consultaAtual: string;
  pagina: number;
  /** Já vem limitado pelo teto de página do contrato. Quem o calcula é o servidor. */
  totalDePaginas: number;
  totalNoCorte: number;
  ate: string;
  total: number;
}) {
  const { navegar } = useNavegacaoDaLista();

  function parametrosDe(destino: number): URLSearchParams {
    const proximos = new URLSearchParams(consultaAtual);
    proximos.set("pagina", String(destino));
    proximos.set("ate", ate);
    proximos.set("totalNoCorte", String(totalNoCorte));
    return proximos;
  }

  const enderecoDe = (destino: number) => `/ocorrencias?${parametrosDe(destino).toString()}`;

  function aoClicar(evento: MouseEvent<HTMLAnchorElement>, destino: number): void {
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) {
      return;
    }
    evento.preventDefault();
    navegar(parametrosDe(destino));
  }

  if (totalDePaginas <= 1) return null;

  return (
    <nav className="border-linha-suave flex flex-col items-center gap-2 border-t px-4 py-3 md:flex-row md:justify-between">
      <p className="text-meta text-tinta-suave font-mono tabular-nums">
        Página {pagina} de {totalDePaginas} · {total}{" "}
        {total === 1 ? "ocorrência no corte" : "ocorrências no corte"}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          {pagina > 1 && (
            <PaginationItem>
              <PaginationPrevious
                href={enderecoDe(pagina - 1)}
                onClick={(evento) => {
                  aoClicar(evento, pagina - 1);
                }}
              />
            </PaginationItem>
          )}

          {vizinhas(pagina, totalDePaginas).map((numero, indice) =>
            numero === null ? (
              // As reticências aparecem em duas posições no máximo — antes e depois do miolo —, então a
              // chave sai da posição e não do índice. **Índice como chave não entra neste repositório.**
              <PaginationItem key={indice === 0 ? "reticencias-antes" : "reticencias-depois"}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={numero}>
                <PaginationLink
                  href={enderecoDe(numero)}
                  isActive={numero === pagina}
                  onClick={(evento) => {
                    aoClicar(evento, numero);
                  }}
                >
                  {numero}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          {pagina < totalDePaginas && (
            <PaginationItem>
              <PaginationNext
                href={enderecoDe(pagina + 1)}
                onClick={(evento) => {
                  aoClicar(evento, pagina + 1);
                }}
              />
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>
    </nav>
  );
}

/** A primeira, a última, a atual e as vizinhas dela. `null` é reticência. */
function vizinhas(pagina: number, total: number): readonly (number | null)[] {
  const numeros = new Set<number>([1, total, pagina - 1, pagina, pagina + 1]);
  const validos = [...numeros]
    .filter((numero) => numero >= 1 && numero <= total)
    .sort((a, b) => a - b);

  const saida: (number | null)[] = [];
  let anterior = 0;
  for (const numero of validos) {
    if (anterior !== 0 && numero - anterior > 1) saida.push(null);
    saida.push(numero);
    anterior = numero;
  }
  return saida;
}
