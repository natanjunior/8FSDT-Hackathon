"use client";

import { Pencil, Search } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, useState, type MouseEvent, type ReactNode } from "react";

import { CONTORNO_DE_ACAO, LinkDeIcone } from "@/interface/componentes/botao-de-icone";
import { CabecaQueOrdena } from "@/interface/componentes/cabeca-que-ordena";
import { ContatoPorIcone } from "@/interface/componentes/contato-por-icone";
import { DecisaoDePedidoDeEntrada } from "@/interface/componentes/decisao-de-pedido-de-entrada";
import type { EtiquetaNaTela } from "@/interface/componentes/etiquetas-de-participante";
import { EtiquetasNaLinha } from "@/interface/componentes/etiquetas-na-linha";
import { FichaDePessoa } from "@/interface/componentes/ficha-de-pessoa";
import { EscolhaComBusca } from "@/interface/componentes/filtro-com-busca";
import {
  CAIXA_DO_FILTRO,
  CONTAGEM_DO_FILTRO,
  OPCAO_DO_FILTRO,
} from "@/interface/componentes/filtro-rapido";
import { ROTULO_ACIMA } from "@/interface/componentes/filtros-da-lista";
import type { ImpedimentoNaTela } from "@/interface/componentes/frases-da-remocao";
import { TEXTOS_DA_TABELA } from "@/interface/componentes/frases-de-participantes";
import {
  FILTROS,
  ROTULO_DO_FILTRO,
  TEXTO_DA_BUSCA_VAZIA,
  VAZIO_DO_FILTRO,
  ariaSort,
  comEtiqueta,
  comFiltro,
  comOrdem,
  contagensDeEtiquetas,
  contagensDoFiltro,
  escreverEndereco,
  estadoDaTabela,
  etiquetaVigente,
  faixaDaPagina,
  filtrarPeloNome,
  lerEndereco,
  montarLinhas,
  naPagina,
  ordenarLinhas,
  paginar,
  pertenceAEtiqueta,
  pertenceAoFiltro,
  type Coluna,
  type Endereco,
  type Filtro,
  type LinhaDeParticipante,
  type PedidoNaTabela,
} from "@/interface/componentes/linhas-de-participantes";
import { rotuloDoCabecalho } from "@/interface/componentes/ordenacao-em-tres-estados";
import { vizinhas } from "@/interface/componentes/paginacao-da-lista";
import { CELULA, ROTULO_DE_COLUNA } from "@/interface/componentes/pecas-da-tabela";
import { RemocaoDeVinculo } from "@/interface/componentes/remocao-de-vinculo";
import { Badge } from "@/interface/componentes/ui/badge";
import { Button } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import { Input } from "@/interface/componentes/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/interface/componentes/ui/pagination";
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
import { TEXTO_ALEM_DO_FIM } from "@/interface/componentes/vazio-da-lista";
import type { VinculoProjetado } from "@/interface/projecoes";

/**
 * ============================================================================
 *  T-08 · Participantes, numa tabela só — item 44j
 * ============================================================================
 *
 * **Uma tabela, com os pedidos no topo em *Todos***. Eram duas seções: os pedidos em cartão, com a
 * decisão aberta, e os vínculos numa tabela de oito colunas. São a mesma pergunta para o Gestor —
 * *"quem está aqui, e quem quer entrar?"* —, e os pedidos são a parte acionável dela.
 *
 * **Nada disto vai ao servidor.** `GET /vinculos` devolve a lista inteira (até 200, RNF3) e só filtra
 * por papel, então filtrar, ordenar, buscar e paginar acontecem aqui. **O filtro, a ordem e a página
 * vivem no endereço**, escritos com `window.history.pushState`, que o Next 16 integra ao roteador e ao
 * `useSearchParams`: o endereço é copiável e o voltar do navegador desfaz o último toque, sem uma ida ao
 * servidor por clique numa nuvem que dorme.
 *
 * **A ordem tem três estados** (item 68a): crescente, decrescente, e sem ordenação, que é a ordem inicial —
 * pedidos em cima, depois quem chegou por último. A regra do ciclo mora em `ordenacao-em-tres-estados.ts`.
 *
 * **A busca fica fora do endereço**: o critério 3 nomeia três coisas, e texto digitado a cada tecla no
 * histórico seria ruído. O que ela provoca no endereço é só tirar a página, e isso entra por
 * `replaceState`.
 *
 * **As contagens do filtro são do conjunto inteiro, e a busca não as muda.** É o *"o contador não
 * mente"* da lista anterior: a contagem responde *quantos há*, e a busca responde *quem casa*. O que a
 * busca muda é a faixa do rodapé.
 *
 * **Dois desenhos, um dado:** tabela a partir de `md`, pauta no celular — como T-03. Cada desenho tem as
 * próprias peças de ação; o conteúdo de um modal só monta quando ele abre.
 *
 * **Quando uma linha sai** (aprovar, recusar, remover), o gatilho some com ela e o foco cairia no
 * `body`: ele vai para a opção marcada do filtro. Não vai para a busca, que abriria o teclado no celular.
 */

