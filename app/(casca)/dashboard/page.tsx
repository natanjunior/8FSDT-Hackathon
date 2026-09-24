import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { verDashboard } from "@/aplicacao/dashboard";
import {
  Cartao,
  ListaEmTexto,
  Medidor,
  rotulosDosMeses,
  totalDaSerie,
  type ItemDoMedidor,
  type SerieMensal,
} from "@/interface/componentes/blocos-do-dashboard";
import {
  chaveDaDupla,
  rotuloDaDupla,
  SEM_DUPLA_RECORRENTE,
} from "@/interface/componentes/duplas-recorrentes";
import {
  linhasDoFluxoMensal,
  textoDoFluxoMensal,
} from "@/interface/componentes/fluxo-mensal";
import { GraficoDoFluxoMensal } from "@/interface/componentes/grafico-do-fluxo-mensal";
import {
  rotuloDaFaixaDeIdade,
  textoDaIdadeEmAberto,
} from "@/interface/componentes/idade-em-aberto";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { itemDoTempoDeResolucao } from "@/interface/componentes/tempo-de-resolucao";
import { Button } from "@/interface/componentes/ui/button";
import { Input } from "@/interface/componentes/ui/input";
import {
  consultaDe,
  FormatoInvalido,
  lerJanelaDoDashboardDaUrl,
  resolverEscopoParaTela,
} from "@/interface/http";
import { projetarDashboard, type DashboardProjetado } from "@/interface/projecoes";

/**
 * ============================================================================
 *  T-07 · Dashboard — *"Está melhorando ou piorando, e onde?"*
 * ============================================================================
 *
 * **A ordem é conteúdo**, e é numerada na tela: recorrência, ocorrências por status, em aberto por
 * categoria, tempo de resolução, média das avaliações e em aberto por idade
 * (`inventario-de-telas.md:984-988`, critério 32.4). **Só o nº 1 carrega uma frase dizendo por que
 * existe**, e é essa assimetria que faz a hierarquia sem usar cor.
 *
 * **A leitura vai pela estrada direta** (contrato §5), como T-03, T-05, T-08 e T-09: `app/` não monta
 * repositório, e um `fetch` interno custaria o salto HTTP que a §5 recusou — cobrado, sob escala a zero,
 * do tempo de quem abre a tela. O `GET /api/dashboard` existe para o mesmo contrato ser verdade nas duas
 * estradas, e as duas passam pela **mesma** função e pela **mesma** projeção.
 *
 * **Nada aqui é clicável ainda**, e isso deixou de ser regra em 14/09/2026 — passou a ser só o estado de
 * hoje. O *"Voltar"* do pé saiu no item 44e, porque a barra lateral da casca leva ao mesmo lugar. O link
 * do período inválido fica, que é saída de erro e não navegação duplicada; e quem chega sem
 * `dashboard.ler` recebe o `SemAcesso` da casca (item 44h), com a saída que ele traz.
 *
 * **O atalho para a lista filtrada é trabalho de outro item.** Os blocos 2 e 3 já têm para onde ir —
 * `?status=` e `?categoriaId=` existem desde o item 15. Os blocos 1 e 4 dependem de um filtro por área e
 * de um por data que o `GET /ocorrencias` ainda não tem, e enquanto não tiverem, uma tela com dois números
 * clicáveis e dois não precisa dizer qual é qual sem que ninguém tenha de descobrir clicando.
 *
 * **Alvo primário: tela grande** — é a única tela do inventário em que isso é escolha e não concessão. No
 * celular os seis empilham na ordem numerada, e a recorrência é a que fica visível sem rolar.
 */
