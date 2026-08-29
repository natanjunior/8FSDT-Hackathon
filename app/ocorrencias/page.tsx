import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  listarOcorrencias,
  type FiltroDeOcorrencias,
  type PaginaDeOcorrencias,
} from "@/aplicacao/ocorrencia";
import { listarCategorias, listarPedidosDeEntrada, type CategoriaLida } from "@/aplicacao/organizacao";
import { STATUS } from "@/dominio/ocorrencia";
import { acaoDeSair } from "@/interface/acoes";
import { BarraDeFiltros, type OpcaoDeFiltro } from "@/interface/componentes/barra-de-filtros";
import { ListaDeOcorrencias } from "@/interface/componentes/lista-de-ocorrencias";
import { MenuDeOrganizacao } from "@/interface/componentes/menu-de-organizacao";
import { instanteDoServidor } from "@/interface/componentes/tempo-relativo";
import { TEXTO_DO_VAZIO, vazioDaLista } from "@/interface/componentes/vazio-da-lista";
import {
  algumFiltroAplicado,
  consultaDe,
  FormatoInvalido,
  lerFiltroDeOcorrenciasDaUrl,
  resolverEscopoParaTela,
} from "@/interface/http";
import {
  descricaoDoRecorte,
  nomeDoStatus,
  opcoesDePrioridade,
  projetarContexto,
  projetarPaginaDeOcorrencias,
} from "@/interface/projecoes";

/**
 * ============================================================================
 *  T-03 · Ocorrências — o eixo
 * ============================================================================
 *
 * *"T-03 é o eixo. Toda tela de dentro da organização se alcança dela"* (`inventario-de-telas.md`, §3).
 * É a tela inicial de todo papel que age — **inclusive a do Gestor**, que não é o Dashboard.
 *
 * **Uma tela, duas perguntas, um endpoint.** `visibilidadeAplicada` decide o título em palavras e a
 * densidade do item; a permissão decide o resto. Nada aqui pergunta o papel.
 *
 * **A leitura vai pela estrada direta** (contrato §5), como T-05, T-08 e T-09: `app/` não monta
 * repositório, e um `fetch` interno custaria o salto HTTP que a §5 recusou. As páginas **seguintes** vêm
 * do `GET /api/ocorrencias`, pedidas pelo navegador — as duas estradas passam pela mesma função de
 * Aplicação e pela mesma projeção, que é o que as impede de divergir.
 */
export const dynamic = "force-dynamic";

