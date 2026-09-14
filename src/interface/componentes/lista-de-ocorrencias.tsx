"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/interface/componentes/ui/table";
import { segundaLinhaDeMotivo } from "@/interface/projecoes";
import type { OcorrenciaResumoProjetada, PaginaDeOcorrenciasProjetada } from "@/interface/projecoes";

import { FichaDeLocal } from "./ficha-de-local";
import { FichaDePessoa } from "./ficha-de-pessoa";
import { IconeDeCategoria } from "./icone-de-categoria";
import { rotuloDePrioridade } from "./rotulos";
import { SeloDeStatus } from "./selo-de-status";
import { tempoCurto, tempoRelativo } from "./tempo-relativo";

/**
 * A prioridade **em palavra, na linha de apoio** — guia §2. `alta` recebe `--destructive`; `normal` e
 * `baixa` não recebem cor. Deixa de ser a pílula com borda dos dois cartões, porque o guia §1 tira a
 * caixa de rótulo de estado.
 */
function PalavraDePrioridade({ prioridade }: { prioridade: OcorrenciaResumoProjetada["prioridade"] }) {
  return (
    <span className={prioridade === "alta" ? "text-destructive font-medium" : "text-tinta-suave"}>
      {rotuloDePrioridade(prioridade)}
    </span>
  );
}

/**
 * A régua e a faixa, escritas uma vez — critério 44c.1.
 *
 * **A faixa é `--ground` (`bg-background`), e não `--sunken`.** No tema escuro `--sunken` e `--line-soft`
 * têm o mesmo valor, e a régua desapareceria em cima dela. Com o chão da página, os dois ficam visíveis
 * nos dois temas. Decidido em `respostas.md` P2.
 */
const LINHA_DA_LISTA = "border-linha-suave border-b even:bg-background last:border-b-0";

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
  /**
   * A *query string* de T-03, crua — o recorte que definiu esta lista. Vazia quando não há filtro.
   *
   * **Obrigatória de propósito** (item 15): opcional, um esquecimento em quem monta a lista faz o *Voltar*
   * de T-05 perder o filtro em silêncio, e o compilador deixa de ser a garantia.
   */
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
   * **Obrigatória de propósito**, como `consultaAtual`: opcional, um esquecimento em quem monta a lista
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
   * **O recorte viaja com o link, e só quando existe** — a metade do critério 15.3 que fala do *Voltar*.
   *
   * Um `<Link href="/ocorrencias">` estático em T-05 devolveria a lista **do zero**: o gesto de voltar do
   * sistema preserva a URL, o **controle da tela** não. Com `?de=`, T-05 sabe para onde voltar mesmo quem
   * abriu o link numa aba nova, sem histórico — que é a condição que o critério 11.7 impõe ao endereço.
   *
   * **Sem filtro, o endereço não ganha nada:** `/ocorrencias/{id}` continua limpo, e é ele que se
   * compartilha. Quem copia a URL no meio de uma triagem filtrada leva `?de=` junto — inútil para quem
   * recebe, e inofensivo: T-05 não a usa para mais nada.
   *
   * **Montado aqui, e não recebido pronto da página.** O plano previa `destinoDoItem` descendo como
   * propriedade, mas este é um Client Component e **função não atravessa a fronteira do servidor**. A
   * regra é a mesma; a peça que atravessa é `consultaAtual`, que é texto.
   */
  const destinoDoItem = (id: string) =>
    consultaAtual === ""
      ? `/ocorrencias/${id}`
      : `/ocorrencias/${id}?de=${encodeURIComponent(consultaAtual)}`;

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
      <TabelaDeTriagem itens={itens} {...comum} />
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
    <li className={LINHA_DA_LISTA}>
      <Link
        href={destinoDoItem(item.id)}
        className="hover:bg-muted/60 flex min-h-11 flex-col gap-1 px-4 py-3 transition-colors"
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
            {convidaAAvaliar(item, pessoaIdDeQuemLe) && (
              /* **Marca, não botão.** O item inteiro já é um `<Link>`; um segundo alvo aqui dentro é
                 conteúdo interativo aninhado e alvo pequeno dentro de alvo grande (A-3), e seria a
                 primeira ação no item da lista, que o critério 14.5 proíbe. **A-5:** carrega a palavra. */
              <span className="text-marca text-meta shrink-0 font-medium">{CONVITE_A_AVALIAR}</span>
            )}
            {mostrarPrioridade && (
              <span className="text-meta shrink-0">
                <PalavraDePrioridade prioridade={item.prioridade} />
              </span>
            )}
          </span>
        </span>
        <span className="text-titulo-linha text-tinta leading-snug font-medium">{item.titulo}</span>
        <span className="text-tinta-suave text-meta flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <IconeDeCategoria
            nome={iconePorCategoria[item.categoria.id] ?? "tag"}
            className="size-3.5 shrink-0"
          />
          {item.categoria.nome} ·
          <FichaDeLocal nomeDaArea={item.area.nome} />
          {item.quantidadeDeAnexos > 0 && ` · ${String(item.quantidadeDeAnexos)} foto`}
        </span>
        <span className="text-tinta-fraca text-meta flex flex-wrap items-center gap-1.5">
          {item.responsavel !== null && (
            <>
              <FichaDePessoa nome={item.responsavel.nome} /> está cuidando ·
            </>
          )}
          <span className="font-mono tabular-nums">{tempoRelativo(item.registradaEm, agora)}</span>
        </span>
      </Link>
    </li>
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
    <li className={LINHA_DA_LISTA}>
      <Link
        href={destinoDoItem(item.id)}
        className="hover:bg-muted/60 flex min-h-11 flex-col gap-1 px-4 py-3 transition-colors"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <SeloDeStatus status={item.status} rotulo={item.statusRotulo} />
            {/* **Em `resolvida` a segunda linha do motivo é sempre nula** — `segundaLinhaDeMotivo` só
                devolve texto em `pausada` —, então os dois nunca aparecem juntos. */}
            {segundaLinha !== null && (
              <span className="text-meta text-tinta-suave">{segundaLinha}</span>
            )}
            {convidaAAvaliar(item, pessoaIdDeQuemLe) && (
              <span className="text-marca text-meta font-medium">{CONVITE_A_AVALIAR}</span>
            )}
          </span>
          {/* A-5: a prioridade carrega a palavra. Nunca só a cor. */}
          {mostrarPrioridade && (
            <span className="text-meta shrink-0">
              <PalavraDePrioridade prioridade={item.prioridade} />
            </span>
          )}
        </span>
        <span className="text-titulo-linha text-tinta leading-snug font-medium">{item.titulo}</span>
        <span className="text-tinta-suave text-meta flex flex-wrap items-center gap-1.5">
          <FichaDeLocal nomeDaArea={item.area.nome} />·
          {item.responsavel === null ? (
            "sem responsável"
          ) : (
            <FichaDePessoa nome={item.responsavel.nome} />
          )}
          ·
          <span className="font-mono tabular-nums">
            {tempoCurto(item.registradaEm, agora)} ↻ {tempoCurto(item.atualizadaEm, agora)}
          </span>
        </span>
      </Link>
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
 */
