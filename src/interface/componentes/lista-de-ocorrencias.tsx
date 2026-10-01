"use client";

import Link from "next/link";
import { Badge } from "@/interface/componentes/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/interface/componentes/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/interface/componentes/ui/table";
import { cn } from "@/interface/componentes/utilitarios";
import { segundaLinhaDeMotivo } from "@/interface/projecoes";
import type { OcorrenciaResumoProjetada, PaginaDeOcorrenciasProjetada } from "@/interface/projecoes";

import { CabecaQueOrdena } from "./cabeca-que-ordena";
import { dataEHora } from "./datas";
import { FichaDeLocal } from "./ficha-de-local";
import { FichaDePessoa } from "./ficha-de-pessoa";
import { IconeDeCategoria } from "./icone-de-categoria";
import { ACIMA_DA_CAMADA, CAMADA_DO_TITULO, LINHA_CLICAVEL } from "./linha-clicavel";
import { useNavegacaoDaLista } from "./navegacao-da-lista";
import {
  ariaSortNaLista,
  consultaComOrdenacao,
  lerOrdenacaoDaLista,
  proximaNaLista,
  rotuloNaLista,
  type ColunaDaLista,
} from "./ordenacao-das-ocorrencias";
import { CELULA } from "./pecas-da-tabela";
import { fraseDaParada, rotuloDePrioridade } from "./rotulos";
import { SeloDeNaoVista } from "./selo-de-nao-vista";
import { SeloDeStatus } from "./selo-de-status";
import { tempoCurto } from "./tempo-relativo";

/**
 * A prioridade **em selo de contorno, nos três níveis** — item 64. A palavra fica dentro do selo (guia
 * §2, *"todo selo carrega a palavra"*), e só `alta` tem cor, `--destructive`; `normal` e `baixa` ganham
 * forma, não tinta. **Contorno sempre**: o selo de status é a peça cheia da linha, e nenhuma outra é.
 */
const FORMA_DA_PRIORIDADE: Readonly<Record<OcorrenciaResumoProjetada["prioridade"], string>> = {
  alta: "border-destructive text-destructive bg-transparent",
  normal: "border-linha text-tinta-suave bg-transparent",
  baixa: "border-linha text-tinta-suave bg-transparent",
};

function PalavraDePrioridade({ prioridade }: { prioridade: OcorrenciaResumoProjetada["prioridade"] }) {
  return (
    <Badge variant="outline" className={FORMA_DA_PRIORIDADE[prioridade]}>
      {rotuloDePrioridade(prioridade)}
    </Badge>
  );
}

/**
 * A régua e a faixa, escritas uma vez — critério 44c.1.
 *
 * **A faixa é `--ground` (`bg-background`), e não `--sunken`.** No tema escuro `--sunken` e `--line-soft`
 * têm o mesmo valor, e a régua desapareceria em cima dela. Com o chão da página, os dois ficam visíveis
 * nos dois temas. Decidido em `respostas.md` P2.
 */
const LINHA_DA_LISTA = "group/linha border-linha-suave border-b even:bg-background last:border-b-0";

/**
 * *Resolvida* e *Cancelada* descem um degrau de tinta (critério 44q.9): o olho varre primeiro o que está
 * vivo. **O recuo é por tinta nomeada, nunca `opacity` na linha**: o selo não desce, porque é o que
 * ainda pede leitura.
 */
function encerrada(status: string): boolean {
  return status === "resolvida" || status === "cancelada";
}

