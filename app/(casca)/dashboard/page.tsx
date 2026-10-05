import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { atalhosDaJanela, verDashboard, type AtalhosDaJanela } from "@/aplicacao/dashboard";
import {
  Cartao,
  CartaoDeIndicador,
  rotulosDosMeses,
} from "@/interface/componentes/blocos-do-dashboard";
import { duracaoEmTexto } from "@/interface/componentes/duracao";
import {
  chaveDaDupla,
  corteDeTopo,
  fraseDoDenominadorDasDuplas,
  fraseDoResto,
  SEM_DUPLA_RECORRENTE,
} from "@/interface/componentes/duplas-recorrentes";
import { rotuloDaFaixa } from "@/interface/componentes/faixa-de-periodo";
import {
  atravessaAVirada,
  linhasDoFluxoMensal,
  NOTA_DO_MES_PARCIAL,
  saldoDoPeriodo,
  trechoDoMes,
  vereditoDoFluxo,
  type LinhaDoFluxoMensal,
  type SaldoDoPeriodo as Saldo,
} from "@/interface/componentes/fluxo-mensal";
import { GraficoDeBarras } from "@/interface/componentes/grafico-de-barras";
import { GraficoDoFluxoMensal } from "@/interface/componentes/grafico-do-fluxo-mensal";
import { GraficoDoTempoDeResolucao } from "@/interface/componentes/grafico-do-tempo-de-resolucao";
import {
  dias,
  parteDoTotal,
  rodapeDaIdade,
  rotuloDaFaixaDeIdade,
  totalEmAberto,
  vereditoDaIdade,
} from "@/interface/componentes/idade-em-aberto";
import {
  denominadorDaSatisfacao,
  rotuloDaNota,
  segundoTermoDoEmAberto,
  segundoTermoDoSaldo,
  textoDoSaldo,
  textoDoValorDaCategoria,
} from "@/interface/componentes/indicadores-do-painel";
import { CAMADA_DO_TITULO, LINHA_CLICAVEL } from "@/interface/componentes/linha-clicavel";
import { ModalDeDados } from "@/interface/componentes/modal-de-dados";
import { ConteudoDoPainel, PeriodoEmVoo } from "@/interface/componentes/periodo-em-voo";
import { ROTULO_ACIMA } from "@/interface/componentes/filtros-da-lista";
import { SeletorDePeriodo } from "@/interface/componentes/seletor-de-periodo";
import { SeloDeStatus } from "@/interface/componentes/selo-de-status";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { TabelaDeDados } from "@/interface/componentes/tabela-de-dados";
import {
  celulasDoTempo,
  unidadeDoEixo,
  vereditoDoTempo,
} from "@/interface/componentes/tempo-de-resolucao";
import { cn } from "@/interface/componentes/utilitarios";
import {
  consultaDe,
  FormatoInvalido,
  lerJanelaDoDashboardDaUrl,
  resolverEscopoParaTela,
  trocarJanelaInvertida,
} from "@/interface/http";
import { projetarDashboard, type DashboardProjetado } from "@/interface/projecoes";

