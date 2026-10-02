"use client";

import { Search } from "lucide-react";
import { Fragment, useId, useState, type ReactElement, type ReactNode } from "react";

import {
  AlcaDeArrasto,
  AnuncioDeOrdem,
  CLASSE_DA_VAGA,
  ControlesDeOrdem,
} from "@/interface/componentes/controles-de-ordem";
import {
  FALHA,
  FRASE_DO_INERTE,
  ROTULO_DO_FILTRO,
  TEXTOS_DA_LISTA,
  TEXTOS_DA_TABELA,
  VAZIO_DO_FILTRO,
  avisoDeSemAtivas,
  buscaVazia,
  listaVazia,
  type Lista,
} from "@/interface/componentes/frases-da-configuracao";
import {
  FILTROS,
  contagensDoFiltro,
  estadoDaLista,
  ordemInerte,
  pertenceAoFiltro,
  vistaDaLista,
  type Filtro,
  type ItemDaLista,
} from "@/interface/componentes/ordem-da-lista";
import { Cartao } from "@/interface/componentes/cartao";
import {
  CAIXA_DO_FILTRO,
  CONTAGEM_DO_FILTRO,
  OPCAO_DO_FILTRO,
} from "@/interface/componentes/filtro-rapido";
import { CELULA, ROTULO_DE_COLUNA } from "@/interface/componentes/pecas-da-tabela";
import { Badge } from "@/interface/componentes/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/interface/componentes/ui/empty";
import { Input } from "@/interface/componentes/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/interface/componentes/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/interface/componentes/ui/toggle-group";
import { cn } from "@/interface/componentes/utilitarios";
import { useArrastoDeLinha } from "@/interface/ganchos/use-arrasto-de-linha";
import { useOrdemGravada } from "@/interface/ganchos/use-ordem-gravada";

/**
 * ============================================================================
 *  A lista de ordem manual — a casca de T-09 e T-14, item 44k
 * ============================================================================
 *
 * **Uma casca, duas telas.** Categorias e áreas têm o mesmo esqueleto — filtro rápido com contagem, busca
 * pelo nome, tabela com alça e setas, e as ações de linha — e três diferenças: o ícone ao lado do nome em
 * T-09, a coluna *Tipo* e a legenda fixa em T-14. As diferenças entram por propriedade.
 *
 * **O filtro e a busca vivem em estado do componente, não no endereço** (spec §4.3), e é o contrário do
 * que T-08 faz: aqui há dois eixos e nenhum é paginação, a lista inteira cabe numa tela, e **o trabalho
 * principal desta tela é reordenar** — cada toque numa aba viraria uma entrada de histórico, e o *voltar*
 * do navegador passaria a desfazer trocas de aba em vez de sair da tela.
 *
 * **As contagens são do conjunto inteiro, e a busca não as muda**: é o *"o contador não mente"* do 44j.
 *
 * **Uma tabela só, em toda largura**, e não uma tabela e uma pauta como em T-08: a ordem manual precisa da
 * **mesma** `<tr>` arrastável nas duas larguras, e a pauta seria o segundo mecanismo de mover. **Três
 * pontos de corte, desde o item 112**, porque o quinto botão (o QR do 111) desfez o *"cabe em 390"* do 44k:
 * abaixo de `md` as ações descem para a célula do nome, logo abaixo do resumo; a alça aparece em `md`; e as
 * colunas largas (*Tipo* e *No formulário*) só em `xl`, com o resumo na célula do nome sempre que elas não
 * aparecem. A coluna *Ordem* tem 48 px, que é o remédio que o 44k já declarava.
 *
 * **A vaga não é a `VagaDeArrasto` do 44j**, que desenha uma `<div>`: dentro de `<tbody>` só cabe `<tr>`.
 * A classe é a mesma, `CLASSE_DA_VAGA`, exportada por lá exatamente para isto.
 *
 * **Inerte com filtro ou busca** (critério 2): a ordem se grava com a lista inteira, e o endpoint do item
 * 50 não aceita pedaço de lista. A explicação vem **antes** do clique, na barra do cartão.
 *
 * **A linha inativa recua sem sumir, e não perde a alça nem as setas**: a ordem vale para as duas, e a
 * lista que se reordena é a inteira.
 */