export function TabelaDeParticipantes({
  pedidos,
  vinculos,
  impedimentos,
  responsabilidades,
  areas,
  organizacaoId,
  euPessoaId,
  etiquetas,
}: {
  pedidos: readonly PedidoNaTabela[];
  vinculos: readonly VinculoProjetado[];
  /** Por `pessoaId`. **Chave ausente é *pode sair***. */
  impedimentos: Readonly<Record<string, ImpedimentoNaTela>>;
  /** Por `pessoaId`, quantas ocorrências em aberto a pessoa tem como responsável. **Ausente é zero.** */
  responsabilidades: Readonly<Record<string, number>>;
  areas: ReadonlyArray<{ id: string; nome: string }>;
  organizacaoId: string;
  euPessoaId: string;
  /** Todas as etiquetas desta organização, inclusive as sem uso: são as opções do filtro de etiqueta (itens 115 e 120). */
  etiquetas: readonly EtiquetaNaTela[];
}) {
  const caminho = usePathname();
  const endereco = lerEndereco(useSearchParams());
  const [busca, setBusca] = useState("");
  const prefixo = useId();
  const idDoFiltro = `${prefixo}-filtro`;

  const etiqueta = etiquetaVigente(endereco.etiqueta, etiquetas);
  const linhas = montarLinhas({ pedidos, vinculos, euPessoaId, impedimentos });
  const contagens = contagensDoFiltro(linhas);
  const contagensDaEtiqueta = contagensDeEtiquetas(linhas, etiquetas);
  const noFiltro = linhas.filter(
    (linha) => pertenceAoFiltro(linha, endereco.filtro) && pertenceAEtiqueta(linha, etiqueta),
  );
  const encontradas = filtrarPeloNome(noFiltro, busca);
  const ordenadas = ordenarLinhas(encontradas, endereco.ordem, endereco.sentido);
  const pagina = paginar(ordenadas, endereco.pagina);
  const estado = estadoDaTabela({
    noFiltro: noFiltro.length,
    encontradas: encontradas.length,
    pagina: endereco.pagina,
    totalDePaginas: pagina.totalDePaginas,
  });

  function enderecoDe(proximo: Endereco): string {
    const consulta = escreverEndereco(proximo);
    return consulta === "" ? caminho : `${caminho}?${consulta}`;
  }

  function escrever(proximo: Endereco): void {
    window.history.pushState(null, "", enderecoDe(proximo));
  }

  function focarFiltro(): void {
    document.getElementById(idDoFiltro)?.querySelector<HTMLElement>('[data-state="on"]')?.focus();
  }

  function aoBuscar(texto: string): void {
    setBusca(texto);
    // Conjunto novo, primeira página. Sem entrada de histórico: a busca não está no endereço.
    if (endereco.pagina !== 1) window.history.replaceState(null, "", enderecoDe(naPagina(endereco, 1)));
  }

  const acoes = { areas, organizacaoId, responsabilidades, aoSair: focarFiltro };
  const textoDaEtiqueta =
    (etiqueta === null ? undefined : etiquetas.find((uma) => uma.id === etiqueta)?.nome) ??
    TEXTOS_DA_TABELA.todasAsEtiquetas;
  // Com etiqueta escolhida, o vazio do papel ("Nenhum Gestor nesta organização") seria falso: há Gestor,
  // só não com esta etiqueta (item 115).
  const vazio =
    etiqueta === null
      ? VAZIO_DO_FILTRO[endereco.filtro]
      : { titulo: TEXTOS_DA_TABELA.vazioDaEtiqueta, corpo: null };

  return (
    <div className="flex flex-col gap-5.5">
      <ToggleGroup
        id={idDoFiltro}
        type="single"
        spacing={1}
        value={endereco.filtro}
        aria-label={TEXTOS_DA_TABELA.filtrar}
        onValueChange={(escolhido) => {
          // Escolha única não se desmarca: o Radix devolve `""` ao tocar na opção marcada.
          const filtro = FILTROS.find((valor) => valor === escolhido);
          if (filtro !== undefined) escrever(comFiltro(endereco, filtro));
        }}
        className={CAIXA_DO_FILTRO}
      >
        {FILTROS.map((filtro) => (
          <OpcaoDoFiltro key={filtro} filtro={filtro} quantos={contagens[filtro]} />
        ))}
      </ToggleGroup>

      <div className="border-linha bg-superficie overflow-hidden rounded-lg border shadow-sm">
        {/* A linha da busca: o nome e, quando a organização tem etiqueta, a etiqueta — os dois com o rótulo
            acima (item 120, blocos 6 e 12). A etiqueta é seleção única com busca, a peça de T-03, e o estado
            continua no endereço (`etiqueta=<id>`). */}
        <div className="border-linha-suave flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${prefixo}-busca`} className={ROTULO_ACIMA}>
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
                /* O teto da coluna e do schema, para um nome inteiro caber. */
                maxLength={120}
                placeholder={TEXTOS_DA_TABELA.exemploDaBusca}
                value={busca}
                onChange={(evento) => {
                  aoBuscar(evento.currentTarget.value);
                }}
                className="border-linha bg-background h-11 pl-9"
              />
            </div>
          </div>
          {etiquetas.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${prefixo}-etiqueta`} className={ROTULO_ACIMA}>
                {TEXTOS_DA_TABELA.filtrarPorEtiqueta}
              </label>
              <EscolhaComBusca
                id={`${prefixo}-etiqueta`}
                nome={TEXTOS_DA_TABELA.filtrarPorEtiqueta}
                // O nome acessível contém o texto visível (WCAG 2.5.3), nas duas situações.
                rotuloAcessivel={`${TEXTOS_DA_TABELA.filtrarPorEtiqueta}: ${textoDaEtiqueta}`}
                textoDoGatilho={textoDaEtiqueta}
                ligado={etiqueta !== null}
                // *Todas* vem sempre primeiro e nunca some (spec §3.4); as etiquetas, em ordem alfabética.
                fixa={{
                  valor: "todas",
                  rotulo: TEXTOS_DA_TABELA.todasAsEtiquetas,
                  complemento: String(contagensDaEtiqueta["todas"] ?? 0),
                }}
                opcoes={etiquetas.map((opcao) => ({
                  valor: opcao.id,
                  rotulo: opcao.nome,
                  complemento: String(contagensDaEtiqueta[opcao.id] ?? 0),
                }))}
                aoEscolher={(valor) => {
                  escrever(comEtiqueta(endereco, valor === null || valor === "todas" ? null : valor));
                }}
                textoDaBusca={TEXTOS_DA_TABELA.buscarEtiqueta}
                textoDoVazio={TEXTOS_DA_TABELA.semEtiquetaComEsseNome}
                comLimpar={false}
              />
            </div>
          )}
        </div>

        {estado === "vazio-do-filtro" && <VazioDaTabela titulo={vazio.titulo} corpo={vazio.corpo} />}
        {estado === "busca-vazia" && <VazioDaTabela titulo={TEXTO_DA_BUSCA_VAZIA} corpo={null} />}

        {(estado === "lista" || estado === "alem-do-fim") && (
          <>
            {estado === "alem-do-fim" ? (
              <VazioDaTabela
                titulo={TEXTO_ALEM_DO_FIM.titulo}
                corpo={`Esta lista tem ${String(pagina.total)} ${pagina.total === 1 ? "linha" : "linhas"}, e nenhuma delas cai nesta página.`}
                acao={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      escrever(naPagina(endereco, 1));
                    }}
                    className={cn(CONTORNO_DE_ACAO, "text-interface text-tinta min-h-11 rounded-sm px-4")}
                  >
                    {TEXTO_ALEM_DO_FIM.acao}
                  </Button>
                }
              />
            ) : (
              <>
                <ul className="md:hidden">
                  {pagina.itens.map((linha, indice) => (
                    <li
                      key={linha.chave}
                      className={cn(
                        "border-linha-suave flex items-start justify-between gap-3 border-b px-4 py-3 last:border-b-0",
                        indice % 2 === 1 && "bg-background",
                        linha.tipo === "pedido" && "bg-marca/5",
                      )}
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <PessoaDaLinha linha={linha} idDoNome={`${prefixo}-p${String(indice)}`} />
                        <p className="text-meta text-tinta-suave">
                          {linha.rotuloDoPapel} · {linha.unidade ?? "—"}
                        </p>
                        <EtiquetasNaLinha etiquetas={linha.etiquetas} />
                        {/* O recuo alinha o ícone de 44 px ao texto; sem botão, o traço já está alinhado. */}
                        <div className={linha.telefones.length + linha.emails.length > 0 ? "-ml-3" : undefined}>
                          <ContatoPorIcone nome={linha.nome} telefones={linha.telefones} emails={linha.emails} />
                        </div>
                        {linha.atualizadoTexto !== null && (
                          <p className="text-meta text-tinta-suave font-mono tabular-nums">
                            {TEXTOS_DA_TABELA.atualizadoEm} {linha.atualizadoTexto}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <AcoesDaLinha linha={linha} idDoNome={`${prefixo}-p${String(indice)}`} {...acoes} />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-linha hover:bg-transparent">
                        <CabecaDaTabela coluna="pessoa" rotulo="Pessoa" endereco={endereco} aoOrdenar={escrever} />
                        <CabecaDaTabela
                          coluna="papel"
                          rotulo="Papel"
                          endereco={endereco}
                          aoOrdenar={escrever}
                          largura="w-[140px]"
                        />
                        <CabecaDaTabela
                          coluna="unidade"
                          rotulo="Unidade"
                          endereco={endereco}
                          aoOrdenar={escrever}
                          largura="w-[150px]"
                        />
                        {etiquetas.length > 0 && (
                          <TableHead className={cn(ROTULO_DE_COLUNA, "w-[180px]")}>
                            {TEXTOS_DA_TABELA.etiquetas}
                          </TableHead>
                        )}
                        <TableHead className={cn(ROTULO_DE_COLUNA, "w-[120px]")}>Contato</TableHead>
                        <CabecaDaTabela
                          coluna="atualizacao"
                          rotulo={TEXTOS_DA_TABELA.atualizacao}
                          endereco={endereco}
                          aoOrdenar={escrever}
                          largura="w-[152px]"
                        />
                        <TableHead className={cn(ROTULO_DE_COLUNA, "w-[124px]")}>
                          <span className="sr-only">{TEXTOS_DA_TABELA.acoes}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagina.itens.map((linha, indice) => (
                        <TableRow
                          key={linha.chave}
                          className={cn(
                            "border-linha-suave even:bg-background",
                            linha.tipo === "pedido" && "bg-marca/5 even:bg-marca/5",
                          )}
                        >
                          <TableCell className={CELULA}>
                            <PessoaDaLinha linha={linha} idDoNome={`${prefixo}-t${String(indice)}`} />
                          </TableCell>
                          <TableCell className={CELULA}>
                            {linha.tipo === "pedido" ? (
                              <span className="text-tinta-suave">{linha.rotuloDoPapel}</span>
                            ) : (
                              linha.rotuloDoPapel
                            )}
                          </TableCell>
                          <TableCell className={CELULA}>{linha.unidade ?? <Traco />}</TableCell>
                          {etiquetas.length > 0 && (
                            <TableCell className={cn(CELULA, "max-w-[180px]")}>
                              <EtiquetasNaLinha etiquetas={linha.etiquetas} />
                            </TableCell>
                          )}
                          <TableCell className="px-3.5 py-1.5">
                            <ContatoPorIcone nome={linha.nome} telefones={linha.telefones} emails={linha.emails} />
                          </TableCell>
                          <TableCell className={cn(CELULA, "text-tinta-suave font-mono tabular-nums")}>
                            {linha.atualizadoTexto ?? <SemAlteracao />}
                          </TableCell>
                          <TableCell className="px-3.5 py-1.5 text-right">
                            <AcoesDaLinha linha={linha} idDoNome={`${prefixo}-t${String(indice)}`} {...acoes} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <RodapeDaTabela
              faixa={faixaDaPagina(estado === "alem-do-fim" ? { inicio: 0, fim: 0, total: pagina.total } : pagina)}
              pagina={Math.min(endereco.pagina, pagina.totalDePaginas)}
              totalDePaginas={pagina.totalDePaginas}
              enderecoDe={enderecoDe}
              endereco={endereco}
              aoIr={escrever}
            />
          </>
        )}
      </div>
    </div>
  );
}

function OpcaoDoFiltro({ filtro, quantos }: { filtro: Filtro; quantos: number }) {
  /** A contagem de pedidos veste a marca quando há pedido — é a exceção que o critério 2 abre. */
  const destaque = filtro === "pedidos" && quantos > 0;
  return (
    <ToggleGroupItem
      value={filtro}
      className={OPCAO_DO_FILTRO}
    >
      {ROTULO_DO_FILTRO[filtro]}
      <span className={cn(CONTAGEM_DO_FILTRO, destaque && "bg-marca text-marca-foreground font-semibold")}>
        {quantos}
      </span>
    </ToggleGroupItem>
  );
}

/**
 * **A forma saiu para `cabeca-que-ordena.tsx` no item 67**, quando a lista de ocorrências passou a
 * ordenar pela mesma gramática. O que fica aqui é a tradução: esta tabela raciocina em `Coluna` e
 * `Endereco`, e a peça compartilhada não conhece nenhum dos dois.
 */
function CabecaDaTabela({
  coluna,
  rotulo,
  endereco,
  aoOrdenar,
  largura,
}: {
  coluna: Coluna;
  rotulo: string;
  endereco: Endereco;
  aoOrdenar: (proximo: Endereco) => void;
  largura?: string;
}) {
  return (
    <CabecaQueOrdena
      sentido={ariaSort(endereco, coluna)}
      rotulo={rotulo}
      nomeAcessivel={rotuloDoCabecalho(endereco, coluna, rotulo)}
      aoClicar={() => {
        aoOrdenar(comOrdem(endereco, coluna));
      }}
      {...(largura === undefined ? {} : { largura })}
    />
  );
}

function Traco() {
  return <span className="text-tinta-suave">—</span>;
}

/**
 * O traço da coluna de última atualização. **O `—` é decorativo e o leitor de tela ouve a frase**: um
 * travessão sozinho é lido de jeito diferente em cada leitor, e às vezes não é lido.
 */
function SemAlteracao() {
  return (
    <>
      <span aria-hidden="true" className="text-tinta-suave">
        —
      </span>
      <span className="sr-only">{TEXTOS_DA_TABELA.semAlteracao}</span>
    </>
  );
}

function PessoaDaLinha({ linha, idDoNome }: { linha: LinhaDeParticipante; idDoNome: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
      <FichaDePessoa nome={linha.nome} tamanho="linha" idDoNome={idDoNome} />
      {linha.tipo === "pedido" && (
        <Badge variant="outline" className="border-marca/60 text-tinta-marca rounded-sm">
          {TEXTOS_DA_TABELA.seloDePedido}
        </Badge>
      )}
      {linha.tipo === "vinculo" && linha.ehVoce && (
        <Badge
          variant="outline"
          className="bg-sidebar-accent text-tinta rounded-sm border-transparent"
        >
          {TEXTOS_DA_TABELA.seloVoce}
        </Badge>
      )}
      {linha.tipo === "vinculo" && !linha.vinculo.temConta && (
        <Badge variant="outline" className="border-linha text-tinta-suave rounded-sm">
          {TEXTOS_DA_TABELA.seloSemConta}
        </Badge>
      )}
    </span>
  );
}

function AcoesDaLinha({
  linha,
  idDoNome,
  areas,
  organizacaoId,
  responsabilidades,
  aoSair,
}: {
  linha: LinhaDeParticipante;
  idDoNome: string;
  areas: ReadonlyArray<{ id: string; nome: string }>;
  organizacaoId: string;
  responsabilidades: Readonly<Record<string, number>>;
  aoSair: () => void;
}) {
  if (linha.tipo === "pedido") {
    return (
      <DecisaoDePedidoDeEntrada
        pedido={linha.pedido}
        areas={areas}
        organizacaoId={organizacaoId}
        aoSair={aoSair}
      />
    );
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <LinkDeIcone
        href={`/vinculos/${linha.vinculo.pessoa.pessoaId}/editar`}
        rotulo={TEXTOS_DA_TABELA.editar}
        icone={<Pencil aria-hidden="true" />}
        descritoPor={idDoNome}
      />
      <RemocaoDeVinculo
        pessoaId={linha.vinculo.pessoa.pessoaId}
        nome={linha.nome}
        temConta={linha.vinculo.temConta}
        impedimento={linha.impedimento}
        responsavelEmAberto={responsabilidades[linha.vinculo.pessoa.pessoaId] ?? 0}
        organizacaoId={organizacaoId}
        ehMeuProprioVinculo={linha.ehVoce}
        descritoPor={idDoNome}
        aoSair={aoSair}
      />
    </span>
  );
}

function VazioDaTabela({ titulo, corpo, acao }: { titulo: string; corpo: string | null; acao?: ReactNode }) {
  return (
    <Empty className="md:p-10">
      <EmptyHeader>
        <EmptyTitle className="text-titulo-bloco text-tinta">{titulo}</EmptyTitle>
        {corpo !== null && <EmptyDescription className="text-corpo text-tinta-suave">{corpo}</EmptyDescription>}
      </EmptyHeader>
      {acao !== undefined && <EmptyContent>{acao}</EmptyContent>}
    </Empty>
  );
}

/**
 * O rodapé. **Os links são endereços de verdade** — sem `href` a página deixa de ser copiável —, e o
 * clique simples com o botão principal é interceptado; clique do meio e com tecla modificadora seguem o
 * navegador. É o desenho de `paginacao-da-lista.tsx`, e a regra de números é a mesma (`vizinhas`).
 *
 * **Ele aparece mesmo com uma página só**, como na prancheta; anterior e próxima ficam inertes nas pontas.
 */
function RodapeDaTabela({
  faixa,
  pagina,
  totalDePaginas,
  endereco,
  enderecoDe,
  aoIr,
}: {
  faixa: string;
  pagina: number;
  totalDePaginas: number;
  endereco: Endereco;
  enderecoDe: (proximo: Endereco) => string;
  aoIr: (proximo: Endereco) => void;
}) {
  const inerte = "pointer-events-none opacity-40";
  const cliqueSimples = (evento: MouseEvent<HTMLAnchorElement>) =>
    evento.button === 0 && !evento.metaKey && !evento.ctrlKey && !evento.shiftKey && !evento.altKey;

  function propsDoLink(destino: number) {
    return {
      href: enderecoDe(naPagina(endereco, destino)),
      onClick: (evento: MouseEvent<HTMLAnchorElement>) => {
        if (!cliqueSimples(evento)) return;
        evento.preventDefault();
        aoIr(naPagina(endereco, destino));
      },
    };
  }

  return (
    <div className="border-linha bg-background flex flex-col items-center gap-2 border-t px-4 py-2 md:flex-row md:justify-between">
      <p className="text-meta text-tinta-suave font-mono tracking-[0.06em] uppercase tabular-nums">{faixa}</p>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            {pagina > 1 ? (
              <PaginationPrevious {...propsDoLink(pagina - 1)} className="min-h-11" />
            ) : (
              <PaginationPrevious aria-disabled="true" className={cn("min-h-11", inerte)} />
            )}
          </PaginationItem>

          {vizinhas(pagina, totalDePaginas).map((numero, indice) =>
            numero === null ? (
              <PaginationItem key={indice === 0 ? "reticencias-antes" : "reticencias-depois"}>
                <PaginationEllipsis className="size-11" />
              </PaginationItem>
            ) : (
              <PaginationItem key={numero}>
                <PaginationLink
                  {...propsDoLink(numero)}
                  isActive={numero === pagina}
                  className="text-interface size-11 font-mono tabular-nums"
                >
                  {numero}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            {pagina < totalDePaginas ? (
              <PaginationNext {...propsDoLink(pagina + 1)} className="min-h-11" />
            ) : (
              <PaginationNext aria-disabled="true" className={cn("min-h-11", inerte)} />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