/**
 * ============================================================================
 *  T-07 · Dashboard — *"Está melhorando ou piorando, e onde?"*
 * ============================================================================
 *
 * **Três cartões e sete quadros, e cada quadro escreve a pergunta de decisão que responde** (item 73).
 * Quadro sem pergunta não entra. Os cartões ficam em coluna à esquerda do quadro 1, e o de saldo responde
 * a pergunta da página sem frase a mais: o sinal escrito diz se a fila cresceu. **Nenhum cartão muda de
 * cor**, porque saldo positivo pode ser a organização começando a usar o produto.
 *
 * **Os sete, na ordem da tela:** entradas e saídas por mês · em aberto por idade · tempo de resolução · o
 * que está voltando · em aberto por categoria · ocorrências por status · satisfação. A numeração continua
 * na tela, e mudou de sentido com o item 73: quem lê um relatório anterior a ele lê outros quadros.
 *
 * **Cada gráfico tem a forma que a medida pede.** Linha no fluxo e no tempo, que são séries mensais; barra
 * horizontal com o valor escrito nos outros quatro; número grande com as cinco notas na satisfação.
 *
 * **O `Ver dados` abre a tabela do quadro num modal.** É obrigatório nas duas linhas, que não rotulam todo
 * valor; nas barras é opcional, porque cada barra já tem o número. **A idade o tem mesmo assim**, porque a
 * tabela dela acrescenta a parte de cada faixa no total. Os quadros de barra sem `Ver dados` levam a lista
 * para leitor de tela que o `GraficoDeBarras` desenha, e o veredito fica sempre fora do modal.
 *
 * **A leitura vai pela estrada direta** (contrato §5), como T-03, T-05, T-08 e T-09: `app/` não monta
 * repositório, e um `fetch` interno custaria o salto HTTP que a §5 recusou — cobrado, sob escala a zero,
 * do tempo de quem abre a tela. O `GET /api/dashboard` existe para o mesmo contrato ser verdade nas duas
 * estradas, e as duas passam pela **mesma** função e pela **mesma** projeção.
 *
 * **Uma exceção, e ela é da tela** (item 69): a janela invertida é trocada por `trocarJanelaInvertida`
 * antes da leitura, e a tela avisa. A API recebe a mesma consulta sem a troca e responde `400`. Depois da
 * troca, as duas estradas voltam a passar pela mesma função.
 *
 * **O link da mais velha é a única navegação do painel**, e não precisa de filtro: ele aponta uma
 * ocorrência, e quem lê o painel pode abri-la, porque `dashboard.ler` e `ocorrencia.ler_todas` andam
 * juntas no Gestor. Levar um quadro à lista filtrada continua de fora: o `GET /ocorrencias` ainda não
 * filtra por área nem por data.
 *
 * **Alvo primário: tela grande** — é a única tela do inventário em que isso é escolha e não concessão.
 * Abaixo de `lg` os cartões viram faixa de três acima do quadro 1; abaixo de `sm`, tudo empilha.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Painel" };

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const consulta = consultaDe(await searchParams);

  let escopo;
  try {
    escopo = await resolverEscopoParaTela("dashboard.ler");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fdashboard");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Painel" permissao="dashboard.ler" />;
  }

  // **A janela é lida DEPOIS da sessão, e a ordem é o mapa de navegação, não gosto.** Quem chega sem
  // sessão vai para T-01 mesmo com `?de=` torto — se a leitura viesse antes, `/dashboard?de=01/06/2026`
  // desenharia a faixa de período inválido para quem nem entrou, e essa é a única tela do produto que
  // responderia alguma coisa sem sessão. Custa uma ida ao banco numa URL malformada, e é o que T-08 e
  // T-09 já fazem: contexto primeiro. *(Ordem corrigida na revisão de 29/08/2026.)*
  // **A troca vem antes da leitura, e só aqui** (item 69): na tela, quem inverteu as datas quer o painel;
  // na API, a mesma consulta continua `400`. Data mal formada não é trocada e segue para a recusa.
  const { consulta: consultaNaOrdem, trocada } = trocarJanelaInvertida(consulta);

  let janela;
  try {
    janela = lerJanelaDoDashboardDaUrl(consultaNaOrdem);
  } catch (erro) {
    // **Não é "não há dado": é "a consulta não correu"** — a distinção que o item 14 nomeou (classe do
    // achado R-15). Devolver zeros aqui diria ao Gestor que o condomínio dele está parado.
    if (erro instanceof FormatoInvalido) return <PeriodoInvalido />;
    throw erro;
  }

  const dashboard = projetarDashboard(await verDashboard(escopo.repos.dashboard, janela));

  // **Um array só para o cartão do saldo e para o quadro 1**, e por isso os dois dizem o mesmo *saíram*.
  const fluxo = linhasDoFluxoMensal(
    dashboard.recorrenciaPorCategoria,
    dashboard.tempoDeResolucao.porMes,
    dashboard.canceladasPorMes,
    dashboard.periodo,
  );
  // E o saldo sai uma vez só, para o cartão e o rodapé do quadro 4 dizerem o mesmo *entraram* (item 110).
  const saldo = saldoDoPeriodo(fluxo);

  return (
    <PeriodoEmVoo>
      <div className="flex flex-col gap-6">
        {/* **A marca e o nome da organização saíram daqui** (item 44e): a barra superior da casca já pinta
            uma e já carrega o seletor da outra, e repeti-las aqui era a tela dizendo duas vezes o que a
            casca diz uma. Fica o título, como T-03 faz com *Ocorrências*. */}
        <h1 className="text-titulo-pagina text-tinta">Painel</h1>

        <Periodo
          periodo={dashboard.periodo}
          atalhos={atalhosDaJanela()}
          consultaAtual={consultaNaOrdem.toString()}
          trocada={trocada}
        />

        {/* O que recua enquanto o período troca (item 103): tudo abaixo do filtro. */}
        <ConteudoDoPainel>
          <div className="grid gap-4 lg:grid-cols-[minmax(13rem,0.9fr)_3fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:content-start">
              <EmAbertoAgora dashboard={dashboard} />
              <SaldoDoPeriodo saldo={saldo} />
              <AMaisVelha dashboard={dashboard} />
            </div>
            <EntradasESaidas fluxo={fluxo} periodo={dashboard.periodo} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <EmAbertoPorIdade dashboard={dashboard} />
            <TempoDeResolucao dashboard={dashboard} />
            <OQueEstaVoltando dashboard={dashboard} entraram={saldo.entraram} />
            <EmAbertoPorCategoria dashboard={dashboard} />
            <OcorrenciasPorStatus dashboard={dashboard} />
            <Satisfacao dashboard={dashboard} />
          </div>
        </ConteudoDoPainel>
      </div>
    </PeriodoEmVoo>
  );
}