/**
 * ============================================================================
 *  T-03 · a lista, um desenho em duas larguras
 * ============================================================================
 *
 * **O recorte não muda a forma** (critério 76.3): *Todas* e *Minhas ocorrências* são a mesma tabela e a
 * mesma linha de celular. O que muda entre os recortes é conteúdo, nunca estrutura.
 *
 * | Largura | Forma |
 * |---|---|
 * | ≥ `md` | tabela de cinco ou seis colunas — *Prioridade* segue **permissão**, nunca recorte (28.6) |
 * | celular | linha de três andares, **sem categoria** — achado P-04 do 44c, aprovado pelo hub |
 *
 * **Desde o item 88, na aba *Compartilhadas comigo* a faixa de selos leva *Não vista* ao lado do status.**
 * A faixa do celular passou a quebrar (`flex-wrap`) para caber com o status mais longo do Solicitante.
 *
 * **Até o item 76 havia um terceiro desenho**, o cartão alto do recorte A (44c), para *Minhas
 * ocorrências*. O 76 o tirou: o que muda entre os recortes é conteúdo, nunca estrutura. **O preço**, e
 * ele é aceito: no celular o Solicitante deixa de ver a categoria na linha, que continua em T-05.
 *
 * **Nenhuma ação no item** (critério 14.5): `acoesDisponiveis` não existe no `OcorrenciaResumo`, e uma
 * ação de lote obrigaria o cliente a adivinhar quais itens a aceitam — a segunda cópia da máquina de
 * estados. O item inteiro é **um link para T-05**.
 *
 * **`agora` vem do servidor** e não de `Date.now()` aqui: a primeira renderização acontece no servidor e a
 * hidratação no navegador, e dois relógios produziriam dois textos.
 *
 * **Sem *Carregar mais*, desde o item 14b (09/09/2026).** A paginação é numerada e mora nos
 * `searchParams`: quem renderiza a página pedida é o Server Component, e este componente passou a ser
 * **só desenho** — recebe uma página inteira e a pinta, sem estado e sem `fetch`. O controle numerado, a
 * linha de deriva e o estado de *página além do fim* nasceram no item 44c, em peças próprias: aqui ficam
 * só as linhas.
 *
 * **A ocorrência deixou de ser caixa e virou linha** — item 44c, guia §1: *"onde a tentação for pôr uma
 * caixa, ponha uma pauta"*. Quem desenha a borda, o raio e a sombra é o `CartaoDaLista`, que envolve
 * isto; aqui não há moldura nenhuma.
 */
type Props = {
  /**
   * A página que o servidor renderizou — **uma página inteira, não a primeira de várias**.
   *
   * O nome sobreviveu ao item 14b, quando a paginação deixou de acumular no cliente. Renomeá-lo aqui
   * colidiria com a reescrita da frente de design, que é quem monta a navegação numerada.
   *
   * **Ela já traz tudo o que essa navegação vai precisar** — `total`, `pagina`, `limite`, `ate`,
   * `totalNoCorte`, `saidasDesdeOCorte`, `novasDesdeOCorte` e as `contagens` —, e é por isso que a
   * propriedade continua sendo **uma só**: quando o controle nascer, a assinatura não muda de novo.
   */
  primeiraPagina: PaginaDeOcorrenciasProjetada;
  /** A *query string* atual, crua — o insumo do cabeçalho que ordena (item 67). */
  consultaAtual: string;
  /** `categoriaId → nome do ícone`, cruzado **no cliente** contra `GET /categorias` (critério 14.6). */
  iconePorCategoria: Readonly<Record<string, string>>;
  /**
   * A prioridade aparece para quem **pode alterá-la** — `ocorrencia.alterar_prioridade`.
   *
   * **Permissão, nunca recorte:** é a correção **P-03** do protótipo. A regra do inventário
   * (`visibilidadeAplicada == "todas"`) faria o Gestor que filtra pelas próprias perder a coluna de um
   * campo que ele mesmo altera. Está como achado A-3 na spec.
   */
  mostrarPrioridade: boolean;
  /**
   * O destaque de parada aparece para quem tem `ocorrencia.ler_todas` — item 101. Para o Solicitante a
   * linha do tempo já diz a última data, e o destaque é instrumento de quem cobra o atendimento.
   */
  mostrarParada: boolean;
  /** O instante da renderização no servidor. */
  agora: number;
};

