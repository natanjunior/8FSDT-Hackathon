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
import { destinoDaAvaliacao, rotuloDePrioridade } from "./rotulos";
import { SeloDeStatus } from "./selo-de-status";
import { tempoCurto } from "./tempo-relativo";

/**
 * ============================================================================
 *  A linha inteira leva à ocorrência — item 67, critério 67.3
 * ============================================================================
 *
 * **Um link só por linha, e o alvo de teclado é o título.** Ele ganha uma camada que cobre a linha
 * inteira (`after:absolute after:inset-0`), e a linha vira `relative`. Assim o ponteiro clica em qualquer
 * lugar e chega à ocorrência, e o teclado continua com **uma parada por linha** — que é o que se perderia
 * embrulhando tudo num `<a>` com controles dentro, e o que se perderia de outro jeito pondo um link
 * invisível em cada célula.
 *
 * **O anel de foco é da linha, e não do título**, por `focus-within`: o que recebe o clique é a linha
 * toda, então é ela que precisa aparecer quando o título está focado.
 *
 * **O que fica POR CIMA vai em `relative z-10`:** o convite a avaliar e o gatilho do cartão de Tempo. Sem
 * isso a camada os cobriria, e o cartão nunca abriria.
 */
const LINHA_CLICAVEL =
  "relative hover:bg-secondary focus-within:outline-2 focus-within:outline-marca focus-within:-outline-offset-2";

/** A camada que cobre a linha. Vai no link do título, que é o alvo de teclado. */
const CAMADA_DO_TITULO =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

/** **Por cima da camada** — o que precisa de clique próprio. */
const ACIMA_DA_CAMADA = "relative z-10";


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
 * vivo. **O recuo é por tinta nomeada, nunca `opacity` na linha**: o selo e o convite a avaliar não
 * descem, porque são as duas coisas que ainda pedem leitura ou ação.
 */
function encerrada(status: string): boolean {
  return status === "resolvida" || status === "cancelada";
}

/**
 * ============================================================================
 *  T-03 · a lista, nos três recortes
 * ============================================================================
 *
 * **Dois eixos independentes, e é o que o protótipo separou (D-2):** o **recorte**
 * (`visibilidadeAplicada`) escolhe a *densidade do item*; a **largura** escolhe *quantas colunas de
 * layout* existem. É por isso que o Gestor pedindo `?autor=eu` numa tela grande recebe itens altos numa
 * coluna só — que é exatamente o que ele quer ao ler as próprias.
 *
 * | Recorte | Onde | Forma |
 * |---|---|---|
 * | **A** · `apenas_minhas` | qualquer largura | cartão alto, rótulo em destaque, **prioridade por permissão** |
 * | **B** · `todas`, ≥ `md` | tabela | seis colunas de comparação |
 * | **C** · `todas`, celular | cartão de 3 linhas | **sem categoria** — achado P-04, aprovado pelo hub |
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
   * **Quem está lendo a lista** — o `pessoaId` de quem abriu T-03, para a marca *"Conte como foi"* do
   * critério 27.5.
   *
   * **Texto, e por isso atravessa a fronteira do servidor sem problema** — ao contrário do
   * `destinoDoItem`, que é função e teve de ser montado aqui dentro (ver o bloco dele).
   *
   * **Obrigatória de propósito**: opcional, um esquecimento em quem monta a lista
   * faz o convite sumir em silêncio, e o compilador deixa de ser a garantia. O objetivo **O4** depende
   * dele existir.
   */
  pessoaIdDeQuemLe: string;
  /** O instante da renderização no servidor. */
  agora: number;
};