/**
 * **A faixa deixou de ser formulário no item 71**, e o cartão continua sendo o cartão: mesma borda, mesmo
 * respiro, e é a casa do aviso da troca. Refazer a moldura do painel é outro item.
 *
 * **Sem cartão** (item 104, critério 6): um único filtro numa caixa deixava 1.100 px de vazio ao lado em
 * 1440 px, e a Pauta Rule põe filtro fora da caixa. A régua embaixo separa a linha dos blocos.
 *
 * **O que saiu, e não é regressão:** os dois campos de data nativos, os dois rótulos que os nomeavam e a
 * classe de esquema de cor que o item 69 pôs neles. Aquela classe existia para o navegador desenhar o
 * calendário **do sistema** no tema do campo; sem campo nativo não há calendário do sistema. Declarar o
 * esquema de cor globalmente mudaria a barra de rolagem e todo controle nativo do produto, e por isso não
 * se faz.
 *
 * *(Nenhum comentário deste bloco escreve a classe nem o tipo de campo por extenso: a guarda que protege
 * esta decisão casa texto-fonte e não distingue código de prosa.)*
 *
 * **O atalho dos 90 dias continua vindo antes do `Aplicar`** (critério 69.1): a coluna de atalhos do
 * painel vem antes do rodapé.
 *
 * **O aviso da troca** (critério 71.3) é uma oração em *meta* no pé do cartão, e não repete as datas: o
 * gatilho já as mostra na ordem certa, porque o rótulo sai de `periodo`.
 */
function Periodo({
  periodo,
  atalhos,
  consultaAtual,
  trocada,
}: {
  periodo: DashboardProjetado["periodo"];
  atalhos: AtalhosDaJanela;
  consultaAtual: string;
  trocada: boolean;
}) {
  return (
    <div className="border-linha-suave flex flex-wrap items-end gap-3 border-b pb-4">
      <div className="flex flex-col gap-1.5">
        {/* `aria-hidden`: o nome acessível do seletor já começa por *Período* (`nomeDaFaixa`). */}
        <span aria-hidden="true" className={ROTULO_ACIMA}>
          Período
        </span>
        <SeletorDePeriodo periodo={periodo} atalhos={atalhos} consultaAtual={consultaAtual} />
      </div>

      {trocada ? (
        <p role="status" className="text-tinta-suave text-meta basis-full">
          As datas estavam invertidas e foram trocadas.
        </p>
      ) : null}
    </div>
  );
}

/**
 * O primeiro cartão: **a soma das faixas de idade**, e o segundo termo é o que estava em aberto quando o
 * período abriu. Os dois juntos são a conferência do critério 73.4: agora menos o saldo é o início, quando
 * a janela termina hoje. Com nada em aberto, o número é `0` e o segundo termo continua sendo o do início.
 */
