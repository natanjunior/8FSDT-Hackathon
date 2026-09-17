import { filtrarPeloNome } from "@/interface/componentes/linhas-de-participantes";
import { anuncioDeMovimento, moverItem } from "@/interface/componentes/ordem-manual";

/**
 * ============================================================================
 *  As regras das listas de ordem manual — T-09 e T-14, item 44k
 * ============================================================================
 *
 * **Sem React.** A decisão inteira das duas telas mora aqui, e o gancho `use-ordem-gravada.ts` só liga
 * os efeitos ao React e ao `fetch`. É a mesma forma de `cicloDoModal` (44g) e de `ordem-manual.ts`
 * (44j): o projeto não tem biblioteca de teste de componente (ADR-0008), e o ciclo da ordem gravada é a
 * regra mais fácil de quebrar da tela.
 *
 * **O que é reusado, e não copiado:** `moverItem` e `anuncioDeMovimento` de `ordem-manual.ts`, e
 * `filtrarPeloNome` de `linhas-de-participantes.ts`, que já é genérica e já casa por prefixo de palavra,
 * sem acento e sem caixa.
 */

export type Filtro = "todas" | "ativas" | "inativas";

export const FILTROS: readonly Filtro[] = ["todas", "ativas", "inativas"];

/** O mínimo que as duas listas têm em comum. Categoria traz o ícone; área, o tipo. */
export type ItemDaLista = { readonly id: string; readonly nome: string; readonly ativa: boolean };

/**
 * As contagens das três abas, **sempre do conjunto inteiro**. A busca muda o que a tabela mostra, nunca
 * o que o contador afirma — é o *"o contador não mente"* do 44j.
 */
export function contagensDoFiltro(itens: readonly ItemDaLista[]): Readonly<Record<Filtro, number>> {
  const ativas = itens.filter((item) => item.ativa).length;
  return { todas: itens.length, ativas, inativas: itens.length - ativas };
}

export function pertenceAoFiltro(item: ItemDaLista, filtro: Filtro): boolean {
  if (filtro === "todas") return true;
  return filtro === "ativas" ? item.ativa : !item.ativa;
}

/**
 * **A ordem só se muda com a lista inteira** (critério 2): o `PUT` do item 50 recebe todos os ids, e não
 * um pedaço. Com filtro ou busca ativos, alça e setas ficam inertes, e a barra do cartão escreve por quê
 * antes do clique.
 */
export function ordemInerte(filtro: Filtro, busca: string): boolean {
  return filtro !== "todas" || busca.trim() !== "";
}

export type EstadoDaLista = "lista" | "vazio-do-filtro" | "busca-vazia" | "lista-vazia";

/**
 * Qual vazio mostrar, e **a busca ganha do filtro**: foi o último gesto, e é o que a pessoa consegue
 * desfazer. Trocar uma frase pela outra faz o Gestor pensar que perdeu dados.
 *
 * **Não há paginação**, logo não há *página além do fim* — o quarto estado do guia §8 não existe aqui.
 */
export function estadoDaLista(entrada: {
  readonly total: number;
  readonly noFiltro: number;
  readonly encontradas: number;
  readonly busca: string;
}): EstadoDaLista {
  if (entrada.total === 0) return "lista-vazia";
  if (entrada.busca.trim() !== "" && entrada.encontradas === 0) return "busca-vazia";
  if (entrada.noFiltro === 0) return "vazio-do-filtro";
  return "lista";
}

/**
 * **A posição é sempre a da lista inteira**, em qualquer filtro e com qualquer busca. Renumerar de 1 a k
 * na vista filtrada diria que a categoria inativa nº 8 virou nº 6 — e a lista que se grava é a inteira.
 * Com filtro aplicado os números saltam, e é isso que é verdade.
 */
export function posicaoNaLista(itens: readonly ItemDaLista[], id: string): number {
  return itens.findIndex((item) => item.id === id) + 1;
}

/** A vista de uma aba com uma busca: o que a tabela desenha, na ordem da lista inteira. */
export function vistaDaLista<T extends ItemDaLista>(
  itens: readonly T[],
  filtro: Filtro,
  busca: string,
): readonly T[] {
  return filtrarPeloNome(
    itens.filter((item) => pertenceAoFiltro(item, filtro)),
    busca,
  );
}

/**
 * ============================================================================
 *  O ciclo da ordem gravada
 * ============================================================================
 *
 * **Duas listas.** A `confirmada` é a última que o servidor devolveu, ou a que a página entregou; a
 * `naTela` é a otimista. Mover muda a `naTela` na hora, porque *"o movimento da linha é a resposta"*
 * (critério 3).
 *
 * **Há no máximo uma escrita em voo.** Se a pessoa mover de novo antes da resposta, a `naTela` continua
 * andando e, quando a resposta chegar, sai **uma** escrita a mais com a lista de agora. **Por que não
 * travar tudo durante a escrita:** no *free tier* a primeira escrita depois de ociosidade paga o cold
 * start, medido em 20,7 s; subir um item cinco posições com as setas travadas seriam cinco esperas
 * visíveis.
 *
 * **A geração sobe a cada semeadura**, e resposta de geração velha não muda nada: a página pode trazer
 * lista nova enquanto uma escrita está em voo, e sem a geração a resposta velha sobrescreveria o que
 * acabou de chegar.
 */