export function ListaDeOcorrencias({
  primeiraPagina,
  consultaAtual,
  iconePorCategoria,
  mostrarPrioridade,
  pessoaIdDeQuemLe,
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

  const comum = { destinoDoItem, iconePorCategoria, mostrarPrioridade, agora, pessoaIdDeQuemLe };

  // **Um cartão, e a ocorrência é linha dele.** Guia §1: *"onde a tentação for pôr uma caixa, ponha uma
  // pauta"*, e linha de lista está na lista do que não é caixa. O cartão em si é `CartaoDaLista`, que
  // envolve isto e é quem desenha a borda, o raio e a sombra.
  if (primeiraPagina.visibilidadeAplicada === "apenas_minhas") {
    return (
      <ul>
        {itens.map((item) => (
          <LinhaDoSolicitante key={item.id} item={item} {...comum} />
        ))}
      </ul>
    );
  }

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
  pessoaIdDeQuemLe: string;
  agora: number;
};

/**
 * **O par de datas da coluna Tempo, escrito uma vez** — item 67.
 *
 * Registrada sempre; atualizada só quando difere, marcada por `↻`. O símbolo é `aria-hidden` e os dois
 * valores levam nome em `sr-only`, porque um glifo sozinho não diz o que mede.
 *
 * **Os três recortes usam esta peça desde o item 67.** Antes, o recorte A mostrava só o tempo de
 * registro, e com a ordem nova — por última atualização — uma lista que só mostra a data de registro
 * pareceria fora de ordem.
 */
function ParDeDatas({
  registradaEm,
  atualizadaEm,
  agora,
  empilhado = false,
}: {
  registradaEm: string;
  atualizadaEm: string;
  agora: number;
  /** Na tabela as duas datas ficam uma sobre a outra; nos cartões, lado a lado. */
  empilhado?: boolean;
}) {
  const mudou = registradaEm !== atualizadaEm;
  const forma = empilhado ? "block" : undefined;

  return (
    <>
      <span className={forma}>
        <span className="sr-only">registrada </span>
        {tempoCurto(registradaEm, agora)}
      </span>
      {mudou && (
        <span className={forma}>
          {!empilhado && " "}
          <span aria-hidden="true">↻</span>
          <span className="sr-only">, atualizada </span>{" "}
          {tempoCurto(atualizadaEm, agora)}
        </span>
      )}
    </>
  );
}

/**
 * **O convite a avaliar, no item da lista** — critério 27.5, metade de T-03.
 *
 * **Três fatos, e nenhum deles é `acoesDisponiveis`:** o status, o campo `avaliada` que o item 27 pôs no
 * payload, e a autoria. **A quarta dimensão da máquina de estados — a permissão — é CONSTANTE nesta
 * tela**, porque `ocorrencia.avaliar` e `ocorrencia.ler_propria` estão as duas em `DO_SOLICITANTE`, o
 * Gestor acumula, e o Encarregado tem lista vazia e nem alcança T-03. **Os três fatos são equivalentes à
 * resposta da máquina, não uma aproximação dela** — e é por isso que isto não é a segunda cópia que o
 * critério 14.5 existe para impedir.
 *
 * **Numa função, e não num `?:` dentro de três JSX** — é a mesma razão do `segundaLinhaDeMotivo` e do
 * `vazioDaLista`: três condições que precisam concordar em três lugares é o defeito que o item 22
 * consertou ao criar `acaoPrimaria`.
 */
function convidaAAvaliar(item: OcorrenciaResumoProjetada, pessoaIdDeQuemLe: string): boolean {
  return item.status === "resolvida" && !item.avaliada && item.autor.pessoaId === pessoaIdDeQuemLe;
}

/**
 * O texto da marca. **"Conte como foi", e não a frase inteira** — é a Q-P8 do protótipo, já respondida
 * **(a)** (`prototipo-low-fi.md:1282`): na lista a frase inteira duplicaria o `statusRotulo` que o
 * servidor mandou, e a segunda cópia seria montada no cliente, que é o que o contrato §8.8 não quer.
 */
const CONVITE_A_AVALIAR = "Conte como foi";

/**
 * **Recorte A.** O `statusRotulo` é a primeira linha e é o que fica em destaque — é a resposta literal a
 * *"o que aconteceu com o meu pedido?"*.
 *
 * **A prioridade aparece por PERMISSÃO, nunca por recorte** — critério **28.6**, e é a correção **P-03**
 * do protótipo. As duas metades da regra:
 *
 * - **O Solicitante continua sem ver**, e o critério **28.4** fica literal e intacto: ele não tem
 *   `ocorrencia.alterar_prioridade` em nenhum dos dois desenhos de papel (`Permissao.ts:38-44`). *"É
 *   decisão do Gestor, e não há nada que o Solicitante faça com ela."*
 * - **Quem ganha é o síndico morador** — o Gestor que troca o recorte para *"Minhas ocorrências"*. Até
 *   aqui ele perdia a coluna de um campo que ele mesmo altera, **no mesmo gesto** em que a barra
 *   continuava lhe oferecendo o chip `Prioridade ▾`: o produto oferecia filtrar por um campo que se
 *   recusava a exibir.
 *
 * **A ordem na primeira linha, e por que a linha embrulha:** a marca do item 27 vem primeiro, a etiqueta
 * de prioridade depois. A marca é **convite e tem prazo**; a prioridade é **fato e não tem**. Quando as
 * duas coexistem — Gestor-autor numa `resolvida` ainda não avaliada — a linha **embrulha** (`flex-wrap`)
 * em vez de encolher qualquer uma: encolher é o caminho de virar cor, que é o que o compromisso **A-5**
 * proíbe.
 */
function LinhaDoSolicitante({
  item,
  destinoDoItem,
  iconePorCategoria,
  mostrarPrioridade,
  pessoaIdDeQuemLe,
  agora,
}: PropsDoItem) {
  /**
   * **A MESMA função dos recortes B e C — critério 31.6, e permissão nunca recorte.**
   *
   * A `LinhaDoSolicitante` é o recorte **A**, e ele não é só do Solicitante: é também o do **Gestor que
   * escolheu *"Minhas ocorrências"*** — o síndico morador do 28.5. Sem esta linha ele leria *"Pausada"*
   * pelado, no mesmo gesto em que a barra continua lhe oferecendo o chip `Status ▾`. É o defeito que o **28.6**
   * fechou para a prioridade, reaberto com outro campo — e o critério **14.3** já diz *"quem lê é
   * Gestor"*, não *"o recorte é de Gestor"*.
   *
   * **Custa uma chamada e nenhum argumento novo.** Para o Solicitante de verdade os dois textos
   * coincidem, a função devolve `null`, e **a linha dele não ganha nada**.
   */
  const segundaLinha = segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo);

  return (
    <li
      className={cn(LINHA_DA_LISTA, LINHA_CLICAVEL, "flex min-h-11 flex-col gap-1 px-4 py-3")}
      data-recuada={encerrada(item.status) ? "" : undefined}
    >
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex flex-col gap-0.5">
          {/* **A-5: a espera carrega a palavra, nunca só a cor.** O selo sempre imprime o
              `statusRotulo`; a forma dele diz se a ocorrência espera alguém, e nunca sozinha. */}
          <SeloDeStatus status={item.status} rotulo={item.statusRotulo} />
          {segundaLinha !== null && (
            <span className="text-meta text-tinta-suave">{segundaLinha}</span>
          )}
        </span>
        {/* **Os dois num invólucro** para que `justify-between` continue separando o status do PAR, em
            vez de espalhar três filhos pela linha. */}
        <span className="flex items-center gap-2">
          {convidaAAvaliar(item, pessoaIdDeQuemLe) && <ConviteAAvaliar id={item.id} />}
          {mostrarPrioridade && (
            <span className="text-meta shrink-0">
              <PalavraDePrioridade prioridade={item.prioridade} />
            </span>
          )}
        </span>
      </span>
      {/* **O título é o link, e a camada dele cobre a linha** (item 67): o ponteiro clica em qualquer
          lugar e o teclado continua com uma parada por linha. */}
      <Link
        href={destinoDoItem(item.id)}
        className={cn(
          CAMADA_DO_TITULO,
          "text-titulo-linha text-tinta group-data-[recuada]/linha:text-tinta-suave",
        )}
      >
        {item.titulo}
      </Link>
      <span className="text-tinta-suave text-meta group-data-[recuada]/linha:text-tinta-fraca flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <IconeDeCategoria
          nome={iconePorCategoria[item.categoria.id] ?? "tag"}
          className="size-3.5 shrink-0"
        />
        {item.categoria.nome} ·
        <FichaDeLocal nomeDaArea={item.area.nome} />
        {item.quantidadeDeAnexos > 0 && ` · ${String(item.quantidadeDeAnexos)} foto`}
      </span>
      {/* A meta segue a prancheta, `--ink-soft` (exceção c do critério 44q.14): é o mesmo elemento no
          mesmo papel. A tinta fraca reprovava no contraste de texto. */}
      <span className="text-tinta-suave text-meta group-data-[recuada]/linha:text-tinta-fraca flex flex-wrap items-center gap-1.5">
        {item.responsavel !== null && (
          <>
            <FichaDePessoa nome={item.responsavel.nome} /> está cuidando ·
          </>
        )}
        {/* **O par, e não só o registro** (item 67): a lista abre ordenada pela última atualização, e
            mostrar só a data de registro a faria parecer fora de ordem. */}
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
 * **O convite a avaliar virou ação no item 67** — antes era frase solta, que dizia o que fazer e não
 * levava a lugar nenhum.
 *
 * **`z-10`, por cima da camada da linha**, e sublinhado: ele leva a um destino diferente do resto da
 * linha. Alvo de 44 px, como tudo que se clica.
 */
function ConviteAAvaliar({ id }: { id: string }) {
  return (
    <Link
      href={destinoDaAvaliacao(id)}
      className={cn(
        ACIMA_DA_CAMADA,
        "text-marca text-meta inline-flex min-h-11 shrink-0 items-center font-medium underline underline-offset-4",
      )}
    >
      {CONVITE_A_AVALIAR}
    </Link>
  );
}

/**
 * **Recorte C — o caso que o inventário não cobria**, e é a tela da Persona 1A: o síndico que mora no
 * prédio e anda por ele com o celular na mão.
 *
 * **Cai a categoria, e com ela o ícone.** É o achado **P-04**, aprovado pelo hub ao responder a P3: a
 * categoria é a dimensão pela qual o Gestor **recorta**, não a que ele **compara**. O critério 14.6 vale
 * nos recortes que exibem o nome — *"ao lado do nome, nunca no lugar dele"* é regra que se autolimita.
 */
function LinhaDeTriagemNoCelular({
  item,
  destinoDoItem,
  mostrarPrioridade,
  pessoaIdDeQuemLe,
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
        <span className="flex items-center gap-2">
          <SeloDeStatus status={item.status} rotulo={item.statusRotulo} />
          {/* **Em `resolvida` a segunda linha do motivo é sempre nula** — `segundaLinhaDeMotivo` só
              devolve texto em `pausada` —, então os dois nunca aparecem juntos. */}
          {segundaLinha !== null && (
            <span className="text-meta text-tinta-suave">{segundaLinha}</span>
          )}
          {convidaAAvaliar(item, pessoaIdDeQuemLe) && <ConviteAAvaliar id={item.id} />}
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
      <span className="text-tinta-suave text-meta group-data-[recuada]/linha:text-tinta-fraca flex flex-wrap items-center gap-1.5">
        <FichaDeLocal nomeDaArea={item.area.nome} />·
        {item.responsavel === null ? (
          "sem responsável"
        ) : (
          <FichaDePessoa nome={item.responsavel.nome} />
        )}
        ·
        {/* **No celular não há cartão** — `hover` não existe em toque, e o par já está aqui, por extenso
            na linha de meta. */}
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
 * **`registradaEm` e `atualizadaEm` dividem a coluna TEMPO**, a segunda marcada por `↻` — o protótipo:
 * *"duas colunas de data numa tabela de triagem é uma coluna a mais para uma leitura que ninguém faz de
 * relance"*.
 *
 * **A segunda metade só aparece quando há diferença** (item 44p, critério 12): numa ocorrência que
 * ninguém tocou os dois instantes são iguais, e o `↻` repetia o mesmo número. O símbolo é `aria-hidden` e
 * os dois valores levam nome em `sr-only` — um glifo sozinho não diz o que mede.
 */
function TabelaDeTriagem({
  itens,
  consultaAtual,
  destinoDoItem,
  iconePorCategoria,
  mostrarPrioridade,
  pessoaIdDeQuemLe,
  agora,
}: {
  itens: readonly OcorrenciaResumoProjetada[];
  consultaAtual: string;
  destinoDoItem: (id: string) => string;
  iconePorCategoria: Readonly<Record<string, string>>;
  mostrarPrioridade: boolean;
  pessoaIdDeQuemLe: string;
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
                  {segundaLinha !== null && (
                    <span className="text-meta text-tinta-suave mt-1 block">{segundaLinha}</span>
                  )}
                  {/* **A marca vale nos TRÊS recortes**, e não só no do Solicitante: a condição do
                      critério 27.5 é POR ITEM, e limitá-la ao recorte A deixaria o **Gestor-autor** — o
                      síndico morador — sem convite. */}
                  {convidaAAvaliar(item, pessoaIdDeQuemLe) && (
                    <span className="mt-1 block">
                      <ConviteAAvaliar id={item.id} />
                    </span>
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
                  <span className="text-tinta-suave text-meta group-data-[recuada]/linha:text-tinta-fraca mt-0.5 flex items-center gap-1.5">
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
                    <span className="text-tinta-fraca">—</span>
                  ) : (
                    <FichaDePessoa nome={item.responsavel.nome} />
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    CELULA,
                    "text-tinta-suave text-meta group-data-[recuada]/linha:text-tinta-fraca font-mono whitespace-nowrap tabular-nums",
                  )}
                >
                  <CartaoDeTempo
                    destino={destinoDoItem(item.id)}
                    registradaEm={item.registradaEm}
                    atualizadaEm={item.atualizadaEm}
                    agora={agora}
                  />
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
 * célula continua dizendo exatamente o que dizia, com os nomes em `sr-only`.
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
