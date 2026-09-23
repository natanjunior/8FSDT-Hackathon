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
 * **mesma** `<tr>` arrastável nas duas larguras, e a pauta seria o segundo mecanismo de mover. Abaixo de
 * `md`, a alça, as colunas próprias e a situação somem, e o que elas diziam aparece numa segunda linha
 * dentro da célula do nome.
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

/**
 * O ponto que acompanha *Ativa* (item 44p, critério 22). **A palavra continua sendo o sinal** (A-5); o
 * ponto é a pista de forma que a prancheta desenhou, e é o que distingue as duas situações sem pintar a
 * maioria das linhas.
 */
const PONTO_DE_ATIVA = "•";

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
                className="text-tinta-fraca pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
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
                <TableHead className={cn(ROTULO_DE_COLUNA, "w-[72px]")}>
                  {TEXTOS_DA_TABELA.ordem}
                </TableHead>
                <TableHead className={ROTULO_DE_COLUNA}>{textos.colunaDoNome}</TableHead>
                {cabecalhosProprios}
                <TableHead className={cn(ROTULO_DE_COLUNA, "hidden w-[160px] md:table-cell")}>
                  {TEXTOS_DA_TABELA.noFormulario}
                </TableHead>
                <TableHead className={cn(ROTULO_DE_COLUNA, "w-[200px]")}>
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
                        !item.ativa && "text-tinta-fraca",
                        arrasto.arrastando === indice && "opacity-40",
                      )}
                    >
                      <TableCell className="hidden w-10 px-2 py-2.5 md:table-cell">
                        <AlcaDeArrasto {...arrasto.propsDaAlca(indice)} />
                      </TableCell>
                      <TableCell className={cn(CELULA, "text-tinta-suave font-mono tabular-nums")}>
                        {indice + 1}
                      </TableCell>
                      <TableCell className={CELULA}>
                        <span id={idDoNome} className={cn(!item.ativa && "text-tinta-suave")}>
                          {nomeDaLinha(item)}
                        </span>
                        <span className="text-meta text-tinta-suave block md:hidden">
                          {resumoNoCelular(item)}
                        </span>
                      </TableCell>
                      {celulasProprias?.(item)}
                      <TableCell className={cn(CELULA, "hidden md:table-cell")}>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-linha rounded-sm",
                            item.ativa ? "text-accent-foreground" : "text-tinta-fraca",
                          )}
                        >
                          {item.ativa ? `${PONTO_DE_ATIVA} ${TEXTOS_DA_TABELA.ativa}` : TEXTOS_DA_TABELA.inativa}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 py-1.5 text-right">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <ControlesDeOrdem
                            posicao={indice}
                            total={todas.length}
                            inerte={inerte}
                            rotulos={{ subir: TEXTOS_DA_TABELA.subir, descer: TEXTOS_DA_TABELA.descer }}
                            aoMover={ordem.mover}
                          />
                          {acaoDeEditar(item, idDoNome)}
                          {acaoDeSituacao(item, idDoNome, ehUltimaAtiva)}
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
        <EmptyTitle className="text-titulo-bloco text-tinta">{titulo}</EmptyTitle>
        {corpo !== undefined && (
          <EmptyDescription className="text-corpo text-tinta-suave">{corpo}</EmptyDescription>
        )}
      </EmptyHeader>
    </Empty>
  );
}