export default async function Ocorrencias({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const consulta = consultaDe(await searchParams);

  let filtro: FiltroDeOcorrencias;
  try {
    filtro = lerFiltroDeOcorrenciasDaUrl(consulta);
  } catch (erro) {
    // §3.9 — **isto não é o quarto vazio.** Os três vazios do critério 14.4 respondem "a consulta correu e
    // não achou nada"; este responde "a consulta não correu". Confundi-los é o erro que o 14.4 existe para
    // impedir, e é a classe do R-15: o defeito chegando como 200 silencioso.
    if (erro instanceof FormatoInvalido) return <FiltroInvalido />;
    throw erro;
  }

  const consultaAtual = consulta.toString();

  let escopo;
  try {
    escopo = await resolverEscopoParaTela("ocorrencia.ler_propria");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Focorrencias");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  // Vínculo sem permissão nenhuma → a rota `/`, que é onde a frase de T-10 mora. **Não há laço:** `/` só
  // manda para cá quem TEM `ocorrencia.ler_propria`.
  if (escopo.situacao === "sem-permissao") redirect("/");

  const { ctx, repos, resolucao } = escopo;
  const vinculo = ctx.vinculo;
  const podeLerTodas = vinculo.pode("ocorrencia.ler_todas");
  const podeRegistrar = vinculo.pode("ocorrencia.registrar");
  const podeAlterarPrioridade = vinculo.pode("ocorrencia.alterar_prioridade");
  const organizacao = resolucao.ativo?.organizacao ?? null;

  /** O insumo do menu de troca — a mesma projeção do `GET /contexto`, sem consulta nova (item 7b). */
  const vinculosDaPessoa = projetarContexto(resolucao).vinculos;

  /**
   * **O recorte em palavras, derivado — não esperado.**
   *
   * É a **mesma regra** de `listarOcorrencias` (`consultas.ts`), e a duplicação é deliberada e barata: o
   * cabeçalho está **fora** da fronteira de espera de propósito (critério 14.7), e ler
   * `visibilidadeAplicada` da resposta o arrastaria para dentro dela — trocando um título correto por uma
   * tela que não pinta nada até o banco responder.
   *
   * **Sem isto o título mente:** com `?autor=eu` a lista traz só as próprias e o cabeçalho continuaria
   * dizendo *"Todas as ocorrências"*, que é o critério 14.3 ao contrário.
   */
  const visibilidade = podeLerTodas && filtro.apenasDoAutor !== true ? "todas" : "apenas_minhas";

  /** As opções que não dependem de leitura nenhuma — as duas listas são do Domínio. */
  const opcoesDeStatus: readonly OpcaoDeFiltro[] = STATUS.map((status) => ({
    valor: status,
    rotulo: nomeDoStatus(status),
  }));
  // **A mesma lista, de um lugar só.** Ela era montada aqui em linha; a partir do item 17 a projeção a
  // devolve pronta, porque o seletor de T-05 precisa exatamente dos mesmos três pares. Deixar a cópia aqui
  // ao lado da função nova seria a segunda cópia que o critério 17.6 daquele item combate.
  const opcoesDeFiltroPorPrioridade: readonly OpcaoDeFiltro[] = opcoesDePrioridade();

  /**
   * **As duas leituras da lista partem agora e não são esperadas aqui.** Elas são passadas como promessa
   * para dentro do `<Suspense>`, que é quem as espera — é o que faz o cabeçalho pintar antes da lista.
   */
  const paginaPedida = listarOcorrencias(
    repos.ocorrencias,
    { pessoaId: ctx.pessoaId, podeLerTodas },
    { filtro },
  );
  const categoriasPedidas = listarCategorias(repos.categorias, { incluirInativas: true });

  /**
   * **A contagem de pedidos pendentes** — Q-T8, resposta (a): *"é a única coisa que separa 'entra hoje' de
   * 'entra quando alguém lembrar'"*. Ela acompanhou o cabeçalho na migração da moldura (decisão 4 do
   * `respostas.md`), e roda **em paralelo** com as duas de cima: T-03 é a tela que o RNF5 cronometra, e
   * uma consulta encadeada é meio cold start a mais.
   */
  const pendentes = vinculo.pode("vinculo.gerir")
    ? (await listarPedidosDeEntrada(repos.pedidosDeEntrada, {})).length
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-28 md:pb-12">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">
          {visibilidade === "todas" ? "Todas as ocorrências" : "Minhas ocorrências"}
        </h1>
        {/* A organização ativa, permanentemente visível: *"num produto em que a organização vem da sessão
            e não da URL, o endereço não diz onde você está, então a tela tem de dizer"* (inventário §3,
            decisão 3). **E agora com o `▾` de trocar** — é o `PUT /contexto/organizacao`, o item 7b.
            T-03 é o eixo: toda tela de dentro se alcança dela, então o menu está a um toque de qualquer
            lugar, e trocar de organização no meio de um formulário — que é onde a troca é armadilha —
            continua não sendo oferecido. */}
        {organizacao !== null && (
          <MenuDeOrganizacao
            vinculos={vinculosDaPessoa}
            organizacaoAtivaId={organizacao.id}
            nomeDaOrganizacaoAtiva={organizacao.nome}
          />
        )}
      </header>

      {podeRegistrar && (
        <Link
          href="/ocorrencias/nova"
          className="border-marca bg-accent text-tinta hidden min-h-11 w-fit items-center rounded-md border px-4 text-sm font-medium md:inline-flex"
        >
          + Registrar ocorrência
        </Link>
      )}

      <Suspense fallback={<EsqueletoDaLista />}>
        <Lista
          pagina={paginaPedida}
          categorias={categoriasPedidas}
          filtro={filtro}
          consultaAtual={consultaAtual}
          nomeDaOrganizacao={organizacao?.nome ?? null}
          podeLerTodas={podeLerTodas}
          podeAlterarPrioridade={podeAlterarPrioridade}
          opcoesDeStatus={opcoesDeStatus}
          opcoesDePrioridade={opcoesDeFiltroPorPrioridade}
          podeRegistrar={podeRegistrar}
          podeConfigurar={vinculo.pode("organizacao.configurar")}
          mostrarPrioridade={podeAlterarPrioridade}
        />
      </Suspense>

      <nav className="border-linha flex flex-col gap-2 border-t pt-4">
        <h2 className="text-tinta-fraca text-xs tracking-wide uppercase">Nesta organização</h2>
        {pendentes !== null && (
          <Link
            href="/vinculos"
            className="border-linha bg-superficie text-tinta flex min-h-11 items-center justify-between rounded-md border px-4 py-3 text-sm"
          >
            <span>Quem está na organização</span>
            {/* A-5: a contagem carrega a palavra, nunca só o número colorido. */}
            <span className="text-tinta-suave text-xs">
              {pendentes === 0
                ? "nenhum pedido aguardando"
                : pendentes === 1
                  ? "1 pedido aguardando"
                  : `${pendentes} pedidos aguardando`}
            </span>
          </Link>
        )}
        {vinculo.pode("organizacao.configurar") && (
          <Link
            href="/configuracao"
            className="border-linha bg-superficie text-tinta flex min-h-11 items-center justify-between rounded-md border px-4 py-3 text-sm"
          >
            <span>Categorias e áreas</span>
            <span className="text-tinta-suave text-xs">as opções do formulário de registro</span>
          </Link>
        )}
        <form action={acaoDeSair} className="pt-1">
          <button type="submit" className="text-marca min-h-11 text-sm underline underline-offset-4">
            Sair
          </button>
        </form>
      </nav>

      {/* **No celular o botão é fixo no rodapé**, porque *"a lista rola sem fim, e um botão que rola
          some"* (protótipo, D-2). Na tela grande ele está no topo — e é o lugar que o item 15 vai
          reaproveitar quando a barra de filtros nascer. */}
      {podeRegistrar && (
        <div className="border-linha bg-superficie fixed inset-x-0 bottom-0 border-t px-6 py-3 md:hidden">
          <Link
            href="/ocorrencias/nova"
            className="border-marca bg-accent text-tinta flex min-h-11 items-center justify-center rounded-md border text-sm font-medium"
          >
            + Registrar ocorrência
          </Link>
        </div>
      )}
    </main>
  );
}

/**
 * A lista, esperada **aqui dentro** — é o que mantém o cabeçalho fora da fronteira de espera.
 *
 * **As duas promessas chegam prontas do componente de cima e são esperadas juntas.** Encadeá-las custaria
 * duas idas ao banco em série numa tela que o RNF5 cronometra.
 */
async function Lista({
  pagina,
  categorias,
  filtro,
  consultaAtual,
  nomeDaOrganizacao,
  podeLerTodas,
  podeAlterarPrioridade,
  opcoesDeStatus,
  opcoesDePrioridade,
  podeRegistrar,
  podeConfigurar,
  mostrarPrioridade,
}: {
  pagina: Promise<PaginaDeOcorrencias>;
  categorias: Promise<readonly CategoriaLida[]>;
  filtro: FiltroDeOcorrencias;
  consultaAtual: string;
  nomeDaOrganizacao: string | null;
  podeLerTodas: boolean;
  podeAlterarPrioridade: boolean;
  opcoesDeStatus: readonly OpcaoDeFiltro[];
  opcoesDePrioridade: readonly OpcaoDeFiltro[];
  podeRegistrar: boolean;
  podeConfigurar: boolean;
  mostrarPrioridade: boolean;
}) {
  const [resultado, listaDeCategorias] = await Promise.all([pagina, categorias]);
  const projetada = projetarPaginaDeOcorrencias(resultado);

  /**
   * §3.8 — o **menu** oferece só as ativas, por coerência com T-04, que *"nunca oferece categoria
   * desativada"*. A busca traz as inativas porque o **ícone** precisa delas (§3.6 da spec do 14): a
   * filtragem é do componente, não do pedido, e por isso mudar de ideia aqui custa **zero requisição**. A
   * ordem é a de `ordem`, que já vem do repositório e é a escolha do Gestor (D18).
   */
  const opcoesDeCategoria: readonly OpcaoDeFiltro[] = listaDeCategorias
    .filter((categoria) => categoria.ativa)
    .map((categoria) => ({ valor: categoria.id, rotulo: categoria.nome }));

  /** Categoria que veio na URL e não está no mapa — desativada, ou de outra organização — não vira nome. */
  const nomeDaCategoria = (id: string) => listaDeCategorias.find((uma) => uma.id === id)?.nome;

  /**
   * **A barra vive DENTRO da fronteira de espera**, junto da lista, e o preço está declarado: durante a
   * **primeira** carga ela ainda não está na tela e aparece com a lista. Não é o caso do 15.4 — ali a
   * árvore anterior fica pintada inteira, barra inclusive. A alternativa era dar `await` em `categorias`
   * no corpo da página, o que atrasaria o cabeçalho que o item 14 tirou daqui de propósito.
   *
   * **Ela aparece nos dois ramos, inclusive no vazio** — que é onde ela é mais necessária: sem ela, o
   * vazio de filtro seria um beco.
   */
  const barra =
    podeLerTodas ? (
      <BarraDeFiltros
        consultaAtual={consultaAtual}
        status={opcoesDeStatus}
        categorias={opcoesDeCategoria}
        prioridades={podeAlterarPrioridade ? opcoesDePrioridade : null}
        mostrarSoAsMinhas
      />
    ) : (
      algumFiltroAplicado(filtro) && (
        /*
         * §3.1 — **URL filtrada nunca é beco.** Quem não tem `ler_todas` não tem barra, e pode chegar aqui
         * por um link filtrado que um Gestor compartilhou (critério 15.3). Sem esta saída, ele fica preso
         * num recorte que não sabe que existe.
         */
        <p className="border-linha border-b px-4 py-3 text-sm">
          <Link href="/ocorrencias" className="text-marca underline underline-offset-4">
            Limpar filtros
          </Link>
        </p>
      )
    );

  if (projetada.itens.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {barra}
        <Vazio
          visibilidade={projetada.visibilidadeAplicada}
          filtro={filtro}
          nomeDaOrganizacao={nomeDaOrganizacao}
          nomeDaCategoria={nomeDaCategoria}
          podeRegistrar={podeRegistrar}
          podeConfigurar={podeConfigurar}
        />
      </div>
    );
  }

  /**
   * **O cruzamento do ícone, e ele é do cliente — não do payload** (critério 14.6).
   * `incluirInativas: true`: uma ocorrência antiga pode apontar para categoria desativada, e o ícone dela
   * não pode sumir por isso. Categoria fora do mapa degrada para `tag`, no próprio `IconeDeCategoria`.
   */
  const iconePorCategoria = Object.fromEntries(
    listaDeCategorias.map((categoria) => [categoria.id, categoria.icone]),
  );

  return (
    <div className="flex flex-col gap-4">
      {barra}
      {/*
        **A `key` e a propriedade fazem coisas diferentes, e as duas são obrigatórias.** A `key` remonta o
        componente quando o recorte muda — sem ela o `useState` semeado por `primeiraPagina` guarda a lista
        antiga para sempre, e o filtro não muda um pixel. `consultaAtual` faz a **página seguinte** vir com
        o mesmo recorte. Uma sem a outra deixa metade do item 15 quebrada.
      */}
      <ListaDeOcorrencias
        key={consultaAtual}
        primeiraPagina={projetada}
        consultaAtual={consultaAtual}
        iconePorCategoria={iconePorCategoria}
        mostrarPrioridade={mostrarPrioridade}
        agora={instanteDoServidor()}
      />
    </div>
  );
}