export function ListaDeOrdemManual<T extends ItemDaLista>({
  lista,
  itens,
  organizacaoId,
  legenda,
  colunasProprias = 0,
  cabecalhosProprios,
  celulasProprias,
  nomeDaLinha,
  resumoNoCelular,
  acaoDeEditar,
  acaoDeSituacao,
  acaoExtra,
}: {
  readonly lista: Lista;
  /** A lista inteira da organização, ativas e inativas, na ordem do Gestor. */
  readonly itens: readonly T[];
  readonly organizacaoId: string;
  /** Só T-14: a legenda dos dois tipos, fixa no cartão (critério 9). */
  readonly legenda?: ReactNode;
  /** Quantas colunas `cabecalhosProprios` desenha — o `colSpan` da vaga precisa do número. */
  readonly colunasProprias?: number;
  readonly cabecalhosProprios?: ReactNode;
  readonly celulasProprias?: (item: T) => ReactNode;
  readonly nomeDaLinha: (item: T) => ReactNode;
  readonly resumoNoCelular: (item: T) => string;
  readonly acaoDeEditar: (item: T, idDoNome: string) => ReactNode;
  readonly acaoDeSituacao: (item: T, idDoNome: string, ehUltimaAtiva: boolean) => ReactNode;
  /** Só T-14 (item 111): uma ação a mais, antes de *Editar*. O QR da área. */
  readonly acaoExtra?: (item: T, idDoNome: string) => ReactNode;
}): ReactElement {
  const textos = TEXTOS_DA_LISTA[lista];
  const prefixo = useId();
  const tituloId = `${prefixo}-titulo`;
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");

  const ordem = useOrdemGravada<T>({
    itens,
    endpoint: textos.endpointDaOrdem,
    organizacaoId,
    tituloDaFalha: FALHA.mover,
  });

  const todas = ordem.itens;
  const contagens = contagensDoFiltro(todas);
  const inerte = ordemInerte(filtro, busca);
  const vista = vistaDaLista(todas, filtro, busca);
  const estado = estadoDaLista({
    total: todas.length,
    noFiltro: todas.filter((item) => pertenceAoFiltro(item, filtro)).length,
    encontradas: vista.length,
    busca,
  });

  const arrasto = useArrastoDeLinha({ quantidade: todas.length, inerte, aoMover: ordem.mover });
  const colunas = 5 + colunasProprias;

  const vaga = (posicao: number) => {
    if (arrasto.vaga !== posicao) return null;
    return (
      <tr aria-hidden="true" {...arrasto.propsDaVaga()}>
        <td colSpan={colunas} className="px-4 py-1">
          <div className={CLASSE_DA_VAGA} />
        </td>
      </tr>
    );
  };

  /**
   * **As ações de uma linha, escritas uma vez e desenhadas duas** (item 112): na célula do nome abaixo de
   * `md`, e na coluna própria a partir dele. A cópia que está em `display: none` sai da árvore de
   * acessibilidade, então teclado e leitor de tela encontram um conjunto só em cada largura. As duas
   * apontam para o mesmo nome, que é uma célula só.
   */
  const acoesDaLinha = (item: T, indice: number, idDoNome: string, ehUltimaAtiva: boolean) => (
    <>
      <ControlesDeOrdem
        posicao={indice}
        total={todas.length}
        inerte={inerte}
        rotulos={{ subir: TEXTOS_DA_TABELA.subir, descer: TEXTOS_DA_TABELA.descer }}
        aoMover={ordem.mover}
      />
      {acaoExtra?.(item, idDoNome)}
      {acaoDeEditar(item, idDoNome)}
      {acaoDeSituacao(item, idDoNome, ehUltimaAtiva)}
    </>
  );

  return (
    <div className="flex flex-col gap-5.5">
      <ToggleGroup
        type="single"
        spacing={1}
        value={filtro}
        aria-label={TEXTOS_DA_TABELA.filtrar}
        onValueChange={(escolhido) => {
          // Escolha única não se desmarca: o Radix devolve `""` ao tocar na opção marcada.
          const proximo = FILTROS.find((valor) => valor === escolhido);
          if (proximo !== undefined) setFiltro(proximo);
        }}
        className={CAIXA_DO_FILTRO}
      >
        {FILTROS.map((valor) => (
          <ToggleGroupItem
            key={valor}
            value={valor}
            className={OPCAO_DO_FILTRO}
          >
            {ROTULO_DO_FILTRO[valor]}
            <span className={CONTAGEM_DO_FILTRO}>
              {contagens[valor]}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Cartao tituloId={tituloId}>
        {/* A prancheta não desenha título de cartão: a barra da busca é a primeira linha. O título
            existe para nomear a região a quem navega por regiões. */}
        <h2 id={tituloId} className="sr-only">
          Lista de {lista === "categorias" ? "categorias" : "áreas"}
        </h2>

        <div className="border-linha-suave flex flex-col gap-1.5 border-b px-4 py-3">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
            <label
              htmlFor={`${prefixo}-busca`}
              className="text-interface text-tinta font-medium whitespace-nowrap"
            >
              {TEXTOS_DA_TABELA.buscar}
            </label>
            <div className="relative md:w-72">
              <Search
                aria-hidden="true"
                className="text-tinta-suave pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                id={`${prefixo}-busca`}
                type="search"
                inputMode="search"
                autoComplete="off"
                maxLength={textos.tetoDoNome}
                placeholder={textos.exemploDaBusca}
                value={busca}
                onChange={(evento) => {
                  setBusca(evento.currentTarget.value);
                }}
                className="border-linha bg-background h-11 pl-9"
              />
            </div>
          </div>
          {/* A explicação antes do clique: o critério 2 manda deixar alça e setas inertes, e o guia
              manda dizer por quê. */}
          {inerte && <p className="text-meta text-tinta-suave">{FRASE_DO_INERTE}</p>}
        </div>

        {legenda !== undefined && (
          <p className="border-linha-suave text-meta text-tinta-suave border-b px-4 py-2.5">{legenda}</p>
        )}

        {contagens.ativas === 0 && todas.length > 0 && (
          <p
            role="alert"
            className="border-linha-suave bg-accent text-tinta text-interface border-b px-4 py-2.5 font-medium"
          >
            {avisoDeSemAtivas(lista)}
          </p>
        )}

        {estado === "lista-vazia" && <VazioDaTabela titulo={listaVazia(lista)} />}
        {estado === "vazio-do-filtro" && <VazioDaTabela titulo={VAZIO_DO_FILTRO[lista][filtro]} />}
        {estado === "busca-vazia" && (
          <VazioDaTabela titulo={buscaVazia(lista)} corpo="Limpe a busca para ver a lista inteira." />
        )}

        {estado === "lista" && (
          <Table>
            <TableHeader>
              <TableRow className="border-linha hover:bg-transparent">
                <TableHead className={cn(ROTULO_DE_COLUNA, "hidden w-10 md:table-cell")}>
                  <span className="sr-only">{TEXTOS_DA_TABELA.arrastar}</span>
                </TableHead>
                <TableHead className={cn(ROTULO_DE_COLUNA, "w-12 px-2")}>
                  {TEXTOS_DA_TABELA.ordem}
                </TableHead>
                <TableHead className={ROTULO_DE_COLUNA}>{textos.colunaDoNome}</TableHead>
                {cabecalhosProprios}
                <TableHead className={cn(ROTULO_DE_COLUNA, "hidden w-[160px] xl:table-cell")}>
                  {TEXTOS_DA_TABELA.noFormulario}
                </TableHead>
                <TableHead className={cn(ROTULO_DE_COLUNA, "hidden w-[200px] md:table-cell")}>
                  <span className="sr-only">{TEXTOS_DA_TABELA.acoes}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vista.map((item) => {
                const indice = todas.indexOf(item);
                const idDoNome = `${prefixo}-n${item.id}`;
                const ehUltimaAtiva = item.ativa && contagens.ativas === 1;
                return (
                  <Fragment key={item.id}>
                    {vaga(indice)}
                    <TableRow
                      {...arrasto.propsDaLinha(indice)}
                      className={cn(
                        "border-linha-suave even:bg-background",
                        !item.ativa && "text-tinta-suave",
                        arrasto.arrastando === indice && "opacity-40",
                      )}
                    >
                      <TableCell className="hidden w-10 px-2 py-2.5 md:table-cell">
                        <AlcaDeArrasto {...arrasto.propsDaAlca(indice)} />
                      </TableCell>
                      <TableCell className={cn(CELULA, "text-tinta-suave px-2 font-mono tabular-nums")}>
                        {indice + 1}
                      </TableCell>
                      {/* **O `whitespace-normal` desfaz o `whitespace-nowrap` do `TableCell` do catálogo**
                          (item 112): o nome vai até 80 caracteres, e sem quebrar ele empurraria as ações
                          para fora em qualquer largura. */}
                      <TableCell className={cn(CELULA, "whitespace-normal")}>
                        <span id={idDoNome} className={cn(!item.ativa && "text-tinta-suave")}>
                          {nomeDaLinha(item)}
                        </span>
                        <span className="text-meta text-tinta-suave block xl:hidden">
                          {resumoNoCelular(item)}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                          {acoesDaLinha(item, indice, idDoNome, ehUltimaAtiva)}
                        </span>
                      </TableCell>
                      {celulasProprias?.(item)}
                      <TableCell className={cn(CELULA, "hidden xl:table-cell")}>
                        {/* **Ativa é contorno de sucesso com o ponto; Inativa é apagado** (critério
                            44q.11). O ponto é desenho, e não o caractere `•` de antes: o caractere
                            entrava no nome acessível, e a palavra já diz tudo. */}
                        <Badge
                          variant="outline"
                          className={
                            item.ativa
                              ? "border-ok text-ok gap-1.5"
                              : "bg-muted text-tinta-suave border-transparent"
                          }
                        >
                          {item.ativa && <span aria-hidden className="bg-ok size-1.5 rounded-full" />}
                          {item.ativa ? TEXTOS_DA_TABELA.ativa : TEXTOS_DA_TABELA.inativa}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden px-3.5 py-1.5 text-right md:table-cell">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {acoesDaLinha(item, indice, idDoNome, ehUltimaAtiva)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
              {vaga(todas.length)}
            </TableBody>
          </Table>
        )}
      </Cartao>

      <AnuncioDeOrdem texto={ordem.anuncio} />
    </div>
  );
}

function VazioDaTabela({ titulo, corpo }: { readonly titulo: string; readonly corpo?: string }) {
  return (
    <Empty className="md:p-10">
      <EmptyHeader>
        <EmptyTitle asChild className="text-titulo-bloco text-tinta">
          <h3>{titulo}</h3>
        </EmptyTitle>
        {corpo !== undefined && (
          <EmptyDescription className="text-corpo text-tinta-suave">{corpo}</EmptyDescription>
        )}
      </EmptyHeader>
    </Empty>
  );
}
