"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { ROTULO_DE_COLUNA } from "@/interface/componentes/pecas-da-tabela";
import { Button } from "@/interface/componentes/ui/button";
import { TableHead } from "@/interface/componentes/ui/table";
import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  O cabeçalho de coluna que ordena — itens 68a e 67
 * ============================================================================
 *
 * **Nasceu privado na tabela de participantes e saiu para cá no item 67**, quando a lista de ocorrências
 * passou a ordenar pela mesma gramática. Sair foi o que impediu a segunda cópia: duas setas com dois
 * comportamentos na mesma tela é o defeito que o 68a existiu para não criar.
 *
 * **Ele não sabe de coluna nem de endereço, e é por isso que serve às duas tabelas.** Quem chama já
 * calculou tudo — o sentido, o nome acessível e o que fazer no clique — com as funções puras da sua
 * própria tela. Aqui só mora a forma.
 *
 * **O nome acessível é do chamador, e não do rótulo visível.** Ele diz o que o **próximo** clique faz, e
 * a lista de ocorrências e a de participantes não dizem a mesma frase na mesma situação: lá *sem
 * ordenação* existe, aqui o terceiro estado devolve o padrão.
 */
export function CabecaQueOrdena({
  sentido,
  rotulo,
  nomeAcessivel,
  aoClicar,
  largura,
}: {
  sentido: "ascending" | "descending" | "none";
  /** O que a pessoa lê na coluna. */
  rotulo: string;
  /** O que o leitor de tela ouve: o que o próximo clique faz. */
  nomeAcessivel: string;
  aoClicar: () => void;
  largura?: string;
}) {
  const ativa = sentido !== "none";

  return (
    // `py-0`: o botão de ordenar já tem os 44 px do alvo de toque, e os 11 px do rótulo de coluna em
    // volta dele fariam a linha de cabeçalho crescer para 66 (item 44q). `group`: a seta dupla só aparece
    // com o ponteiro sobre o cabeçalho ou com o foco no botão (item 68a).
    <TableHead aria-sort={sentido} className={cn(ROTULO_DE_COLUNA, "group py-0", largura)}>
      <Button
        type="button"
        variant="ghost"
        aria-label={nomeAcessivel}
        onClick={aoClicar}
        className={cn(
          "text-rotulo-coluna h-11 w-full justify-start gap-1.5 rounded-sm px-0 font-mono uppercase hover:bg-transparent",
          ativa ? "text-tinta" : "text-tinta-suave",
        )}
      >
        {rotulo}
        {sentido === "ascending" && <ArrowUp aria-hidden="true" className="text-tinta-marca size-3" />}
        {sentido === "descending" && <ArrowDown aria-hidden="true" className="text-tinta-marca size-3" />}
        {sentido === "none" && (
          <ArrowUpDown
            aria-hidden="true"
            className="text-tinta-suave size-3 opacity-0 transition-opacity group-hover:opacity-100 group-has-focus-visible:opacity-100"
          />
        )}
      </Button>
    </TableHead>
  );
}
