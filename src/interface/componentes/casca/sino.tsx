"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import {
  foraDaLista,
  nomeDoSino,
  numeroDoSino,
  type LinhaDoSino,
  type SinoNaTela,
} from "@/interface/componentes/sino";
import { Badge } from "@/interface/componentes/ui/badge";
import { Button } from "@/interface/componentes/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/interface/componentes/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/interface/componentes/ui/popover";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

/** As duas ações de servidor, que chegam do layout: o componente não importa `@/interface/acoes`. */
export type AcoesDoSino = {
  marcarComoLida: (ocorrenciaId: string) => Promise<void>;
  marcarComoNaoLida: (ocorrenciaId: string) => Promise<void>;
};

/**
 * **A pílula veste o neutro invertido**, e não o laranja: o laranja tem quatro usos, e este não é um deles
 * (item 105). O par tinta × superfície é medido em `tema.test.ts`. **`absolute`**, e por isso o botão mede
 * 44 px com `3` ou com `99+`: o número de não lidas não muda a largura da barra (critério 117.11).
 */
export const CLASSE_DA_PILULA =
  "bg-tinta text-superficie pointer-events-none absolute -top-0.5 -right-0.5 min-w-5 justify-center border-transparent px-1 font-mono tabular-nums";

/**
 * ============================================================================
 *  O sino da barra superior — item 117
 * ============================================================================
 *
 * **O número vem do banco, e a casca não espera por ele**: o layout desenha este componente com
 * `sino={null}` no `Suspense` e o número chega depois, como a contagem de pedidos. Nunca esqueleto.
 *
 * **A lista vem junto, e abre por cima da tela em que a pessoa está** (spec §3.11): `Popover` a partir de
 * `md`, `Dialog` de tela cheia abaixo. Fechar devolve o foco ao botão, e `Esc` fecha nas duas formas — é o
 * padrão dos dois primitivos, e nada aqui o desliga. **Abrir o sino não grava nada.**
 */
export function Sino({ sino, acoes }: { sino: SinoNaTela | null; acoes: AcoesDoSino }) {
  const [aberto, setAberto] = useState(false);
  const celular = useIsMobile();
  const naoLidas = sino?.naoLidas ?? 0;
  const numero = numeroDoSino(naoLidas);

  const botao = (
    <Button variant="ghost" size="icon" className="relative size-11" aria-label={nomeDoSino(naoLidas)}>
      <Bell aria-hidden className="size-5" />
      {/* `aria-hidden`: o número já está no nome do botão, e o leitor de tela o leria duas vezes. */}
      {numero !== null && (
        <Badge aria-hidden className={CLASSE_DA_PILULA}>
          {numero}
        </Badge>
      )}
    </Button>
  );

  // **O link fecha a lista**, ou ela ficaria aberta sobre T-05 no celular.
  const lista =
    sino === null ? null : <ListaDoSino sino={sino} acoes={acoes} aoNavegar={() => setAberto(false)} />;

  if (celular) {
    return (
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger asChild>{botao}</DialogTrigger>
        {/* **Sem `w-screen`**: `100vw` conta a barra de rolagem vertical onde ela ocupa espaço, e criaria a
            rolagem lateral que o critério proíbe. A folha do catálogo já é `inset-x-0`. */}
        <DialogContent className="top-0 h-dvh content-start gap-0 overflow-x-hidden overflow-y-auto rounded-none p-0">
          <DialogTitle className="px-4 pt-4 pb-2">Avisos</DialogTitle>
          {lista}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{botao}</PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="max-h-[min(70vh,560px)] overflow-y-auto">{lista}</div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * **O miolo da lista**, exportado porque o conteúdo do `Popover`/`Dialog` vive num portal fechado e não sai
 * na renderização do botão. Duas faixas com título, *Não lidas* primeiro; **a palavra é o sinal** (A-5), e
 * o título da faixa a diz uma vez, em vez de um selo por linha.
 */
export function ListaDoSino({
  sino,
  acoes,
  aoNavegar,
}: {
  sino: SinoNaTela;
  acoes: AcoesDoSino;
  aoNavegar?: () => void;
}) {
  if (sino.naoLidasNaLista.length === 0 && sino.lidas.length === 0) {
    return <p className="text-interface text-tinta-suave px-4 py-6">Nada novo por aqui.</p>;
  }
  return (
    <div className="flex flex-col">
      {sino.naoLidasNaLista.length > 0 && (
        <Faixa
          titulo="Não lidas"
          linhas={sino.naoLidasNaLista}
          gesto="Marcar como lida"
          acao={acoes.marcarComoLida}
          aoNavegar={aoNavegar}
        />
      )}
      {sino.foraDaLista > 0 && (
        <p className="text-meta text-tinta-suave px-4 py-2">{foraDaLista(sino.foraDaLista)}</p>
      )}
      {sino.lidas.length > 0 && (
        <Faixa
          titulo="Lidas"
          linhas={sino.lidas}
          gesto="Marcar como não lida"
          acao={acoes.marcarComoNaoLida}
          aoNavegar={aoNavegar}
        />
      )}
    </div>
  );
}

/**
 * Uma faixa. **O título da ocorrência é o link, e a segunda linha fica fora dele**, para o nome do link ser
 * o título. **Marcar é texto, e não ícone**: dois ícones parecidos para gestos opostos se confundem. A
 * `form` com ação de servidor funciona sem JavaScript e dispara a revalidação sozinha.
 */
function Faixa({
  titulo,
  linhas,
  gesto,
  acao,
  aoNavegar,
}: {
  titulo: string;
  linhas: readonly LinhaDoSino[];
  gesto: string;
  acao: (ocorrenciaId: string) => Promise<void>;
  aoNavegar: (() => void) | undefined;
}) {
  // A faixa é uma região com o nome do título: o leitor de tela a anuncia, e o ponta a ponta a localiza
  // por `getByRole("region", { name })`.
  const idDoTitulo = useId();
  return (
    <section aria-labelledby={idDoTitulo} className="border-linha border-b last:border-b-0">
      <h3 id={idDoTitulo} className="text-rotulo-peca text-tinta-suave px-4 pt-3 pb-1">
        {titulo}
      </h3>
      <ul>
        {linhas.map((linha) => (
          <li key={linha.ocorrenciaId} className="flex min-w-0 items-start gap-2 px-4 py-2">
            <div className="min-w-0 flex-1">
              <Link
                href={linha.href}
                onClick={aoNavegar}
                className="text-interface text-tinta block font-medium break-words"
              >
                {linha.titulo}
              </Link>
              <p className="text-meta text-tinta-suave break-words">
                {linha.tipo} · {linha.por} · {linha.quando}
              </p>
            </div>
            <form action={acao.bind(null, linha.ocorrenciaId)}>
              <Button type="submit" variant="ghost" className="text-meta min-h-11 shrink-0 px-2">
                {gesto}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