export type EstadoDaOrdem<T extends { readonly id: string }> = {
  readonly confirmada: readonly T[];
  readonly naTela: readonly T[];
  /** Os ids em voo. `null` é *nenhuma escrita em voo*. */
  readonly enviados: readonly string[] | null;
  readonly geracao: number;
};

export type EventoDaOrdem<T extends { readonly id: string }> =
  | { readonly tipo: "semeou"; readonly itens: readonly T[] }
  | { readonly tipo: "moveu"; readonly de: number; readonly para: number }
  | { readonly tipo: "respondeu-ok"; readonly geracao: number; readonly itens: readonly T[] }
  | {
      readonly tipo: "respondeu-erro";
      readonly geracao: number;
      readonly aviso: string;
      readonly desatualizada: boolean;
    };

export type EfeitoDaOrdem =
  | { readonly tipo: "gravar"; readonly ids: readonly string[]; readonly geracao: number }
  | { readonly tipo: "anunciar"; readonly texto: string }
  | { readonly tipo: "avisar-erro"; readonly aviso: string }
  | { readonly tipo: "recarregar" };

export type PassoDaOrdem<T extends { readonly id: string }> = {
  readonly estado: EstadoDaOrdem<T>;
  readonly efeitos: readonly EfeitoDaOrdem[];
};

function ids(itens: readonly { readonly id: string }[]): readonly string[] {
  return itens.map((item) => item.id);
}

function mesmaOrdem(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, indice) => id === b[indice]);
}

/**
 * Os itens do servidor, na ordem da tela. **É total quando os conjuntos coincidem**, e o `200` do item 50
 * garante que coincidem: conjunto diferente é `409 LISTA_DESATUALIZADA` (contrato §8.1). Ela devolve os
 * itens do servidor, e é isso que mantém nome, ícone e situação frescos depois de uma escrita.
 */
function reordenarPor<T extends { readonly id: string }>(
  itens: readonly T[],
  ordem: readonly string[],
): readonly T[] {
  const porId = new Map(itens.map((item) => [item.id, item]));
  const naOrdem = ordem.map((id) => porId.get(id)).filter((item): item is T => item !== undefined);
  const vistos = new Set(naOrdem.map((item) => item.id));
  return [...naOrdem, ...itens.filter((item) => !vistos.has(item.id))];
}

export function semearOrdem<T extends { readonly id: string }>(itens: readonly T[]): EstadoDaOrdem<T> {
  return { confirmada: itens, naTela: itens, enviados: null, geracao: 0 };
}

export function cicloDaOrdem<T extends { readonly id: string }>(
  estado: EstadoDaOrdem<T>,
  evento: EventoDaOrdem<T>,
): PassoDaOrdem<T> {
  switch (evento.tipo) {
    case "semeou":
      return {
        estado: {
          confirmada: evento.itens,
          naTela: evento.itens,
          enviados: null,
          geracao: estado.geracao + 1,
        },
        efeitos: [],
      };

    case "moveu": {
      const naTela = moverItem(estado.naTela, evento.de, evento.para);
      if (naTela === estado.naTela) return { estado, efeitos: [] };
      const efeitos: EfeitoDaOrdem[] = [
        { tipo: "anunciar", texto: anuncioDeMovimento(evento.para + 1, naTela.length) },
      ];
      // A fila é de uma: havendo escrita em voo, a de agora sai quando a resposta chegar.
      if (estado.enviados === null) {
        efeitos.push({ tipo: "gravar", ids: ids(naTela), geracao: estado.geracao });
      }
      return {
        estado: { ...estado, naTela, enviados: estado.enviados ?? ids(naTela) },
        efeitos,
      };
    }

    case "respondeu-ok": {
      if (evento.geracao !== estado.geracao) return { estado, efeitos: [] };
      const daTela = ids(estado.naTela);
      if (estado.enviados !== null && mesmaOrdem(daTela, estado.enviados)) {
        return {
          estado: { ...estado, confirmada: evento.itens, naTela: evento.itens, enviados: null },
          efeitos: [],
        };
      }
      const naTela = reordenarPor(evento.itens, daTela);
      return {
        estado: { ...estado, confirmada: evento.itens, naTela, enviados: ids(naTela) },
        efeitos: [{ tipo: "gravar", ids: ids(naTela), geracao: estado.geracao }],
      };
    }

    case "respondeu-erro": {
      if (evento.geracao !== estado.geracao) return { estado, efeitos: [] };
      const efeitos: EfeitoDaOrdem[] = [{ tipo: "avisar-erro", aviso: evento.aviso }];
      if (evento.desatualizada) efeitos.push({ tipo: "recarregar" });
      return { estado: { ...estado, naTela: estado.confirmada, enviados: null }, efeitos };
    }
  }
}
