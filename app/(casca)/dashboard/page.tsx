import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { verDashboard } from "@/aplicacao/dashboard";
import {
  Cartao,
  Medidor,
  rotulosDosMeses,
  totalDaSerie,
  type ItemDoMedidor,
  type SerieMensal,
} from "@/interface/componentes/blocos-do-dashboard";
import { duracaoEmTexto } from "@/interface/componentes/duracao";
import { GraficoDaRecorrencia } from "@/interface/componentes/grafico-da-recorrencia";
import { linhasDaRecorrencia } from "@/interface/componentes/recorrencia";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
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
 * categoria, tempo médio, média das avaliações (`inventario-de-telas.md:984-988`, critério 32.4). **Só o
 * nº 1 carrega uma frase dizendo por que existe**, e é essa assimetria que faz a hierarquia sem usar cor.
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
 * celular os cinco empilham na ordem numerada, e a recorrência é a que fica visível sem rolar.
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
        <TempoMedio dashboard={dashboard} />
        <MediaDasAvaliacoes dashboard={dashboard} />
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
 * **O gráfico é da tela grande, e a lista fica sempre.** Até o item 44e a lista sumia a partir de `lg`,
 * substituída pelas colunas mensais. Com o balão sendo o único lugar onde o número por série apareceria,
 * a informação passaria a existir só em passagem do ponteiro — que é o compromisso A-5 quebrado. A lista
 * fica nos dois tamanhos; o gráfico entra onde há largura para ler tendência.
 *
 * **As áreas continuam lista**, à direita: são cerca de trinta séries, e o achado **P-11** já decidiu que
 * trinta séries não têm legenda possível.
 *
 * **O corte é "as cinco primeiras", e ele nunca mente.** A frase do protótipo é literal — *"mais N áreas
 * com 1 ocorrência ou nenhuma"* —, e ela é uma afirmação sobre os dados, não só uma contagem. Por isso o
 * corte mostra as cinco **ou mais**, até que tudo o que sobra tenha total ≤ 1: assim a frase é verdadeira
 * por construção, em vez de verdadeira nos dados do protótipo. *(Decisão do plano; a spec fixava o corte
 * em cinco e não previu o caso.)*
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

  const meses = dashboard.tempoMedioDeResolucao.porMes.map((mes) => mes.mes);
  const { linhas, nomes } = linhasDaRecorrencia(categorias, rotulosDosMeses(meses));

  return (
    <Cartao numero={1} titulo="Recorrência" quando="no período">
      <p className="text-tinta-suave text-corpo">
        Oito vazamentos no mesmo bloco em três meses não são oito ordens de serviço.
      </p>

      {categorias.length === 0 && areas.length === 0 ? (
        <p role="status" className="text-tinta text-corpo">
          A recorrência aparece a partir do segundo mês de uso.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-tinta-fraca text-rotulo-coluna font-mono uppercase">
              Por categoria
            </h3>
            {/* Tela grande: as três de maior total mais `Outras`, empilhadas. */}
            <div className="hidden lg:block">
              <GraficoDaRecorrencia linhas={linhas} nomes={nomes} />
            </div>
            {/* O número por categoria, em texto, nos dois tamanhos — A-5. */}
            <ListaComResto series={categorias} substantivo="categorias" />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-tinta-fraca text-rotulo-coluna font-mono uppercase">
              Por área
            </h3>
            <ListaComResto series={areas} substantivo="áreas" />
          </div>
        </div>
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
 * **`— · 0 resolvidas` e a frase *"nenhuma resolução no mês"***, literais do protótipo. E a linha
 * *"Tempo de calendário, com as pausas."* — **sem nenhum espaço reservado** prometendo a separação
 * calendário × tempo ativo, que é ⬜ (critério 36.3).
 *
 * **A unidade segue a magnitude, e quem decide é a tela** (item 55): minutos abaixo de uma hora, horas
 * inteiras até 48, dias com uma casa acima disso. A API continua devolvendo horas com a casa decimal, que
 * é o que o `openapi.yaml` exemplifica, e a regra mora em `duracao.ts` porque o item 58 a chama de novo.
 *
 * **A barra continua sendo desenhada sobre `mes.horas`, e não sobre o texto.** Ela compara os meses entre
 * si, e um mês de `18 min` contra um de `9,2 dias` só é comparável na mesma unidade — desenhar sobre o
 * número já convertido faria `18` de minutos parecer maior que `9` de dias.
 */
function TempoMedio({ dashboard }: { dashboard: DashboardProjetado }) {
  const rotulos = rotulosDosMeses(dashboard.tempoMedioDeResolucao.porMes.map((mes) => mes.mes));

  const itens: readonly ItemDoMedidor[] = dashboard.tempoMedioDeResolucao.porMes.map((mes, i) => {
    const rotulo = rotulos[i] ?? mes.mes;
    const denominador = `${String(mes.resolvidas)} ${mes.resolvidas === 1 ? "resolvida" : "resolvidas"}`;

    return mes.horas === null
      ? { rotulo, quantidade: 0, vazio: "nenhuma resolução no mês", texto: `— · ${denominador}` }
      : {
          rotulo,
          quantidade: mes.horas,
          texto: `${duracaoEmTexto(mes.horas)} · ${denominador}`,
        };
  });

  return (
    <Cartao numero={4} titulo="Tempo médio de resolução" quando="no período">
      <Medidor itens={itens} />
      <p className="text-tinta-suave text-corpo">Tempo de calendário, com as pausas.</p>
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