export function ListaDeOcorrencias({
  primeiraPagina,
  consultaAtual,
  iconePorCategoria,
  mostrarPrioridade,
  mostrarParada,
  agora,
}: Props) {
  // **Uma página inteira, lida direto** — item 14b. O componente deixou de acumular: cada página vem
  // do servidor, e não há estado a preservar entre elas.
  const itens = primeiraPagina.itens;

  /**
   * **O link de cada item é o endereço da ocorrência, e só ele.** Até o item 44g ele levava o parâmetro
   * `de` com o recorte, para o *Voltar* de T-05 devolver a lista filtrada; o *Voltar* saiu (critério
   * 44g.10), e quem devolve a lista filtrada é o botão voltar do navegador. **Continua função**, porque os
   * dois desenhos de linha a recebem pronta.
   */
  const destinoDoItem = (id: string) => `/ocorrencias/${id}`;

  const comum = { destinoDoItem, iconePorCategoria, mostrarPrioridade, mostrarParada, agora };

  // **Uma forma nos dois recortes** (critério 76.3): o que muda entre *Todas* e *Minhas* é conteúdo,
  // nunca estrutura. A tabela a partir de `md`, a linha de três andares abaixo dele. O cartão em volta é
  // `CartaoDaLista`, que envolve isto e é quem desenha a borda, o raio e a sombra.
  return (
    <>
      <ul className="md:hidden">
        {itens.map((item) => (
          <LinhaDeTriagemNoCelular key={item.id} item={item} {...comum} />
        ))}
      </ul>
      <TabelaDeTriagem itens={itens} consultaAtual={consultaAtual} {...comum} />
    </>
  );
}

type PropsDoItem = {
  item: OcorrenciaResumoProjetada;
  /** O endereço de T-05 **com o recorte de origem**, quando há um. */
  destinoDoItem: (id: string) => string;
  iconePorCategoria: Readonly<Record<string, string>>;
  mostrarPrioridade: boolean;
  mostrarParada: boolean;
  agora: number;
};

/**
 * **A pílula de parada — item 101, critério 2.**
 *
 * **Em todo recorte, e não só dentro do filtro:** o filtro é a porta, o destaque é o sinal. O Gestor que
 * abre *Todas* vê quais estão paradas sem precisar saber que o filtro existe.
 *
 * **O par de cores é `bg-atencao` com `text-marca-foreground`**, o mesmo do selo `pausada`, e o único par
 * de atenção que `tema.test.ts` mede nos três modos — claro, escuro e alto contraste. Nenhuma tinta de
 * texto do catálogo é de aviso, e inventar uma abriria frente de contraste que o item 89 fechou.
 */
function SeloDeParada({ dias }: { dias: number | null }) {
  const frase = fraseDaParada(dias);
  if (frase === null) return null;

  return (
    <Badge className="bg-atencao text-marca-foreground text-rotulo-peca border-transparent font-normal">
      {frase}
    </Badge>
  );
}

/**
 * **O par de datas, escrito uma vez** — item 67, nomeado no item 102.
 *
 * Registrada sempre; atualizada só quando difere (item 44p, critério 12). **Cada valor leva a palavra ao
 * lado, na tela** (critério 102.1): a seta circular e os nomes em `sr-only` saíram, porque um glifo sozinho não dizia
 * o que media e o nome só existia para quem usa leitor de tela. A coluna ordena pelo segundo valor, e sem
 * nome a primeira coluna de números parecia fora de ordem (A-004).
 *
 * **Empilhado (a tabela), é uma grade de duas colunas**: o valor alinhado à direita, em tinta, e a palavra à
 * esquerda, em meta, para as palavras formarem uma coluna e os números se compararem pela unidade. **Em
 * fileira (o celular, desde a P1 da spec)**, os dois pares separados pelo `·` da linha de meta, na tinta dela.
 */
