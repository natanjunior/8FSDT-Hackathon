import type { ReactNode } from "react";

/**
 * ============================================================================
 *  O cartão de leitura e a cabeça dele — guia §4 e §5, item 44i
 * ============================================================================
 *
 * **O cartão agrupa naturezas diferentes** (guia §1: *"onde a tentação for pôr uma caixa, ponha uma
 * pauta"*, e o cartão é a caixa que sobra). Borda `--line`, fundo `--surface`, raio de 10 px, sombra
 * pequena, e nada vaza pelos cantos.
 *
 * **A família Organização o usa em cinco telas**, e o 44i o desenha primeiro: T-15 e T-16 agora, T-08,
 * T-09 e T-14 no 44j e no 44k. As telas que já existem (T-03, T-05, T-07 e o estado sem acesso) não
 * migram: seria arrumação sem critério em telas que o dono já validou.
 *
 * **O cartão é nomeado pelo título da cabeça**, por `aria-labelledby`: a seção vira região com nome, e
 * quem navega por regiões encontra *Identidade* e *Acesso*. Quem usa passa o mesmo `id` aos dois.
 *
 * **Componentes de servidor.** Sem estado; a ação da cabeça pode ser de cliente, e chega pronta.
 */

export function Cartao({ tituloId, children }: { tituloId: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={tituloId}
      className="border-linha bg-superficie overflow-hidden rounded-lg border shadow-sm"
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
  apoio?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="border-linha-suave flex items-center justify-between gap-4 border-b px-[15px] py-3 md:px-[18px] md:py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={id} className="text-titulo-bloco text-tinta leading-snug font-semibold">
          {titulo}
        </h2>
        {apoio !== undefined && <p className="text-meta text-tinta-suave">{apoio}</p>}
      </div>
      {acao !== undefined && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
