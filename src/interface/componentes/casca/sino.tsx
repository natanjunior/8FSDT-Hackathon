"use client";

import { Bell, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import {
  foraDaLista,
  nomeDoSino,
  numeroDoSino,
  type LinhaDoSino,
  type SinoNaTela,
} from "@/interface/componentes/sino";
import { BotaoDeIcone } from "@/interface/componentes/botao-de-icone";
import { CONTEUDO_DO_SHEET } from "@/interface/componentes/modal";
import { Badge } from "@/interface/componentes/ui/badge";
import { Button } from "@/interface/componentes/ui/button";
import { Dialog, DialogTitle, DialogTrigger } from "@/interface/componentes/ui/dialog";
import { SheetContent } from "@/interface/componentes/ui/sheet";
import { cn } from "@/interface/componentes/utilitarios";
import { useIsMobile } from "@/interface/ganchos/use-mobile";

/** As duas ações de servidor, que chegam do layout: o componente não importa `@/interface/acoes`. */
export type AcoesDoSino = {
  marcarComoLida: (ocorrenciaId: string) => Promise<void>;
  marcarComoNaoLida: (ocorrenciaId: string) => Promise<void>;
};

/**
 * **A pílula veste a cor da marca** — decisão do dono em 03/10/2026. Ela é o quinto uso nomeado do laranja
 * no `DESIGN.md`, *o contador de não lidas*: a *Um Primário Rule* vale para **ação**, e contagem não
 * disputa com a ação principal da tela. O par marca × tinta escura é medido em `tema.test.ts`, e a pílula
 * sobre a barra passa o piso de objeto gráfico nos três temas. **`absolute`**, e por isso o botão mede
 * 44 px com `3` ou com `99+`: o número de não lidas não muda a largura da barra (critério 117.11).
 */
export const CLASSE_DA_PILULA =
  "bg-marca text-marca-foreground pointer-events-none absolute -top-0.5 -right-0.5 min-w-5 justify-center border-transparent px-1 font-mono tabular-nums";

/**
 * **A gaveta de baixo, pelas classes do `modal.tsx`** (guia §7): fundo de superfície, régua, cantos de
 * cima arredondados, coluna com `overflow-hidden`, e o tempo e a curva do guia §6 pelos tokens
 * `--tempo-gaveta` e `--curva-gaveta`. **O teto é o do `CONTEUDO_DO_DIALOG`, 85 dvh, e não os 90 do sheet
 * do modal:** a lista é o único conteúdo da gaveta, e o pedaço de tela que sobra acima dela é o que diz
 * que a página continua ali atrás.
 */
export const CLASSE_DA_GAVETA = cn(CONTEUDO_DO_SHEET, "max-h-[85dvh]");

/**
 * **A gaveta lateral, na tela grande** (item 120, `respostas.md` P1). O sino mora no canto direito da barra
 * (`barra-superior.tsx:38-41`), e a gaveta da direita abre do lado do botão que a chamou, com a altura
 * inteira da janela para uma lista vertical. **A largura é a do catálogo** (`sheet.tsx:73-74`,
 * `sm:max-w-sm`, 384 px), a mesma do `w-96` que a lista tinha no `Popover`. Sem teto e sem cantos de cima:
 * esses são da gaveta de baixo. O tempo e a curva do guia §6 são os mesmos.
 */
export const CLASSE_DA_LATERAL =
  "bg-superficie border-linha flex flex-col gap-0 overflow-hidden ease-(--curva-gaveta) data-[state=closed]:duration-(--tempo-gaveta) data-[state=open]:duration-(--tempo-gaveta)";

/**
 * **O foco de abertura fica no próprio conteúdo**, e não no primeiro tabulável da lista, que é o botão de
 * ícone da primeira linha. A dica do Radix **abre no foco** e o provedor da casca tem `delayDuration` zero
 * (`ui/tooltip.tsx:8`), então com o foco no botão o primeiro `Esc` fechava a dica e a lista ficava aberta.
 * Com o foco no conteúdo, `Esc` fecha a lista de primeira e devolve o foco ao sino (critério 118.5), e
 * `Tab` entra na lista normalmente, porque o foco já está dentro do escopo.
 */
function focarOConteudo(evento: Event) {
  evento.preventDefault();
  (evento.currentTarget as HTMLElement | null)?.focus();
}

/**
 * ============================================================================
 *  O sino da barra superior — itens 117 e 118
 * ============================================================================
 *
 * **O número vem do banco, e a casca não espera por ele**: o layout desenha este componente com
 * `sino={null}` no `Suspense` e o número chega depois, como a contagem de pedidos. Nunca esqueleto.
 *
 * **A lista vem junto, e abre numa gaveta por cima da tela em que a pessoa está** (spec §3.11 do 117):
 * da direita a partir de `md`, de baixo abaixo — item 120, que corrigiu o 118. O pedido do dono, em
 * 03/10/2026, era gaveta em toda largura. **Vir junto com a casca** é o que a §3.11 do 117 defendia, contra
 * uma tela `/avisos`; a gaveta continua vindo junto, e só o recipiente mudou.
 *
 * **Uma raiz só, e é a montagem do `modal.tsx`.** `Sheet` e `Dialog` são o mesmo primitivo do `radix-ui`
 * (`sheet.tsx:6`), então a raiz é um `Dialog` e um conteúdo só; o `useIsMobile` decide apenas o lado e as classes,
 * o mesmo gancho da barra lateral, no mesmo limiar de 768 px. **Quem guarda a abertura é o `Sino`**, e não o
 * conteúdo: girar o aparelho com a lista aberta troca o lado e a lista continua aberta.
 *
 * **O `drawer` do shadcn fica fora**: seria dependência nova, na variante Base UI, para fazer o que a peça
 * do catálogo já faz. Fechar devolve o foco ao botão, e `Esc` fecha nas duas formas — é o padrão dos
 * primitivos, e nada aqui o desliga. **Abrir o sino não grava nada.**
 */
export function Sino({ sino, acoes }: { sino: SinoNaTela | null; acoes: AcoesDoSino }) {
  const [aberto, setAberto] = useState(false);
  const celular = useIsMobile();
  const naoLidas = sino?.naoLidas ?? 0;
  const numero = numeroDoSino(naoLidas);

  const botao = (
    // `aria-busy` na espera: sem número ainda não é zero, e o leitor de tela (e o ponta a ponta) sabe a
    // diferença.
    <Button
      variant="ghost"
      size="icon"
      className="relative size-11"
      aria-label={nomeDoSino(naoLidas)}
      aria-busy={sino === null ? true : undefined}
    >
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

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{botao}</DialogTrigger>
      <SheetContent
        side={celular ? "bottom" : "right"}
        className={celular ? CLASSE_DA_GAVETA : CLASSE_DA_LATERAL}
        onOpenAutoFocus={focarOConteudo}
      >
        {/* `pr-14` para o título não passar por baixo do X de 44 px que a folha do catálogo desenha. */}
        <DialogTitle className="shrink-0 px-4 pt-4 pr-14 pb-2">Avisos</DialogTitle>
        {/* Só o corpo rola: o título e o X ficam fora da rolagem, como nos nove modais da família. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{lista}</div>
      </SheetContent>
    </Dialog>
  );
}

/**
 * **O miolo da lista**, exportado porque o conteúdo da gaveta vive num portal fechado e não sai
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
          icone={<Check aria-hidden="true" />}
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
          icone={<RotateCcw aria-hidden="true" />}
          acao={acoes.marcarComoNaoLida}
          aoNavegar={aoNavegar}
        />
      )}
    </div>
  );
}

/**
 * Uma faixa. **O título da ocorrência é o link, e a segunda linha fica fora dele**, para o nome do link ser
 * o título. **Marcar é botão de ícone com dica** (guia §7, item 118): `Check` para lida e `RotateCcw` para
 * não lida, duas silhuetas distintas para gestos opostos — era isso que o medo de confundir pedia, e não a
 * volta ao texto. **O nome acessível vem do `aria-label`**, e o título da linha chega por
 * `aria-describedby`: dez *Marcar como lida* iguais seriam indistinguíveis para quem navega por botões. A
 * `form` com ação de servidor funciona sem JavaScript e dispara a revalidação sozinha.
 */
function Faixa({
  titulo,
  linhas,
  gesto,
  icone,
  acao,
  aoNavegar,
}: {
  titulo: string;
  linhas: readonly LinhaDoSino[];
  gesto: string;
  icone: ReactNode;
  acao: (ocorrenciaId: string) => Promise<void>;
  aoNavegar: (() => void) | undefined;
}) {
  // A faixa é uma região com o nome do título: o leitor de tela a anuncia, e o ponta a ponta a localiza
  // por `getByRole("region", { name })`. O mesmo `id` é a raiz do `id` de cada linha.
  const idDoTitulo = useId();
  return (
    <section aria-labelledby={idDoTitulo} className="border-linha border-b last:border-b-0">
      <h3 id={idDoTitulo} className="text-rotulo-peca text-tinta-suave px-4 pt-3 pb-1">
        {titulo}
      </h3>
      <ul>
        {linhas.map((linha) => {
          const idDoTituloDaLinha = `${idDoTitulo}-${linha.ocorrenciaId}`;
          return (
            <li key={linha.ocorrenciaId} className="flex min-w-0 items-start gap-2 px-4 py-2">
              <div className="min-w-0 flex-1">
                <Link
                  id={idDoTituloDaLinha}
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
                <BotaoDeIcone
                  type="submit"
                  rotulo={gesto}
                  icone={icone}
                  descritoPor={idDoTituloDaLinha}
                  className="shrink-0"
                />
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