export function ParDeDatas({
  registradaEm,
  atualizadaEm,
  agora,
  empilhado = false,
}: {
  registradaEm: string;
  atualizadaEm: string;
  agora: number;
  /** Na tabela as duas datas ficam uma sobre a outra; no celular, lado a lado. */
  empilhado?: boolean;
}) {
  const mudou = registradaEm !== atualizadaEm;

  if (empilhado) {
    const valor = "text-tinta group-data-[recuada]/linha:text-tinta-suave text-right";
    return (
      <span className="grid grid-cols-[auto_auto] justify-start gap-x-1.5">
        <span className={valor}>{tempoCurto(registradaEm, agora)}</span>
        <span>registrada</span>
        {mudou && (
          <>
            <span className={valor}>{tempoCurto(atualizadaEm, agora)}</span>
            <span>atualizada</span>
          </>
        )}
      </span>
    );
  }

  return (
    <>
      {tempoCurto(registradaEm, agora)} registrada
      {mudou && <> · {tempoCurto(atualizadaEm, agora)} atualizada</>}
    </>
  );
}

/**
 * **Recorte C — o caso que o inventário não cobria**, e é a tela da Persona 1A: o síndico que mora no
 * prédio e anda por ele com o celular na mão.
 *
 * **Cai a categoria, e com ela o ícone.** É o achado **P-04**, aprovado pelo hub ao responder a P3: a
 * categoria é a dimensão pela qual o Gestor **recorta**, não a que ele **compara**. O critério 14.6 vale
 * nos recortes que exibem o nome — *"ao lado do nome, nunca no lugar dele"* é regra que se autolimita.
 *
 * **Serve aos dois recortes desde o item 76.**
 */
function LinhaDeTriagemNoCelular({
  item,
  destinoDoItem,
  mostrarPrioridade,
  mostrarParada,
  agora,
}: PropsDoItem) {
  /** **A segunda metade só sai quando acrescenta informação** — critério 23.6. Até o item 31 o
   *  `statusRotulo` já É o rótulo do motivo, e imprimir os dois repetiria a mesma frase. */
  const segundaLinha = segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo);

  return (
    <li
      className={cn(LINHA_DA_LISTA, LINHA_CLICAVEL, "flex min-h-11 flex-col gap-1 px-4 py-3")}
      data-recuada={encerrada(item.status) ? "" : undefined}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <SeloDeStatus status={item.status} rotulo={item.statusRotulo} />
          {/* **`=== true`, e não `??`** — o campo é `boolean | undefined` na projeção, e `undefined`
              significa *"a pergunta não foi feita"*. Em *Minhas* e em *Todas* nenhuma linha leva selo, por
              construção. */}
          {item.naoAberta === true && <SeloDeNaoVista />}
          {/* **Ao lado do selo de status**, que é onde o olho já procura sinal (item 101). */}
          {mostrarParada && <SeloDeParada dias={item.paradaHaDias} />}
          {segundaLinha !== null && (
            <span className="text-meta text-tinta-suave">{segundaLinha}</span>
          )}
        </span>
        {/* A-5: a prioridade carrega a palavra. Nunca só a cor. */}
        {mostrarPrioridade && (
          <span className="text-meta shrink-0">
            <PalavraDePrioridade prioridade={item.prioridade} />
          </span>
        )}
      </span>
      <Link
        href={destinoDoItem(item.id)}
        className={cn(
          CAMADA_DO_TITULO,
          "text-titulo-linha text-tinta group-data-[recuada]/linha:text-tinta-suave",
        )}
      >
        {item.titulo}
      </Link>
      <span className="text-tinta-suave text-meta flex flex-wrap items-center gap-1.5">
        <FichaDeLocal nomeDaArea={item.area.nome} />·
        {item.responsavel === null ? (
          "sem responsável"
        ) : (
          <FichaDePessoa nome={item.responsavel.nome} />
        )}
        ·
        {/* **No celular não há cartão** — `hover` não existe em toque. O par vem com as palavras na linha de
            meta (item 102, P1 da spec), que é o único lugar desta largura que diz o que cada número mede. */}
        <span className="font-mono tabular-nums">
          <ParDeDatas
            registradaEm={item.registradaEm}
            atualizadaEm={item.atualizadaEm}
            agora={agora}
          />
        </span>
      </span>
    </li>
  );
}