export const dynamic = "force-dynamic";

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
    return <SemAcesso titulo="Dashboard" permissao="dashboard.ler" />;
  }

  // **A janela é lida DEPOIS da sessão, e a ordem é o mapa de navegação, não gosto.** Quem chega sem
  // sessão vai para T-01 mesmo com `?de=` torto — se a leitura viesse antes, `/dashboard?de=01/06/2026`
  // desenharia a faixa de período inválido para quem nem entrou, e essa é a única tela do produto que
  // responderia alguma coisa sem sessão. Custa uma ida ao banco numa URL malformada, e é o que T-08 e
  // T-09 já fazem: contexto primeiro. *(Ordem corrigida na revisão de 29/08/2026.)*
  let janela;
  try {
    janela = lerJanelaDoDashboardDaUrl(consulta);
  } catch (erro) {
    // **Não é "não há dado": é "a consulta não correu"** — a distinção que o item 14 nomeou (classe do
    // achado R-15). Devolver zeros aqui diria ao Gestor que o condomínio dele está parado.
    if (erro instanceof FormatoInvalido) return <PeriodoInvalido />;
    throw erro;
  }

  const dashboard = projetarDashboard(await verDashboard(escopo.repos.dashboard, janela));

  return (
    <div className="flex flex-col gap-6">
      {/* **A marca e o nome da organização saíram daqui** (item 44e): a barra superior da casca já pinta
          uma e já carrega o seletor da outra, e repeti-las aqui era a tela dizendo duas vezes o que a
          casca diz uma. Fica o título, como T-03 faz com *Ocorrências*. */}
      <h1 className="text-titulo-pagina text-tinta">Dashboard</h1>

      <Periodo periodo={dashboard.periodo} />

      <Recorrencia dashboard={dashboard} />

      <div className="grid gap-4 lg:grid-cols-2">
        <OcorrenciasPorStatus dashboard={dashboard} />
        <EmAbertoPorCategoria dashboard={dashboard} />
        <TempoDeResolucao dashboard={dashboard} />
        <MediaDasAvaliacoes dashboard={dashboard} />
        <EmAbertoPorIdade dashboard={dashboard} />
      </div>
    </div>
  );
}

/**
 * **`<form method="get">`, e é a tela inteira de interação de T-07.**
 *
 * Sem `"use client"`, sem `useRouter`, sem `useState`: o navegador monta `/dashboard?de=…&ate=…` sozinho,
 * que é o endereço compartilhável que o inventário pede — *"um dashboard de um trimestre é a coisa que se
 * manda para a imobiliária"*.
 *
 * **A-1:** os dois campos têm `<label htmlFor>` de verdade. **A-3:** `min-h-11` nos dois campos e no
 * botão, que nem o `Input` nem o `Button` do catálogo trazem sozinhos.
 *
 * **O `Aplicar` não veste a marca.** A regra do guia é uma ação na cor da marca por tela, e T-07 é tela de
 * leitura: a ação de escrever não existe aqui.
 */
function Periodo({ periodo }: { periodo: DashboardProjetado["periodo"] }) {
  return (
    <form
      method="get"
      className="border-linha bg-superficie flex flex-wrap items-end gap-3 rounded-lg border p-[15px] shadow-sm md:p-[18px]"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="de" className="text-tinta-suave text-meta">
          De
        </label>
        <Input
          id="de"
          name="de"
          type="date"
          defaultValue={periodo.de}
          className="border-linha text-tinta text-interface min-h-11 w-auto"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ate" className="text-tinta-suave text-meta">
          Até
        </label>
        <Input
          id="ate"
          name="ate"
          type="date"
          defaultValue={periodo.ate}
          className="border-linha text-tinta text-interface min-h-11 w-auto"
        />
      </div>

      <Button type="submit" variant="outline" className="border-linha text-tinta text-interface min-h-11 px-4">
        Aplicar
      </Button>

      <Link
        href="/dashboard"
        className="text-marca text-interface inline-flex min-h-11 items-center underline underline-offset-4"
      >
        últimos 90 dias
      </Link>
    </form>
  );
}

