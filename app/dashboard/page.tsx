import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { verDashboard } from "@/aplicacao/dashboard";
import {
  Cartao,
  ColunasMensais,
  Medidor,
  rotulosDosMeses,
  totalDaSerie,
  type ItemDoMedidor,
  type SerieMensal,
} from "@/interface/componentes/blocos-do-dashboard";
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
 * **A ordem é conteúdo**, e é numerada na tela: recorrência, backlog por status, backlog por categoria,
 * tempo médio, média das avaliações (`inventario-de-telas.md:984-988`, critério 32.4). **Só o nº 1 carrega
 * uma frase dizendo por que existe**, e é essa assimetria que faz a hierarquia sem usar cor.
 *
 * **A leitura vai pela estrada direta** (contrato §5), como T-03, T-05, T-08 e T-09: `app/` não monta
 * repositório, e um `fetch` interno custaria o salto HTTP que a §5 recusou — cobrado, sob escala a zero,
 * do tempo de quem abre a tela. O `GET /api/dashboard` existe para o mesmo contrato ser verdade nas duas
 * estradas, e as duas passam pela **mesma** função e pela **mesma** projeção.
 *
 * **Nada aqui é clicável além de voltar** — critério 32.5. O atalho para a lista filtrada exigiria filtro
 * por área ou por data, e `GET /ocorrencias` não tem nenhum dos dois. *"É o exemplo mais claro de tela que
 * se contém para não divergir da API."*
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
  if (escopo.situacao === "sem-permissao") return <SemPermissao />;

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
  const organizacao = escopo.resolucao.ativo?.organizacao.nome ?? "";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-6 pt-10 pb-12">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Dashboard</h1>
        <p className="text-tinta-suave text-sm">{organizacao}</p>
      </header>

      <Periodo periodo={dashboard.periodo} />

      <Recorrencia dashboard={dashboard} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BacklogPorStatus dashboard={dashboard} />
        <BacklogPorCategoria dashboard={dashboard} />
        <TempoMedio dashboard={dashboard} />
        <MediaDasAvaliacoes dashboard={dashboard} />
      </div>

      <Link
        href="/ocorrencias"
        className="text-marca inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Voltar
      </Link>
    </main>
  );
}

/**
 * **`<form method="get">`, e é a tela inteira de interação de T-07.**
 *
 * Sem `"use client"`, sem `useRouter`, sem `useState`: o navegador monta `/dashboard?de=…&ate=…` sozinho,
 * que é justamente o endereço compartilhável que o inventário pede — *"um dashboard de um trimestre é a
 * coisa que se manda para a imobiliária"*.
 *
 * **A-1:** os dois campos têm `<label htmlFor>` de verdade. **A-3:** `min-h-11` nos dois campos e no botão.
 */