/**
 * **Recorte B — a tabela de triagem.**
 *
 * **Uma linha por ocorrência, e o secundário vai como segunda linha dentro da célula.** O protótipo
 * desenha duas `<tr>` por item com truque de borda; aqui não, e a razão é o compromisso **A-7**, *tabela
 * de verdade*: numa tabela, uma linha **é** um registro, e duas `<tr>` por ocorrência mentem para quem
 * navega por leitor de tela.
 *
 * **`registradaEm` e `atualizadaEm` dividem a coluna TEMPO**, cada uma com a palavra ao lado (item 102) — o
 * protótipo: *"duas colunas de data numa tabela de triagem é uma coluna a mais para uma leitura que ninguém
 * faz de relance"*. **A segunda só aparece quando há diferença** (item 44p, critério 12).
 *
 * **Serve aos dois recortes desde o item 76.**
 */
function TabelaDeTriagem({
  itens,
  consultaAtual,
  destinoDoItem,
  iconePorCategoria,
  mostrarPrioridade,
  mostrarParada,
  agora,
}: {
  itens: readonly OcorrenciaResumoProjetada[];
  consultaAtual: string;
  destinoDoItem: (id: string) => string;
  iconePorCategoria: Readonly<Record<string, string>>;
  mostrarPrioridade: boolean;
  mostrarParada: boolean;
  agora: number;
}) {
  const { navegar } = useNavegacaoDaLista();
  const ordem = lerOrdenacaoDaLista(new URLSearchParams(consultaAtual));

  /**
   * **Ordenar é navegação com `push`, e tira a página** — conjunto novo, corte novo. O estado vive na
   * URL, como os filtros: um cabeçalho que guardasse ordem em estado local perderia a ordem no *Voltar*
   * do navegador e a esconderia de quem copia o endereço.
   */
  function cabeca(coluna: ColunaDaLista, rotulo: string, largura?: string) {
    return (
      <CabecaQueOrdena
        sentido={ariaSortNaLista(ordem, coluna)}
        rotulo={rotulo}
        nomeAcessivel={rotuloNaLista(ordem, coluna, rotulo)}
        aoClicar={() => {
          navegar(consultaComOrdenacao(consultaAtual, proximaNaLista(ordem, coluna)));
        }}
        {...(largura === undefined ? {} : { largura })}
      />
    );
  }

  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-linha-suave hover:bg-transparent">
            {cabeca("status", "Status")}
            {cabeca("titulo", "Título")}
            {cabeca("area", "Onde")}
            {mostrarPrioridade && cabeca("prioridade", "Prioridade")}
            {cabeca("responsavel", "Responsável")}
            {cabeca("atualizacao", "Tempo")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => {
            /* **A MESMA função dos outros dois recortes** — critério 23.6. Duas condições que precisam
               concordar em dois lugares é o defeito que o item 22 consertou ao criar `acaoPrimaria`. */
            const segundaLinha = segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo);

            return (
              <TableRow
                key={item.id}
                className={cn(LINHA_DA_LISTA, LINHA_CLICAVEL, "align-top")}
                data-recuada={encerrada(item.status) ? "" : undefined}
              >
                <TableCell className={CELULA}>
                  <SeloDeStatus status={item.status} rotulo={item.statusRotulo} />
                  {item.naoAberta === true && <SeloDeNaoVista />}
                  {segundaLinha !== null && (
                    <span className="text-meta text-tinta-suave mt-1 block">{segundaLinha}</span>
                  )}
                </TableCell>
                {/* **O `whitespace-normal` desfaz o `whitespace-nowrap` que o `TableCell` do catálogo
                    traz.** O título é texto livre de até 120 caracteres; sem isto a tabela rolaria na
                    horizontal em vez de embrulhar, que é a leitura que o recorte B existe para dar. */}
                <TableCell className={cn(CELULA, "whitespace-normal")}>
                  <Link
                    href={destinoDoItem(item.id)}
                    className={cn(
                      CAMADA_DO_TITULO,
                      "text-titulo-linha text-tinta group-data-[recuada]/linha:text-tinta-suave underline-offset-4 hover:underline",
                    )}
                  >
                    {item.titulo}
                  </Link>
                  <span className="text-tinta-suave text-meta mt-0.5 flex items-center gap-1.5">
                    <IconeDeCategoria
                      nome={iconePorCategoria[item.categoria.id] ?? "tag"}
                      className="size-3.5 shrink-0"
                    />
                    {item.categoria.nome}
                    {item.quantidadeDeAnexos > 0 && ` · ${String(item.quantidadeDeAnexos)} foto`}
                  </span>
                </TableCell>
                <TableCell className={CELULA}>
                  <FichaDeLocal nomeDaArea={item.area.nome} />
                </TableCell>
                {mostrarPrioridade && (
                  <TableCell className={CELULA}>
                    <PalavraDePrioridade prioridade={item.prioridade} />
                  </TableCell>
                )}
                <TableCell className={CELULA}>
                  {item.responsavel === null ? (
                    <span className="text-tinta-suave">—</span>
                  ) : (
                    <FichaDePessoa nome={item.responsavel.nome} />
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    CELULA,
                    "text-tinta-suave text-meta font-mono whitespace-nowrap tabular-nums",
                  )}
                >
                  <CartaoDeTempo
                    destino={destinoDoItem(item.id)}
                    registradaEm={item.registradaEm}
                    atualizadaEm={item.atualizadaEm}
                    agora={agora}
                  />
                  {/* **Abaixo do par de datas**, na coluna que já fala de tempo (item 101). */}
                  {mostrarParada && item.paradaHaDias !== null && (
                    <span className="mt-1 block font-sans">
                      <SeloDeParada dias={item.paradaHaDias} />
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * **O cartão da coluna Tempo — item 67, critério 67.6.**
 *
 * A coluna mostra dois instantes relativos e nada na tela dizia o que cada um é. O cartão nomeia os dois,
 * por extenso e sempre os dois, mesmo quando iguais: *"Registrada em"* e *"Atualizada em"*.
 *
 * **É atalho, e não o único caminho.** `hover` não existe em toque, então as duas datas continuam
 * legíveis na página da ocorrência, e o celular recebe o par direto na linha de meta. Sem o cartão, a
 * célula continua dizendo o que cada número é: a palavra está ao lado dele (item 102).
 *
 * **O gatilho é ele mesmo um link para a ocorrência, fora da ordem de tabulação** (`tabIndex={-1}`).
 * Assim o ponteiro que para em cima dele abre o cartão, e o clique nele abre a ocorrência como no resto
 * da linha — sem isso, a linha teria uma ilha onde clicar não faz nada. Fora da tabulação porque o alvo
 * de teclado da linha já é o título, e uma segunda parada por linha não acrescentaria destino nenhum.
 */
function CartaoDeTempo({
  destino,
  registradaEm,
  atualizadaEm,
  agora,
}: {
  destino: string;
  registradaEm: string;
  atualizadaEm: string;
  agora: number;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link href={destino} tabIndex={-1} className={cn(ACIMA_DA_CAMADA, "block")}>
          <ParDeDatas
            registradaEm={registradaEm}
            atualizadaEm={atualizadaEm}
            agora={agora}
            empilhado
          />
        </Link>
      </HoverCardTrigger>
      <HoverCardContent data-cartao-de-ponteiro className="text-meta w-64">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-tinta-suave">Registrada em</dt>
          <dd className="text-tinta font-mono tabular-nums">{dataEHora(registradaEm)}</dd>
          <dt className="text-tinta-suave">Atualizada em</dt>
          <dd className="text-tinta font-mono tabular-nums">{dataEHora(atualizadaEm)}</dd>
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}