function EmAbertoAgora({ dashboard }: { dashboard: DashboardProjetado }) {
  const total = totalEmAberto(dashboard.abertasPorIdade);
  return (
    <CartaoDeIndicador
      rotulo="Em aberto agora"
      valor={String(total)}
      segundoTermo={segundoTermoDoEmAberto(dashboard.emAbertoNoInicio)}
    />
  );
}

/** O segundo cartão: **o sinal sempre escrito**, e quanto entrou e saiu embaixo. Saiu é resolvida mais cancelada. */
function SaldoDoPeriodo({ saldo }: { saldo: Saldo }) {
  return (
    <CartaoDeIndicador
      rotulo="Saldo do período"
      valor={textoDoSaldo(saldo.saldo)}
      segundoTermo={segundoTermoDoSaldo(saldo)}
    />
  );
}

/**
 * O terceiro cartão: **a idade da mais velha, e o título dela como link**. O título é o que torna o número
 * acionável; um agregado não se abre, uma ocorrência sim.
 */
function AMaisVelha({ dashboard }: { dashboard: DashboardProjetado }) {
  const [maisVelha] = dashboard.maisVelhasEmAberto;
  return (
    <CartaoDeIndicador
      rotulo="A mais velha em aberto"
      clicavel={maisVelha !== undefined}
      valor={maisVelha === undefined ? "—" : dias(maisVelha.idadeEmDias)}
      segundoTermo={
        maisVelha === undefined ? (
          "nada em aberto"
        ) : (
          <Link
            href={`/ocorrencias/${maisVelha.id}`}
            className={cn("text-tinta-marca break-words underline underline-offset-4", CAMADA_DO_TITULO)}
          >
            {maisVelha.titulo}
          </Link>
        )
      }
    />
  );
}

/**
 * O quadro 1 — **quanto entrou e quanto saiu, mês a mês**, com *Saíram* sendo resolvidas mais canceladas.
 *
 * **O veredito fala do último mês completo**, e não dos totais: eles já estão no cartão do saldo, na mesma
 * fileira. **O mês parcial leva `*` no rótulo**, e só quando há algum o rodapé explica: na janela de 90
 * dias o primeiro e o último entram cortados, e sem a marca a série exagera a rampa.
 *
 * **O gráfico aparece em todas as larguras.** Com a lista indo para o modal, escondê-lo no celular
 * deixaria o quadro só com a frase. A soma da coluna *Saldo* da tabela é o número do cartão.
 */
function EntradasESaidas({
  fluxo,
  periodo,
}: {
  fluxo: readonly LinhaDoFluxoMensal[];
  periodo: DashboardProjetado["periodo"];
}) {
  const titulo = "Entradas e saídas por mês";
  const rotulos = rotulosDosMeses(fluxo.map((linha) => linha.mes));
  const algumParcial = fluxo.some((linha) => linha.parcial);

  return (
    <Cartao
      numero={1}
      titulo={titulo}
      quando="no período"
      pergunta="Está melhorando ou piorando?"
      acao={
        <ModalDeDados titulo={titulo}>
          <TabelaDeDados
            legenda={rotuloDaFaixa(periodo)}
            colunas={["Mês", "Registradas", "Resolvidas", "Canceladas", "Saíram", "Saldo"]}
            linhas={fluxo.map((linha, i) => ({
              chave: linha.mes,
              celulas: [
                linha.parcial
                  ? `${rotulos[i] ?? linha.mes}, parcial, ${trechoDoMes(linha.mes, periodo)}`
                  : (rotulos[i] ?? linha.mes),
                String(linha.registradas),
                String(linha.resolvidas),
                String(linha.canceladas),
                String(linha.saidas),
                textoDoSaldo(linha.saldo),
              ],
            }))}
          />
        </ModalDeDados>
      }
    >
      <p className="text-tinta text-corpo">{vereditoDoFluxo(fluxo)}</p>
      <GraficoDoFluxoMensal linhas={fluxo} />
      {algumParcial ? (
        <p className="text-tinta-suave text-meta">{NOTA_DO_MES_PARCIAL}</p>
      ) : null}
    </Cartao>
  );
}