function Periodo({ periodo }: { periodo: DashboardProjetado["periodo"] }) {
  return (
    <form
      method="get"
      className="border-linha bg-superficie flex flex-wrap items-end gap-3 rounded-md border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="de" className="text-tinta-suave text-xs">
          De
        </label>
        <input
          id="de"
          name="de"
          type="date"
          defaultValue={periodo.de}
          className="border-linha text-tinta min-h-11 rounded-md border px-3 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ate" className="text-tinta-suave text-xs">
          Até
        </label>
        <input
          id="ate"
          name="ate"
          type="date"
          defaultValue={periodo.ate}
          className="border-linha text-tinta min-h-11 rounded-md border px-3 text-sm"
        />
      </div>

      <button
        type="submit"
        className="border-marca bg-accent text-tinta min-h-11 rounded-md border px-4 text-sm font-medium"
      >
        Aplicar
      </button>

      <Link
        href="/dashboard"
        className="text-marca inline-flex min-h-11 items-center text-sm underline underline-offset-4"
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
 * **Duas formas do mesmo dado:** na tela grande, colunas mensais das duas categorias de maior total mais a
 * lista de áreas; no celular, as duas viram lista. É o desenho do protótipo, e a razão da lista de áreas é
 * o achado **P-11**: ~30 séries não têm legenda possível.
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

  return (
    <Cartao numero={1} titulo="Recorrência" quando="no período">
      <p className="text-tinta-suave text-sm">
        Oito vazamentos no mesmo bloco em três meses não são oito ordens de serviço.
      </p>

      {categorias.length === 0 && areas.length === 0 ? (
        <p role="status" className="text-tinta text-sm">
          A recorrência aparece a partir do segundo mês de uso.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-tinta-fraca text-xs font-semibold tracking-wide uppercase">
              Por categoria
            </h3>
            {/* Tela grande: colunas das duas de maior total. */}
            <div className="hidden lg:block">
              <ColunasMensais series={duasPrimeiras(categorias)} meses={meses} />
            </div>
            {/* Celular: a mesma informação como lista. */}
            <div className="lg:hidden">
              <ListaComResto series={categorias} substantivo="categorias" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-tinta-fraca text-xs font-semibold tracking-wide uppercase">
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

function duasPrimeiras(series: readonly SerieComTotal[]): readonly SerieMensal[] {
  return series.slice(0, 2).map((serie) => ({ rotulo: serie.rotulo, porMes: serie.porMes }));
}

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
        <p className="text-tinta-fraca text-xs">
          mais {restantes} {substantivo} com 1 ocorrência ou nenhuma
        </p>
      )}
    </div>
  );
}

/**
 * O bloco 2 — **os SEIS status, sempre todos, na ordem do ciclo**, mesmo a zero (critério 32.3).
 *
 * A palavra `agora` no cabeçalho é o critério **33.4**: sem ela, o Gestor lê o backlog como se ele
 * respeitasse o período que acabou de escolher.
 */
function BacklogPorStatus({ dashboard }: { dashboard: DashboardProjetado }) {
  return (
    <Cartao numero={2} titulo="Backlog por status" quando="agora">
      <Medidor
        itens={dashboard.backlogPorStatus.map((linha) => ({
          rotulo: linha.statusRotulo,
          quantidade: linha.quantidade,
        }))}
      />
    </Cartao>
  );
}

/** O bloco 3 — todas as categorias, ordenadas por quantidade, e `agora` pela mesma razão do bloco 2. */
function BacklogPorCategoria({ dashboard }: { dashboard: DashboardProjetado }) {
  return (
    <Cartao numero={3} titulo="Backlog por categoria" quando="agora">
      <Medidor
        itens={dashboard.backlogPorCategoria.map((linha) => ({
          rotulo: linha.categoria.nome,
          quantidade: linha.quantidade,
        }))}
      />
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
 * **As horas aparecem inteiras**, como o protótipo desenha (`72 h`, `41 h`); a API continua devolvendo a
 * casa decimal, que é o que o `openapi.yaml` exemplifica.
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
          texto: `${mes.horas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} h · ${denominador}`,
        };
  });

  return (
    <Cartao numero={4} titulo="Tempo médio de resolução" quando="no período">
      <Medidor itens={itens} />
      <p className="text-tinta-suave text-sm">Tempo de calendário, com as pausas.</p>
    </Cartao>
  );
}

/**
 * O bloco 5 — **o denominador aparece ao lado da média, sempre** (critério 34.3, PA-16): *"sem ele a média
 * mente quando poucos avaliam"*.
 *
 * **Sem nenhuma avaliação, o número é `—` e a frase é literal** (critério 34.2), nunca `0` — um zero diria
 * que as pessoas avaliaram mal.
 */
function MediaDasAvaliacoes({ dashboard }: { dashboard: DashboardProjetado }) {
  const { media, avaliadas, resolvidas } = dashboard.mediaDasAvaliacoes;

  return (
    <Cartao numero={5} titulo="Média das avaliações" quando="no período">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-tinta text-4xl font-semibold tabular-nums">
          {media === null ? "—" : media.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
        </span>
        <span className="text-tinta-suave text-sm">de 1 a 5</span>
        <span className="text-tinta-suave ml-auto text-right text-sm">
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
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-6 pt-10 pb-12">
      <h1 className="text-tinta text-xl font-semibold">Dashboard</h1>
      <p role="alert" className="text-tinta text-sm">
        O período pedido não é válido, e por isso a consulta não correu — os números abaixo não existem, e
        não são zeros.
      </p>
      <Link
        href="/dashboard"
        className="text-marca inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Ver os últimos 90 dias
      </Link>
    </main>
  );
}

/** Quem chega por link sem `dashboard.ler` (`inventario-de-telas.md:1517`). */
function SemPermissao() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-6 pt-10 pb-12">
      <h1 className="text-tinta text-xl font-semibold">Dashboard</h1>
      <p role="alert" className="text-tinta-suave text-sm">
        Seu papel nesta organização não dá acesso a esta página.
      </p>
      <Link
        href="/ocorrencias"
        className="text-marca inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Voltar
      </Link>
    </main>
  );
}