/**
 * O bloco 1 — **o único que carrega uma frase explicando por que existe**, e é o que faz a hierarquia da
 * tela sem usar cor.
 *
 * **Quatro seções, e cada uma responde uma pergunta diferente:**
 *
 * | # | Seção | Que pergunta responde |
 * |---|---|---|
 * | 1 | Registradas e resolvidas | está melhorando ou piorando |
 * | 2 | Por área e categoria | o que está voltando |
 * | 3 | Por categoria · Por área | onde há mais volume |
 *
 * **A de cima é a que responde a pergunta da tela.** *"Está melhorando ou piorando?"* é o que
 * `docs/telas.md` promete do painel, e até o item 57 nenhum dos cinco quadros respondia: o quadro por
 * status é fotografia, as listas de recorrência são contagem no período, o tempo é média e a avaliação é
 * nota. As duas séries de cima — quanto foi registrado e quanto foi resolvido em cada mês — **saem da
 * mesma resposta que já chegava**, cruzadas em `fluxo-mensal.ts`.
 *
 * **O par entra em SEGUNDO, e não em primeiro.** A frase do cartão promete o par — oito vazamentos no
 * mesmo bloco não são oito ordens de serviço —, e as duas listas de baixo contam as dimensões em
 * separado: oito no mesmo lugar e oito espalhados dão ali o mesmo número. Rebaixar a seção de cima para
 * abrir espaço seria redecidir em silêncio o que o item 57 decidiu com razão escrita.
 *
 * **As quatro sublistas têm nome acessível**, por `role="group"` mais `aria-labelledby` no `h3` de cada
 * uma. É o que tira o índice posicional do ponta a ponta sem criar landmark: `<section>` aqui daria
 * quatro regiões dentro de um cartão que hoje não tem nenhuma, e tornaria falso o comentário do helper
 * que localiza os seis quadros.
 *
 * **A seção nova fica FORA do vazio das listas**, e o caso que decide é concreto: janela sem nenhuma
 * ocorrência registrada e com resoluções dentro dela — ocorrências abertas antes do período e fechadas
 * nele. Antes, essa organização lia *"a recorrência aparece a partir do segundo mês"* e mais nada; agora
 * lê que zero entrou e N saíram, que é exatamente a fila encolhendo.
 *
 * **O gráfico é da tela grande, e a lista fica sempre.** Com o balão sendo o único lugar onde o número
 * por mês apareceria, a informação passaria a existir só em passagem do ponteiro — o compromisso A-5
 * quebrado. A lista fica nos dois tamanhos; o gráfico entra onde há largura para ler tendência.
 *
 * **As áreas continuam lista**, à direita: são cerca de trinta séries, e o achado **P-11** já decidiu que
 * trinta séries não têm legenda possível.
 *
 * **O corte é "as cinco primeiras", e ele nunca mente.** A frase é literal — *"mais N áreas com 1
 * ocorrência ou nenhuma"* —, e ela é uma afirmação sobre os dados, não só uma contagem. Por isso o corte
 * mostra as cinco **ou mais**, até que tudo o que sobra tenha total ≤ 1.
 */