/**
 * O link com filtro que não existe — §3.9 da spec.
 *
 * Acontece com URL editada à mão ou compartilhada depois de o vocabulário mudar. **Nunca com filtro
 * produzido pela barra** — ela só escreve valores que o servidor lhe deu.
 */
function FiltroInvalido() {
  return (
    <div className="border-linha bg-superficie m-4 rounded-md border px-4 py-6 text-center">
      <h2 className="text-tinta text-base font-medium">Este link tem um filtro que não existe.</h2>
      <p className="text-tinta-suave mt-1 text-sm">
        Ele pode ter sido editado, ou ter sido feito numa versão anterior do aplicativo.
      </p>
      <Link
        href="/ocorrencias"
        className="text-marca mt-4 inline-block text-sm underline underline-offset-4"
      >
        Limpar filtros
      </Link>
    </div>
  );
}

/**
 * Os vazios — critério 14.4.
 *
 * **Qual dos três é decisão de `vazioDaLista`**, que tem teste próprio. Aqui só se desenha o que ela
 * escolheu. **O terceiro ramo passou a ser alcançável com o item 15**, que é quem tem os valores do
 * recorte: o `false` fixo virou `algumFiltroAplicado(filtro)`, e o subtítulo e o *"Limpar filtros"*
 * entraram (critério 15.6). **A função de escolha é reusada, não reescrita** — a precedência *filtro ganha
 * da visibilidade* já vinha decidida do 14.
 */
