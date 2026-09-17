"use client";

import { TEXTOS_DA_TABELA } from "@/interface/componentes/frases-da-configuracao";
import { IconeDeCategoria } from "@/interface/componentes/icone-de-categoria";
import { ListaDeOrdemManual } from "@/interface/componentes/lista-de-ordem-manual";
import { ModalDeCategoria } from "@/interface/componentes/modal-de-categoria";
import { SituacaoDoItem } from "@/interface/componentes/situacao-do-item";
import type { CategoriaProjetada } from "@/interface/projecoes";

/**
 * **T-09 · a tabela de categorias** — o que é próprio desta lista, vestindo `ListaDeOrdemManual`.
 *
 * **O ícone vai ao lado do nome, e não há coluna *Ícone***: uma coluna inteira de desenho seria o
 * marcador sem palavra que o compromisso A-5 proíbe, com um cabeçalho que não descreve o conteúdo. O
 * desenho já nasce `aria-hidden` dentro de `IconeDeCategoria`.
 *
 * **Abaixo de `md` a coluna da situação some**, e a palavra aparece na segunda linha da célula do nome.
 */
export function TabelaDeCategorias({
  itens,
  organizacaoId,
}: {
  readonly itens: readonly CategoriaProjetada[];
  readonly organizacaoId: string;
}) {
  return (
    <ListaDeOrdemManual<CategoriaProjetada>
      lista="categorias"
      itens={itens}
      organizacaoId={organizacaoId}
      nomeDaLinha={(categoria) => (
        <span className="flex items-center gap-2">
          <IconeDeCategoria nome={categoria.icone} className="text-tinta-suave size-4 shrink-0" />
          {categoria.nome}
        </span>
      )}
      resumoNoCelular={(categoria) =>
        categoria.ativa ? TEXTOS_DA_TABELA.ativa : TEXTOS_DA_TABELA.inativa
      }
      acaoDeEditar={(categoria, idDoNome) => (
        <ModalDeCategoria
          modo="editar"
          organizacaoId={organizacaoId}
          descritoPor={idDoNome}
          categoria={{ id: categoria.id, nome: categoria.nome, icone: categoria.icone }}
        />
      )}
      acaoDeSituacao={(categoria, idDoNome, ehUltimaAtiva) => (
        <SituacaoDoItem
          lista="categorias"
          id={categoria.id}
          nome={categoria.nome}
          ativa={categoria.ativa}
          ehUltimaAtiva={ehUltimaAtiva}
          organizacaoId={organizacaoId}
          descritoPor={idDoNome}
        />
      )}
    />
  );
}