/** O sétimo papel da escala: 10 px, monoespaçada, versal, entreletra de 0,11em. */
const ROTULO_DE_COLUNA =
  "text-rotulo-coluna text-tinta-fraca h-auto px-4 py-2 font-mono font-medium tracking-[0.11em] uppercase";

function TabelaDeTriagem({
  itens,
  destinoDoItem,
  iconePorCategoria,
  mostrarPrioridade,
  pessoaIdDeQuemLe,
  agora,
}: {
  itens: readonly OcorrenciaResumoProjetada[];
  destinoDoItem: (id: string) => string;
  iconePorCategoria: Readonly<Record<string, string>>;
  mostrarPrioridade: boolean;
  pessoaIdDeQuemLe: string;
  agora: number;
}) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow className="border-linha-suave hover:bg-transparent">
            <TableHead className={ROTULO_DE_COLUNA}>Status</TableHead>
            <TableHead className={ROTULO_DE_COLUNA}>Título</TableHead>
            <TableHead className={ROTULO_DE_COLUNA}>Onde</TableHead>
            {mostrarPrioridade && <TableHead className={ROTULO_DE_COLUNA}>Prioridade</TableHead>}
            <TableHead className={ROTULO_DE_COLUNA}>Responsável</TableHead>
            <TableHead className={ROTULO_DE_COLUNA}>Tempo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => {
            /* **A MESMA função dos outros dois recortes** — critério 23.6. Duas condições que precisam
               concordar em dois lugares é o defeito que o item 22 consertou ao criar `acaoPrimaria`. */
            const segundaLinha = segundaLinhaDeMotivo(item.motivoPausa, item.statusRotulo);

            return (
              <TableRow key={item.id} className={`${LINHA_DA_LISTA} align-top`}>
                <TableCell className="px-4 py-3">
                  <SeloDeStatus status={item.status} rotulo={item.statusRotulo} />
                  {segundaLinha !== null && (
                    <span className="text-meta text-tinta-suave mt-1 block">{segundaLinha}</span>
                  )}
                  {/* **A marca vale nos TRÊS recortes**, e não só no do Solicitante: a condição do
                      critério 27.5 é POR ITEM, e limitá-la ao recorte A deixaria o **Gestor-autor** — o
                      síndico morador — sem convite. */}
                  {convidaAAvaliar(item, pessoaIdDeQuemLe) && (
                    <span className="text-marca text-meta mt-1 block font-medium">
                      {CONVITE_A_AVALIAR}
                    </span>
                  )}
                </TableCell>
                {/* **O `whitespace-normal` desfaz o `whitespace-nowrap` que o `TableCell` do catálogo
                    traz.** O título é texto livre de até 120 caracteres; sem isto a tabela rolaria na
                    horizontal em vez de embrulhar, que é a leitura que o recorte B existe para dar. */}
                <TableCell className="px-4 py-3 whitespace-normal">
                  <Link
                    href={destinoDoItem(item.id)}
                    className="text-titulo-linha text-tinta font-medium underline-offset-4 hover:underline"
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
                <TableCell className="px-4 py-3">
                  <FichaDeLocal nomeDaArea={item.area.nome} />
                </TableCell>
                {mostrarPrioridade && (
                  <TableCell className="text-interface px-4 py-3">
                    <PalavraDePrioridade prioridade={item.prioridade} />
                  </TableCell>
                )}
                <TableCell className="px-4 py-3">
                  {item.responsavel === null ? (
                    <span className="text-tinta-fraca">—</span>
                  ) : (
                    <FichaDePessoa nome={item.responsavel.nome} />
                  )}
                </TableCell>
                <TableCell className="text-tinta-suave text-meta px-4 py-3 font-mono whitespace-nowrap tabular-nums">
                  <span className="block">{tempoCurto(item.registradaEm, agora)}</span>
                  <span className="block">↻ {tempoCurto(item.atualizadaEm, agora)}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