function Vazio({
  visibilidade,
  filtro,
  nomeDaOrganizacao,
  nomeDaCategoria,
  podeRegistrar,
  podeConfigurar,
}: {
  visibilidade: "todas" | "apenas_minhas";
  filtro: FiltroDeOcorrencias;
  nomeDaOrganizacao: string | null;
  nomeDaCategoria: (id: string) => string | undefined;
  podeRegistrar: boolean;
  podeConfigurar: boolean;
}) {
  const tipo = vazioDaLista(visibilidade, algumFiltroAplicado(filtro));
  const texto = TEXTO_DO_VAZIO[tipo];

  return (
    <section className="border-linha flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-6">
      <h2 className="text-tinta text-base font-semibold">{texto.titulo}</h2>
      {texto.corpo !== null && (
        <p className="text-tinta-suave text-sm leading-relaxed">{texto.corpo}</p>
      )}

      {/*
        O subtítulo do **terceiro vazio** — critério 15.6. `corpo` é `null` para este tipo de propósito,
        esperando exatamente isto: o recorte em palavras, com os mesmos rótulos dos chips. **`nomeDaOrganizacao`
        pode ser nulo**, e a frase sem o nome continua verdadeira; inventá-lo seria pior.
      */}
      {tipo === "filtro" && (
        <>
          <p className="text-tinta-suave text-sm leading-relaxed">
            {nomeDaOrganizacao === null ? "Com " : `Em ${nomeDaOrganizacao}, com `}
            {descricaoDoRecorte(filtro, nomeDaCategoria).join(" · ")}.
          </p>
          <Link
            href="/ocorrencias"
            className="text-marca inline-block text-sm underline underline-offset-4"
          >
            Limpar filtros
          </Link>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {/* O primeiro convite é o que importa: a organização nasce com áreas-semente genéricas, e **a
            primeira coisa que quebra o registro do Solicitante é uma lista de áreas que não descreve o
            prédio**. */}
        {tipo === "organizacao" && podeConfigurar && (
          <Link
            href="/configuracao"
            className="border-marca bg-accent text-tinta inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            Conferir as áreas
          </Link>
        )}
        {podeRegistrar && (
          <Link
            href="/ocorrencias/nova"
            className="border-linha text-tinta inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            {tipo === "organizacao" ? "+ Registrar a primeira" : "+ Registrar ocorrência"}
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * A espera — **e ela é da lista, não da tela inteira**.
 *
 * *"A primeira requisição de uma sessão tem espera nomeada"* (inventário §6, RNF5). A frase **não promete
 * prazo** e aparece depois de ~2 s, com a mesma classe de `app/vinculos/loading.tsx`. O esqueleto tem a
 * forma **desta** lista: cinco itens de quatro linhas.
 *
 * **Neutro de propósito.** O achado **R-10** do protótipo dizia que T-03 não sabe qual das duas caras
 * desenhar durante a primeira carga; **nesta composição isso não acontece** — o recorte vem da permissão,
 * que já está resolvida quando o esqueleto é renderizado, e o título verdadeiro já está no cabeçalho,
 * fora da fronteira.
 */
function EsqueletoDaLista() {
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden className="flex flex-col gap-3">
        {[58, 34, 64, 44, 61].map((largura) => (
          <div key={largura} className="border-linha flex flex-col gap-2 rounded-md border px-4 py-3">
            <div className="bg-secondary h-4 animate-pulse rounded" style={{ width: `${largura}%` }} />
            <div className="bg-secondary h-4 w-[86%] animate-pulse rounded" />
            <div className="bg-secondary h-3 w-[46%] animate-pulse rounded" />
          </div>
        ))}
      </div>
      <p
        role="status"
        className="text-tinta-suave animate-in fade-in text-sm opacity-0 [animation-delay:2s] [animation-duration:300ms] [animation-fill-mode:forwards]"
      >
        Acordando o servidor — a primeira abertura do dia é mais lenta.
      </p>
    </div>
  );
}
