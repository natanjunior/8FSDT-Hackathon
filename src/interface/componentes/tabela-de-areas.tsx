"use client";

import {
  LEGENDA_DOS_TIPOS,
  TEXTOS_DA_TABELA,
  rotuloDoTipo,
} from "@/interface/componentes/frases-da-configuracao";
import { ListaDeOrdemManual } from "@/interface/componentes/lista-de-ordem-manual";
import { ModalDeArea } from "@/interface/componentes/modal-de-area";
import { SituacaoDoItem } from "@/interface/componentes/situacao-do-item";
import { TableCell, TableHead } from "@/interface/componentes/ui/table";
import type { AreaProjetada } from "@/interface/projecoes";

/**
 * **T-14 · a tabela de áreas** — o que é próprio desta lista, vestindo `ListaDeOrdemManual`.
 *
 * **A legenda dos dois tipos fica fixa no cartão** (critério 9) e **nunca em dica de ponteiro**, que é o
 * compromisso A-6: o tipo decide quem enxerga a ocorrência registrada ali, e uma explicação que só
 * aparece com o ponteiro não existe no toque.
 *
 * **Abaixo de `md` as colunas *Tipo* e da situação somem**, e as duas palavras aparecem na segunda linha
 * da célula do nome.
 */
const ROTULO_DE_COLUNA =
  "text-rotulo-coluna text-tinta-fraca bg-background h-auto px-4 py-0 font-mono uppercase";

export function TabelaDeAreas({
  itens,
  organizacaoId,
}: {
  readonly itens: readonly AreaProjetada[];
  readonly organizacaoId: string;
}) {
  return (
    <ListaDeOrdemManual<AreaProjetada>
      lista="areas"
      itens={itens}
      organizacaoId={organizacaoId}
      legenda={LEGENDA_DOS_TIPOS}
      colunasProprias={1}
      cabecalhosProprios={
        <TableHead className={`${ROTULO_DE_COLUNA} hidden w-[180px] py-2.5 md:table-cell`}>
          {TEXTOS_DA_TABELA.tipo}
        </TableHead>
      }
      celulasProprias={(area) => (
        <TableCell className="text-interface hidden px-4 py-2.5 md:table-cell">
          {rotuloDoTipo(area.tipo)}
        </TableCell>
      )}
      nomeDaLinha={(area) => area.nome}
      resumoNoCelular={(area) =>
        `${rotuloDoTipo(area.tipo)} · ${area.ativa ? TEXTOS_DA_TABELA.ativa : TEXTOS_DA_TABELA.inativa}`
      }
      acaoDeEditar={(area, idDoNome) => (
        <ModalDeArea
          modo="editar"
          organizacaoId={organizacaoId}
          descritoPor={idDoNome}
          area={{ id: area.id, nome: area.nome, tipo: area.tipo }}
        />
      )}
      acaoDeSituacao={(area, idDoNome, ehUltimaAtiva) => (
        <SituacaoDoItem
          lista="areas"
          id={area.id}
          nome={area.nome}
          ativa={area.ativa}
          ehUltimaAtiva={ehUltimaAtiva}
          organizacaoId={organizacaoId}
          descritoPor={idDoNome}
        />
      )}
    />
  );
}
