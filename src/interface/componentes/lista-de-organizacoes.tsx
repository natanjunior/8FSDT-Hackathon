import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { IndicadorDeEnvio } from "@/interface/componentes/campo";

/**
 * ============================================================================
 *  A lista de organizações — uma forma só, critério 44o.10
 * ============================================================================
 *
 * **Três consumidores, e uma forma.** A face D de T-02 e T-10 listam vínculos que **levam a algum lugar**
 * — trocar de organização —, e a face E lista pedidos, que **não levam**. O que se compartilha é a forma:
 * a casca da lista e o conteúdo da linha. O comportamento fica com quem consome: a troca mora na
 * `EscolhaDeOrganizacao`, de cliente, e a lista de pedidos da face E é de servidor inteira.
 *
 * **Sem a diretiva de cliente, e é por isso que este arquivo existe separado de
 * `escolha-de-organizacao.tsx`.** Um módulo que a declara faz de toda exportação um componente de
 * cliente — e a guarda do critério 44o.10 procura a diretiva por texto, então nem em comentário ela
 * pode aparecer aqui.
 *
 * **A seta diz que a linha leva a algum lugar**, e só aparece onde leva. É o `ChevronRight`, o mesmo que
 * o catálogo usa para "entrar" no `breadcrumb`, na paginação e no submenu. `aria-hidden`: ela não entra no
 * nome acessível da linha, que continua sendo o nome e o apoio — e é por isso que o teste de ponta a ponta
 * continua achando a linha pelo nome da organização (critério 44o.12).
 *
 * **O apoio é sempre palavra** — o papel, ou a situação com a data —, nunca só cor (compromisso A-5).
 *
 * **Componentes de servidor.**
 */

/**
 * Um vínculo como a lista o recebe. **O nome vem de quando esta lista era um menu**, e ficou: renomear
 * tocaria a barra superior e o seletor sem mudar comportamento (spec do 44o, §3.5).
 */
export type VinculoNoMenu = {
  organizacaoId: string;
  nome: string;
  papel: string;
};

/**
 * A casca da lista: borda, régua entre as linhas, e cantos que não vazam. **O rótulo é opcional** — a face
 * D não tem, porque o título do cartão já é a pergunta —, e quando há ele é um `<h2>`, abaixo do `<h1>` da
 * moldura, no papel de rótulo de coluna.
 */
export function ListaDeOrganizacoes({ rotulo, children }: { rotulo?: string; children: ReactNode }) {
  const lista = (
    <ul className="border-linha divide-linha-suave bg-superficie divide-y overflow-hidden rounded-md border">
      {children}
    </ul>
  );

  if (rotulo === undefined) return lista;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-rotulo-coluna text-tinta-suave font-mono uppercase">
        {rotulo}
      </h2>
      {lista}
    </div>
  );
}

/** Onde cada linha está enquanto uma troca está em voo (item 103, critério 1). */
export type SituacaoDaLinha = "livre" | "entrando" | "inerte";

/**
 * **Só a linha apertada responde.** Sem troca em voo, todas estão livres; com uma, a escolhida está
 * entrando e as outras estão inertes — que não aceitam toque, mas continuam aceitando foco.
 */
export function situacaoDaLinha(escolhida: string | null, organizacaoId: string): SituacaoDaLinha {
  if (escolhida === null) return "livre";
  return escolhida === organizacaoId ? "entrando" : "inerte";
}

/**
 * O conteúdo de uma linha: o nome no papel de título de linha, o apoio em meta, e a seta quando a linha
 * leva a algum lugar. **O respiro é da linha**, e não de quem a embrulha: assim a linha de pedido, que é
 * um `<li>` simples, e a linha que troca de organização, que é um botão, têm a mesma altura.
 */
export function LinhaDeOrganizacao({
  nome,
  apoio,
  seta = false,
  entrando = false,
}: {
  nome: string;
  apoio: ReactNode;
  seta?: boolean;
  /** A troca para esta organização está em voo: o apoio vira o verbo, e a seta vira o indicador. */
  entrando?: boolean;
}) {
  return (
    <span className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-titulo-linha text-tinta">{nome}</span>
        <span className="text-meta text-tinta-suave font-normal">{entrando ? "Entrando…" : apoio}</span>
      </span>
      {seta &&
        (entrando ? (
          <IndicadorDeEnvio ativo />
        ) : (
          <ChevronRight aria-hidden="true" className="text-tinta-suave size-4 shrink-0" />
        ))}
    </span>
  );
}