/**
 * O quadro 2 — **lidera pelas mais velhas** (critério 73.8): o veredito conta acima do segundo limite, a
 * lista aponta as cinco que esperam mais, e as barras vêm depois, como contexto.
 *
 * **As quatro faixas aparecem sempre, mesmo a zero** (critério 59.2), e `agora` no cabeçalho é o 59.3. A
 * faixa mais velha se distingue por palavra, na oração do veredito (59.5), e o rodapé diz sempre o que o
 * quadro mede (59.6).
 *
 * **O tempo em pausa não tem indicador próprio**: a lista mostra o status de cada uma, e quem lê *Pausada*
 * quatro vezes seguidas vê a pausa esquecida sem número novo.
 */
function EmAbertoPorIdade({ dashboard }: { dashboard: DashboardProjetado }) {
  const titulo = "Em aberto por idade";
  const faixas = dashboard.abertasPorIdade;
  const total = totalEmAberto(faixas);
  const velhas = dashboard.maisVelhasEmAberto;

  return (
    <Cartao
      numero={2}
      titulo={titulo}
      quando="agora"
      pergunta="O que está esperando demais, e qual ocorrência?"
      acao={
        <ModalDeDados titulo={titulo}>
          <TabelaDeDados
            legenda="Situação de agora"
            colunas={["Faixa de idade", "Em aberto", "Do total"]}
            linhas={faixas.map((faixa) => ({
              chave: String(faixa.deDias),
              celulas: [
                rotuloDaFaixaDeIdade(faixa),
                String(faixa.quantidade),
                parteDoTotal(faixa.quantidade, total),
              ],
            }))}
          />
        </ModalDeDados>
      }
    >
      <p className="text-tinta text-corpo">{vereditoDaIdade(faixas)}</p>
      {velhas.length > 0 ? (
        <ol className="flex flex-col">
          {velhas.map((ocorrencia) => (
            <li
              key={ocorrencia.id}
              className={cn(LINHA_CLICAVEL, "text-corpo flex min-h-11 min-w-0 flex-wrap items-center gap-x-3 gap-y-1")}
            >
              <Link
                href={`/ocorrencias/${ocorrencia.id}`}
                className={cn(
                  "text-tinta-marca min-w-0 flex-1 break-words underline underline-offset-4",
                  CAMADA_DO_TITULO,
                )}
              >
                {ocorrencia.titulo}
              </Link>
              <SeloDeStatus status={ocorrencia.status} rotulo={ocorrencia.statusRotulo} />
              <span className="text-tinta-suave text-meta tabular-nums">
                {dias(ocorrencia.idadeEmDias)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <GraficoDeBarras
        larguraDoRotulo={120}
        listaParaLeitor={false}
        barras={faixas.map((faixa) => ({
          chave: String(faixa.deDias),
          rotulo: rotuloDaFaixaDeIdade(faixa),
          valor: faixa.quantidade,
          texto: String(faixa.quantidade),
        }))}
      />
      <p className="text-tinta-suave text-corpo">{rodapeDaIdade(faixas)}</p>
    </Cartao>
  );
}

/**
 * O quadro 3 — **a mediana e o p90, mês a mês, em duas linhas.** Mês sem resolução é buraco nas duas, e
 * mês de três resoluções ou menos não tem p90 (critério 58.4): as durações dele estão no `Ver dados`.
 *
 * **O veredito fala do mês mais recente que teve resolução.** A unidade do eixo segue o maior valor
 * desenhado, pelo degrau de `duracao.ts`, e sem nenhuma resolução no período o gráfico não aparece.
 */
function TempoDeResolucao({ dashboard }: { dashboard: DashboardProjetado }) {
  const titulo = "Tempo de resolução";
  const meses = dashboard.tempoDeResolucao.porMes;
  const rotulos = rotulosDosMeses(meses.map((mes) => mes.mes));
  const valores = meses.flatMap((mes) => [mes.mediana, mes.p90]).filter((v) => v !== null);
  const unidade = unidadeDoEixo(Math.max(0, ...valores));
  const naUnidade = (horas: number | null) => (horas === null ? null : horas / unidade.divisor);
  const ultima = (chave: "mediana" | "p90") =>
    [...meses].reverse().find((mes) => mes[chave] !== null)?.[chave] ?? null;
  const medianaFinal = ultima("mediana");
  const p90Final = ultima("p90");

  return (
    <Cartao
      numero={3}
      titulo={titulo}
      quando="no período"
      pergunta="Quanto demora, e quanto demora para quem espera mais?"
      acao={
        <ModalDeDados titulo={titulo}>
          <TabelaDeDados
            legenda={rotuloDaFaixa(dashboard.periodo)}
            colunas={["Mês", "Mediana", "p90", "Resoluções"]}
            linhas={meses.map((mes, i) => {
              const celulas = celulasDoTempo(mes);
              return {
                chave: mes.mes,
                celulas: [rotulos[i] ?? mes.mes, celulas.mediana, celulas.p90, celulas.resolvidas],
              };
            })}
          />
        </ModalDeDados>
      }
    >
      <p className="text-tinta text-corpo">
        {vereditoDoTempo(meses, atravessaAVirada(meses.map((mes) => mes.mes)))}
      </p>
      {valores.length > 0 ? (
        <GraficoDoTempoDeResolucao
          unidade={unidade}
          pontos={meses.map((mes, i) => ({
            rotulo: rotulos[i] ?? mes.mes,
            mediana: naUnidade(mes.mediana),
            p90: naUnidade(mes.p90),
          }))}
          pontas={{
            mediana: medianaFinal === null ? null : duracaoEmTexto(medianaFinal),
            p90: p90Final === null ? null : duracaoEmTexto(p90Final),
          }}
        />
      ) : null}
      <p className="text-tinta-suave text-corpo">
        Tempo de calendário, com as pausas. Mês com três resoluções ou menos não tem p90, e as durações
        dele estão em Ver dados.
      </p>
    </Cartao>
  );
}

/**
 * O quadro 4 — **a mesma categoria voltando na mesma área** (item 60). As duas séries por dimensão contam
 * em separado, e o cruzamento só existe na linha da ocorrência.
 *
 * **O corte de topo é as cinco primeiras mais as empatadas com a quinta** (critério 73.14), e o que sobra
 * vira uma frase que é sempre verdadeira, porque o corte nunca separa um empate. **Sem `Ver dados`**:
 * toda barra mostrada tem o número, e as de fora estão na frase.
 *
 * **O rótulo quebra em duas linhas**, área em cima e categoria embaixo: truncar cortaria a metade que o
 * quadro existe para mostrar.
 *
 * O eixo vai até as registradas do período, e o rodapé as escreve (item 110).
 */
function OQueEstaVoltando({
  dashboard,
  entraram,
}: {
  dashboard: DashboardProjetado;
  entraram: number;
}) {
  const { mostradas, restantes, maiorDasRestantes } = corteDeTopo(dashboard.duplasRecorrentes);

  return (
    <Cartao
      numero={4}
      titulo="O que está voltando"
      quando="no período"
      pergunta="Onde vale atacar a causa em vez de abrir outra ordem de serviço?"
    >
      {mostradas.length === 0 ? (
        <p role="status" className="text-tinta text-corpo">
          {SEM_DUPLA_RECORRENTE}
        </p>
      ) : (
        <>
          <GraficoDeBarras
            larguraDoRotulo={176}
            denominador={entraram}
            barras={mostradas.map((dupla) => ({
              chave: chaveDaDupla(dupla),
              rotulo: dupla.area.nome,
              rotuloDeBaixo: dupla.categoria.nome,
              valor: dupla.quantidade,
              texto: String(dupla.quantidade),
            }))}
          />
          {restantes > 0 ? (
            <p className="text-tinta-suave text-meta">{fraseDoResto(restantes, maiorDasRestantes)}</p>
          ) : null}
          <p className="text-tinta-suave text-meta">{fraseDoDenominadorDasDuplas(entraram)}</p>
        </>
      )}
    </Cartao>
  );
}

/**
 * O quadro 5 — **só o que está em aberto, por categoria**, ordenado por quantidade, e toda categoria
 * ativa aparece mesmo a zero (critério 32.3).
 *
 * **O segundo número vai em texto** (critério 73.9): quantas daquela categoria passaram do primeiro limite
 * de idade, que chega pela primeira faixa e nunca é escrito aqui. **Sem veredito**: uma regra genérica
 * para a pior categoria seria um indicador novo.
 *
 * **O título não é *Abertas por categoria***: `Aberta` é um dos seis rótulos do quadro 6, e o plural leria
 * como recorte por aquele status.
 */
function EmAbertoPorCategoria({ dashboard }: { dashboard: DashboardProjetado }) {
  const limite = dashboard.abertasPorIdade[0]?.ateDias ?? 0;
  return (
    <Cartao
      numero={5}
      titulo="Em aberto por categoria"
      quando="agora"
      pergunta="Onde está o trabalho que não terminou?"
    >
      <GraficoDeBarras
        larguraDoRotulo={176}
        barras={dashboard.abertasPorCategoria.map((linha) => ({
          chave: linha.categoria.id,
          rotulo: linha.categoria.nome,
          valor: linha.quantidade,
          texto: textoDoValorDaCategoria(linha.quantidade, linha.envelhecidas, limite),
        }))}
      />
      <p className="text-tinta-suave text-corpo">
        Só o que está em aberto, e o segundo número é quantas passaram de {limite} dias.
      </p>
    </Cartao>
  );
}

/**
 * O quadro 6 — **os seis status, na ordem do ciclo**, mesmo a zero. É o único quadro de barra em que a
 * ordem é o significado, e por isso ele não se ordena por tamanho: a Aplicação já os entrega na ordem de
 * `STATUS`.
 *
 * **Ele conta TUDO o que a organização registrou**, inclusive o que terminou, e o rodapé diz isso: é o
 * que o distingue dos quadros 2 e 5 (critério 56.4).
 */
function OcorrenciasPorStatus({ dashboard }: { dashboard: DashboardProjetado }) {
  return (
    <Cartao
      numero={6}
      titulo="Ocorrências por status"
      quando="agora"
      pergunta="Como se distribui tudo o que já foi registrado?"
    >
      <GraficoDeBarras
        larguraDoRotulo={128}
        barras={dashboard.backlogPorStatus.map((linha) => ({
          chave: linha.status,
          rotulo: linha.statusRotulo,
          valor: linha.quantidade,
          texto: String(linha.quantidade),
        }))}
      />
      <p className="text-tinta-suave text-corpo">
        Na ordem do ciclo. Conta tudo o que já foi registrado, inclusive o que terminou.
      </p>
    </Cartao>
  );
}

/**
 * O quadro 7 — **a média, o denominador e as cinco notas.** O denominador aparece ao lado da média,
 * sempre (critério 34.3): sem ele a média mente quando poucos avaliam. A taxa de resposta é texto.
 *
 * **Sem nenhuma avaliação, o número é `—`, nunca `0`** (critério 34.2): um zero diria que as pessoas
 * avaliaram mal. **E a frase ao lado continua trazendo o denominador** — ela diz quantas resolvidas o
 * período tem e que nenhuma foi avaliada, o que é do item 81. **As cinco barras ficam, a zero**, pela
 * razão de 32.3: a estrutura ensina o que vai ser medido. Nota 5 em cima, como quem lê espera.
 *
 * O eixo das notas vai até as resolvidas, o mesmo denominador da frase (item 110).
 */
function Satisfacao({ dashboard }: { dashboard: DashboardProjetado }) {
  const avaliacoes = dashboard.mediaDasAvaliacoes;
  const { media } = avaliacoes;

  return (
    <Cartao
      numero={7}
      titulo="Satisfação"
      quando="no período"
      pergunta="Quem foi atendido ficou satisfeito?"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-tinta text-titulo-pagina tabular-nums">
          {media === null ? "—" : media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
        </span>
        <span className="text-tinta-suave text-corpo">de 1 a 5</span>
        <span className="text-tinta-suave text-corpo">{denominadorDaSatisfacao(avaliacoes)}</span>
      </div>
      <GraficoDeBarras
        larguraDoRotulo={72}
        denominador={avaliacoes.resolvidas}
        barras={[...avaliacoes.distribuicao].reverse().map((nota) => ({
          chave: String(nota.nota),
          rotulo: rotuloDaNota(nota.nota),
          valor: nota.quantidade,
          texto: String(nota.quantidade),
        }))}
      />
    </Cartao>
  );
}

/** A faixa do período impossível, com o caminho de volta ao padrão (spec §3.2). */
function PeriodoInvalido() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-tinta text-titulo-pagina">Painel</h1>
      <p role="alert" className="text-tinta text-corpo">
        Este link tem um período que não existe.
      </p>
      <Link
        href="/dashboard"
        className="text-tinta-marca text-interface inline-flex min-h-11 items-center underline underline-offset-4"
      >
        Ver os últimos 90 dias
      </Link>
    </div>
  );
}