function Recorrencia({ dashboard }: { dashboard: DashboardProjetado }) {
  const categorias = dashboard.recorrenciaPorCategoria.map((serie) => ({
    rotulo: serie.categoria.nome,
    porMes: serie.porMes,
    total: totalDaSerie(serie.porMes),
  }));
  const areas = dashboard.recorrenciaPorArea.map((serie) => ({
    rotulo: serie.area.nome,
    porMes: serie.porMes,
    total: totalDaSerie(serie.porMes),
  }));

  const duplas = dashboard.duplasRecorrentes;

  // **Um eixo só para o desenho e para a lista**, e por isso os dois não podem discordar: o mesmo array
  // alimenta os dois. Os rótulos vêm do bloco 4, que é a única série que o contrato garante sem buraco.
  const fluxo = linhasDoFluxoMensal(
    dashboard.recorrenciaPorCategoria,
    dashboard.tempoDeResolucao.porMes,
    rotulosDosMeses(dashboard.tempoDeResolucao.porMes.map((mes) => mes.mes)),
  );

  return (
    <Cartao numero={1} titulo="Recorrência" quando="no período">
      <p className="text-tinta-suave text-corpo">
        Oito vazamentos no mesmo bloco em três meses não são oito ordens de serviço.
      </p>

      <div role="group" aria-labelledby="recorrencia-fluxo" className="flex flex-col gap-3">
        <h3
          id="recorrencia-fluxo"
          className="text-tinta-fraca text-rotulo-coluna font-mono uppercase"
        >
          Registradas e resolvidas
        </h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tela grande: as duas linhas. No celular a seção é só a lista, em largura inteira. */}
          <div className="hidden lg:block">
            <GraficoDoFluxoMensal linhas={fluxo} />
          </div>
          {/* Os dois números de cada mês, em texto, nos dois tamanhos — A-5 e critério 57.5. */}
          <ListaEmTexto
            itens={fluxo.map((linha) => ({
              chave: linha.mes,
              rotulo: linha.mes,
              texto: textoDoFluxoMensal(linha),
            }))}
          />
        </div>
      </div>

      {categorias.length === 0 && areas.length === 0 ? (
        <p role="status" className="text-tinta text-corpo">
          A recorrência aparece a partir do segundo mês de uso.
        </p>
      ) : (
        <>
          <div role="group" aria-labelledby="recorrencia-par" className="flex flex-col gap-3">
            <h3
              id="recorrencia-par"
              className="text-tinta-fraca text-rotulo-coluna font-mono uppercase"
            >
              Por área e categoria
            </h3>
            {duplas.length === 0 ? (
              <p role="status" className="text-tinta text-corpo">
                {SEM_DUPLA_RECORRENTE}
              </p>
            ) : (
              /* **Nenhum corte de topo N**, e o corte já aconteceu: quem tem uma não é recorrência.
                 Um segundo corte por posição esconderia atrás de *mais N* justamente a dupla que a
                 seção existe para mostrar. */
              <ListaEmTexto
                itens={duplas.map((dupla) => ({
                  chave: chaveDaDupla(dupla),
                  rotulo: rotuloDaDupla(dupla),
                  texto: String(dupla.quantidade),
                }))}
              />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div
              role="group"
              aria-labelledby="recorrencia-categoria"
              className="flex flex-col gap-3"
            >
              <h3
                id="recorrencia-categoria"
                className="text-tinta-fraca text-rotulo-coluna font-mono uppercase"
              >
                Por categoria
              </h3>
              <ListaComResto series={categorias} substantivo="categorias" />
            </div>

            <div
              role="group"
              aria-labelledby="recorrencia-area"
              className="flex flex-col gap-3"
            >
              <h3
                id="recorrencia-area"
                className="text-tinta-fraca text-rotulo-coluna font-mono uppercase"
              >
                Por área
              </h3>
              <ListaComResto series={areas} substantivo="áreas" />
            </div>
          </div>
        </>
      )}
    </Cartao>
  );
}

type SerieComTotal = SerieMensal & { total: number };

/** As cinco primeiras — ou mais, até que o resto tenha 1 ocorrência ou nenhuma. Ver `Recorrencia`. */
function ListaComResto({
  series,
  substantivo,
}: {
  series: readonly SerieComTotal[];
  substantivo: "categorias" | "áreas";
}) {
  const relevantes = series.filter((serie) => serie.total >= 2).length;
  const mostradas = series.slice(0, Math.max(5, relevantes));
  const restantes = series.length - mostradas.length;

  return (
    <div className="flex flex-col gap-2">
      <Medidor
        itens={mostradas.map((serie) => ({ rotulo: serie.rotulo, quantidade: serie.total }))}
      />
      {restantes > 0 && (
        <p className="text-tinta-fraca text-meta">
          mais {restantes} {substantivo} com 1 ocorrência ou nenhuma
        </p>
      )}
    </div>
  );
}

/**
 * O bloco 2 — **os SEIS status, sempre todos, na ordem do ciclo**, mesmo a zero (critério 32.3).
 *
 * A palavra `agora` no cabeçalho é o critério **33.4**: sem ela, o Gestor leria o quadro como se ele
 * respeitasse o período que acabou de escolher.
 *
 * **Ele conta TUDO o que a organização registrou**, inclusive o que já terminou, e é por isso que ele e o
 * bloco 3 não somam o mesmo número. O título diz o que ele é, e as seis linhas — com `Resolvida` e
 * `Cancelada` entre elas — dizem o resto, então ele não carrega frase nenhuma embaixo.
 */
function OcorrenciasPorStatus({ dashboard }: { dashboard: DashboardProjetado }) {
  return (
    <Cartao numero={2} titulo="Ocorrências por status" quando="agora">
      <Medidor
        itens={dashboard.backlogPorStatus.map((linha) => ({
          rotulo: linha.statusRotulo,
          quantidade: linha.quantidade,
        }))}
      />
    </Cartao>
  );
}

/**
 * O bloco 3 — as categorias ordenadas por quantidade, e `agora` pela mesma razão do bloco 2.
 *
 * **Ele conta só os quatro status não terminais**, e a linha abaixo do medidor escreve quais são — é o
 * critério 56.4 na forma positiva: em vez de negar que os dois quadros somem, ela diz o que entra, e quem
 * lê os seis status do quadro vizinho conclui sozinho que os totais não se encontram.
 *
 * **Toda categoria ativa aparece, mesmo a zero** (critério 32.3), e a desativada aparece enquanto ainda
 * carregar algo em aberto.
 *
 * **O título não é *Abertas por categoria***: `Aberta` é um dos seis rótulos do quadro ao lado, e o plural
 * leria como recorte por aquele status. *Em aberto* nomeia o conjunto e não colide com rótulo nenhum. O
 * campo da resposta continua `abertasPorCategoria`, pela convenção de que o rótulo que a pessoa lê é coisa
 * à parte do nome do campo.
 */
function EmAbertoPorCategoria({ dashboard }: { dashboard: DashboardProjetado }) {
  return (
    <Cartao numero={3} titulo="Em aberto por categoria" quando="agora">
      <Medidor
        itens={dashboard.abertasPorCategoria.map((linha) => ({
          rotulo: linha.categoria.nome,
          quantidade: linha.quantidade,
        }))}
      />
      <p className="text-tinta-suave text-corpo">
        Só o que está em aberto: Aberta, Em análise, Em atendimento e Pausada. Resolvidas e canceladas
        ficam fora.
      </p>
    </Cartao>
  );
}

/**
 * O bloco 4 — uma linha por mês da janela, **inclusive o mês sem resolução** (critério 36.2).
 *
 * **Dois números de tempo por mês, e nenhum deles é a média** (item 58): a mediana diz como foi o caso do
 * meio, e o p90 diz como foi o décimo pior atendimento. Duração de atendimento tem cauda longa, e a média
 * era puxada acima do caso típico por uns poucos casos arrastados.
 *
 * **`— · 0 resolvidas` e a frase *"nenhuma resolução no mês"***, literais do protótipo. E o rodapé, que
 * ganhou a segunda oração porque sem ela a linha do mês pequeno pareceria defeito — **sem nenhum espaço
 * reservado** prometendo a separação calendário × tempo ativo, que é ⬜ (critério 36.3).
 *
 * **O texto da linha mora em `tempo-de-resolucao.ts`**, que é módulo puro: três formas, um plural e uma
 * junção por vírgula não cabem dentro deste `.map`. A unidade segue a magnitude, e quem a escreve é
 * `duracao.ts`, do item 55.
 *
 * **A barra desenha a MEDIANA, sempre, e sobre o número em horas — nunca sobre o texto.** Ela compara os
 * meses entre si, e o que se compara é o caso típico; desenhar o p90 faria o mês de uma catástrofe única
 * encobrir o mês inteiro. E um mês de `18 min` contra um de `9,2 dias` só é comparável na mesma unidade.
 */
function TempoDeResolucao({ dashboard }: { dashboard: DashboardProjetado }) {
  const rotulos = rotulosDosMeses(dashboard.tempoDeResolucao.porMes.map((mes) => mes.mes));

  const itens: readonly ItemDoMedidor[] = dashboard.tempoDeResolucao.porMes.map((mes, i) =>
    itemDoTempoDeResolucao(mes, rotulos[i] ?? mes.mes),
  );

  return (
    <Cartao numero={4} titulo="Tempo de resolução" quando="no período">
      <Medidor itens={itens} />
      <p className="text-tinta-suave text-corpo">
        Tempo de calendário, com as pausas. Mês com três resoluções ou menos mostra as durações uma a uma.
      </p>
    </Cartao>
  );
}

/**
 * O bloco 5 — **o denominador aparece ao lado da média, sempre** (critério 34.3, PA-16): *"sem ele a média
 * mente quando poucos avaliam"*.
 *
 * **Sem nenhuma avaliação, o número é `—` e a frase é literal** (critério 34.2), nunca `0` — um zero diria
 * que as pessoas avaliaram mal.
 *
 * **O número desceu de 36 px para 26 px no item 44e.** A escala do guia tem sete papéis e para no
 * `text-titulo-pagina`; um oitavo papel para o indicador seria mudança do guia, que não é decisão de um
 * item de tela. O custo é presença: a média perde um terço do tamanho.
 */
function MediaDasAvaliacoes({ dashboard }: { dashboard: DashboardProjetado }) {
  const { media, avaliadas, resolvidas } = dashboard.mediaDasAvaliacoes;

  return (
    <Cartao numero={5} titulo="Média das avaliações" quando="no período">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-tinta text-titulo-pagina tabular-nums">
          {media === null ? "—" : media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
        </span>
        <span className="text-tinta-suave text-corpo">de 1 a 5</span>
        <span className="text-tinta-suave text-corpo ml-auto text-right">
          {media === null
            ? "Nenhuma ocorrência avaliada ainda — 0 de 0 resolvidas."
            : `${String(avaliadas)} de ${String(resolvidas)} resolvidas avaliadas`}
        </span>
      </div>
    </Cartao>
  );
}

/**
 * O bloco 6 — **o único número do painel que enxerga o que NÃO foi resolvido.**
 *
 * Os outros medem o que terminou: o tempo de resolução sai da trilha, e a trilha só tem a linha da
 * resolução depois que ela aconteceu. A ocorrência aberta há duzentos dias não entrava em número nenhum,
 * e uma operação que deixasse os casos difíceis de lado veria os indicadores melhorarem.
 *
 * **As quatro faixas aparecem sempre, mesmo a zero** (critério 59.2), e `agora` no cabeçalho é o 59.3 —
 * sem a palavra, o Gestor leria o quadro como se ele respeitasse o período que acabou de escolher.
 *
 * **O `Medidor`, e nenhum desenho novo** (critério 59.4): é a lista com barra que quatro dos outros
 * quadros já usam, com a barra `aria-hidden` e o número em texto ao lado — A-5. Um componente novo aqui
 * seria a sexta forma de desenhar quatro números.
 *
 * **Ele ocupa uma coluna, como os quadros 2 a 5**, e a grade fica com cinco cartões em duas colunas. Dar
 * `lg:col-span-2` a ele esticaria quatro barras pela tela e faria uma diferença de duas ocorrências
 * parecer enorme.
 *
 * **A faixa mais velha se distingue por palavra, no rodapé** (critério 59.5). Nada aqui muda de cor, de
 * peso ou de ícone: as quatro barras são a mesma `bg-marca`.
 */
function EmAbertoPorIdade({ dashboard }: { dashboard: DashboardProjetado }) {
  return (
    <Cartao numero={6} titulo="Em aberto por idade" quando="agora">
      <Medidor
        itens={dashboard.abertasPorIdade.map((faixa) => ({
          rotulo: rotuloDaFaixaDeIdade(faixa),
          quantidade: faixa.quantidade,
        }))}
      />
      <p className="text-tinta-suave text-corpo">
        {textoDaIdadeEmAberto(dashboard.abertasPorIdade)}
      </p>
    </Cartao>
  );
}

/** A faixa do período impossível, com o caminho de volta ao padrão (spec §3.2). */
function PeriodoInvalido() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-tinta text-titulo-pagina">Dashboard</h1>
      <p role="alert" className="text-tinta text-corpo">
        O período pedido não é válido, e por isso a consulta não correu — os números abaixo não existem, e
        não são zeros.
      </p>
      <Link
        href="/dashboard"
        className="text-marca text-interface inline-flex min-h-11 items-center underline underline-offset-4"
      >
        Ver os últimos 90 dias
      </Link>
    </div>
  );
}
