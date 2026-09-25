import type { ReactNode } from "react";

import { cn } from "@/interface/componentes/utilitarios";

/**
 * ============================================================================
 *  O cartão de leitura e a cabeça dele — guia §4 e §5, item 44i
 * ============================================================================
 *
 * **O cartão agrupa naturezas diferentes** (guia §1: *"onde a tentação for pôr uma caixa, ponha uma
 * pauta"*, e o cartão é a caixa que sobra). Borda `--line`, fundo `--surface`, raio de 10 px, sombra
 * pequena, e nada vaza pelos cantos.
 *
 * **A família Organização o usa em cinco telas**, e o 44i o desenha primeiro: T-15, T-16 e T-08, e
 * T-09 e T-14 no 44k. As telas que já existem (T-03, T-07 e o estado sem acesso) não migram: seria
 * arrumação sem critério em telas que o dono já validou. T-05 migrou no item 44q, com a faixa abaixo,
 * porque o critério 44q.5 pede cartão em cada bloco.
 *
 * **O cartão é nomeado pelo título da cabeça**, por `aria-labelledby`: a seção vira região com nome, e
 * quem navega por regiões encontra *Identidade* e *Acesso*. Quem usa passa o mesmo `id` aos dois.
 *
 * **Componentes de servidor.** Sem estado; a ação da cabeça pode ser de cliente, e chega pronta.
 */

export function Cartao({
  tituloId,
  className,
  children,
}: {
  tituloId: string;
  /** Só geometria de quem o usa — hoje, a altura cheia dos cartões do grupo (item 76). */
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={tituloId}
      className={cn("border-linha bg-superficie overflow-hidden rounded-lg border shadow-sm", className)}
    >
      {children}
    </section>
  );
}

/**
 * A cabeça: o título no papel de bloco, a linha de apoio em meta, e a ação à direita. Régua `--line-soft`
 * embaixo; respiro de 18 px, e 15 px no celular (guia §4).
 */
export function CabecaDoCartao({
  id,
  titulo,
  apoio,
  acao,
}: {
  id: string;
  titulo: string;
  /** Aceita nó desde o item 44j: a linha de apoio do cartão Contatos muda com o ponteiro. */
  apoio?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="border-linha-suave flex items-center justify-between gap-4 border-b px-[15px] py-3 md:px-[18px] md:py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="text-titulo-bloco text-tinta">
          {titulo}
        </h2>
        {apoio !== undefined && <p className="text-meta text-tinta-suave">{apoio}</p>}
      </div>
      {acao !== undefined && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

/**
 * **A faixa, que é a segunda cabeça do cartão** — item 44q, critério 5. Onde a `CabecaDoCartao` dá
 * título de bloco a um cartão de leitura (T-15, T-16), a faixa dá rótulo em mono versal a um bloco de
 * conteúdo (T-05): *O que foi relatado*, *Linha do tempo*, *Mensagens*.
 *
 * **O título é o `h2` de quem chama**, e não uma prop de texto, por dois motivos: a linha do tempo e as
 * mensagens põem a contagem dentro do título, e o teste de ponta a ponta afirma o nome inteiro
 * (*"Mensagens 1"*); e o título da linha do tempo espera dados, então vem dentro de um `<Suspense>`. O
 * versal é CSS, e o nome acessível continua com a caixa do texto.
 */
export const TITULO_DA_FAIXA = "text-rotulo-coluna text-tinta-fraca font-mono uppercase";

export function FaixaDoCartao({ children, dado }: { children: ReactNode; dado?: ReactNode }) {
  return (
    <div className="border-linha-suave flex min-h-11 items-center justify-between gap-4 border-b px-[15px] py-2 md:px-[18px]">
      {children}
      {dado !== undefined && (
        <div className="text-rotulo-coluna text-tinta-fraca shrink-0 font-mono uppercase">{dado}</div>
      )}
    </div>
  );
}

export function CorpoDoCartao({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 p-[15px] md:p-[18px]">{children}</div>;
}
