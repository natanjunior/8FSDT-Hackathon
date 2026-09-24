import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  listarOcorrencias,
  PAGINA_MAXIMA,
  type FiltroDeOcorrencias,
  type PaginaDeOcorrencias,
} from "@/aplicacao/ocorrencia";
import { listarCategorias, type CategoriaLida } from "@/aplicacao/organizacao";
import { STATUS } from "@/dominio/ocorrencia";
import { BarraDeFiltros, type OpcaoDeFiltro } from "@/interface/componentes/barra-de-filtros";
import { CartaoDaLista } from "@/interface/componentes/cartao-da-lista";
import { DerivaDaLista } from "@/interface/componentes/deriva-da-lista";
import { EsqueletoDaLista } from "@/interface/componentes/esqueleto-da-lista";
import { ListaDeOcorrencias } from "@/interface/componentes/lista-de-ocorrencias";
import { NavegacaoDaLista } from "@/interface/componentes/navegacao-da-lista";
import { PaginacaoDaLista } from "@/interface/componentes/paginacao-da-lista";
import { SeletorDeRecorte } from "@/interface/componentes/recorte-da-lista";
import { RECORTE_MINHAS } from "@/interface/componentes/rotulos";
import { horaDoCorte, instanteDoServidor } from "@/interface/componentes/tempo-relativo";
import { cn } from "@/interface/componentes/utilitarios";
import { buttonVariants } from "@/interface/componentes/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/interface/componentes/ui/empty";
import {
  estadoDaLista,
  TEXTO_ALEM_DO_FIM,
  TEXTO_DO_VAZIO,
  type TipoDeVazio,
} from "@/interface/componentes/vazio-da-lista";
import {
  algumFiltroAplicado,
  consultaDe,
  FormatoInvalido,
  lerFiltroDeOcorrenciasDaUrl,
  lerPaginacaoDaUrl,
  resolverEscopoParaTela,
  type PaginacaoDaUrl,
} from "@/interface/http";
import {
  descricaoDoRecorte,
  lenteDeRotulo,
  nomeDoStatus,
  opcoesDePrioridade,
  projetarPaginaDeOcorrencias,
  type LenteDeRotulo,
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
  let paginacao: PaginacaoDaUrl;
  try {
    filtro = lerFiltroDeOcorrenciasDaUrl(consulta);
    // **Na mesma guarda, e é de propósito.** `?pagina=0` é a mesma classe de engano que `?status=xpto`:
    // a consulta **não correu**. Deixá-lo cair no `throw` de fora produziria uma tela de erro onde o
    // resto do produto mostra a frase do §3.9.
    paginacao = lerPaginacaoDaUrl(consulta);
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

  /**
   * **A coluna do rótulo, e ela NÃO é o `podeLerTodas` acima com outro nome.**
   *
   * Os dois saem da mesma permissão hoje, e continuam sendo coisas diferentes: `visibilidade`, mais
   * abaixo, é `podeLerTodas` **cruzado com o filtro**; a lente **não pode depender do filtro**. O Gestor
   * que troca o recorte para *"Minhas ocorrências"* continua lendo *"Aberta"* — permissão, nunca recorte
   * (critério 28.6, e §3.2 da spec do 31).
   */
  const lente = lenteDeRotulo(vinculo.permissoes);

  const podeRegistrar = vinculo.pode("ocorrencia.registrar");
  const podeAlterarPrioridade = vinculo.pode("ocorrencia.alterar_prioridade");
  const organizacao = resolucao.ativo?.organizacao ?? null;

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
    // **`pagina`, `ate` e `totalNoCorte` vêm dos `searchParams`, e é o único canal que existe** — item
    // 14b: quem renderiza a página pedida é este Server Component, e ele não vê nada além da URL. Sem
    // `ate` o corte se refaria a cada clique; sem `totalNoCorte` a compensação de deslocamento nunca
    // executaria.
    { filtro, ...paginacao },
  );
  const categoriasPedidas = listarCategorias(repos.categorias, { incluirInativas: true });

  return (
    <NavegacaoDaLista>
      {/* **O respiro da barra fixa do celular.** Ela tem `py-3` mais um alvo de 44 px, e sem isto encobre
          o pé do cartão, onde a paginação mora. É o mesmo defeito que o critério 44d.1 conserta em T-05. */}
      <div className="flex flex-col gap-6 pb-20 md:pb-0">
        {/* **A marca e o menu de organização saíram daqui** (item 44b): os dois moram na barra superior da
            casca, que toda tela de dentro herda. O nome da organização ativa continua permanentemente
            visível — só que uma vez, e não copiado em cada tela.

            **O título é fixo e o recorte é controle** — critério 44c.2. As palavras do recorte não saíram
            da tela: elas mudaram de lugar, e são as mesmas do critério 14.3. */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-titulo-pagina text-tinta">Ocorrências</h1>

          <div className="flex items-center gap-3">
            {podeLerTodas ? (
              <SeletorDeRecorte
                consultaAtual={consultaAtual}
                visibilidadeAplicada={visibilidade}
                /* **A promessa desce, e não o número** (item 44p, critério 10): esperá-la aqui faria o
                   cabeçalho esperar pela consulta, que é exatamente o que a linha acima diz que ele não
                   faz. O seletor imprime os dois números quando eles chegam, junto com a lista. */
                contagens={paginaPedida.then((pagina) => pagina.contagens)}
              />
            ) : (
              /* Critério 44c.9 — as mesmas palavras, no mesmo lugar, sem controle. Parágrafo e não
                 `role="status"`: o texto só muda com a página, e região viva que nunca se atualiza é
                 ruído para quem usa leitor de tela. */
              <p className="text-interface text-tinta-suave">{RECORTE_MINHAS}</p>
            )}

            {podeRegistrar && (
              <Link
                href="/ocorrencias/nova"
                className={cn(
                  buttonVariants({ variant: "marca" }),
                  "hidden min-h-11 w-fit shrink-0 items-center rounded-sm px-4 text-interface md:inline-flex",
                )}
              >
                + Registrar ocorrência
              </Link>
            )}
          </div>
        </header>

        <Suspense fallback={<EsqueletoDaLista />}>
          <Lista
            pagina={paginaPedida}
            categorias={categoriasPedidas}
            filtro={filtro}
            consultaAtual={consultaAtual}
            nomeDaOrganizacao={organizacao?.nome ?? null}
            podeLerTodas={podeLerTodas}
            lente={lente}
            podeAlterarPrioridade={podeAlterarPrioridade}
            opcoesDeStatus={opcoesDeStatus}
            opcoesDePrioridade={opcoesDeFiltroPorPrioridade}
            podeRegistrar={podeRegistrar}
            podeConfigurar={vinculo.pode("organizacao.configurar")}
            mostrarPrioridade={podeAlterarPrioridade}
            pessoaIdDeQuemLe={ctx.pessoaId}
          />
        </Suspense>


        {/* **No celular o botão é fixo no rodapé**, porque *"a lista rola sem fim, e um botão que rola
            some"* (protótipo, D-2). Na tela grande ele está no topo — e é o lugar que o item 15 vai
            reaproveitar quando a barra de filtros nascer. */}
        {podeRegistrar && (
          <div className="border-linha bg-superficie fixed inset-x-0 bottom-0 border-t px-6 py-3 md:hidden">
            <Link
              href="/ocorrencias/nova"
              className={cn(
                buttonVariants({ variant: "marca" }),
                "flex min-h-11 w-full items-center justify-center text-interface",
              )}
            >
              + Registrar ocorrência
            </Link>
          </div>
        )}
      </div>
    </NavegacaoDaLista>
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
  lente,
  podeAlterarPrioridade,
  opcoesDeStatus,
  opcoesDePrioridade,
  podeRegistrar,
  podeConfigurar,
  mostrarPrioridade,
  pessoaIdDeQuemLe,
}: {
  pagina: Promise<PaginaDeOcorrencias>;
  categorias: Promise<readonly CategoriaLida[]>;
  filtro: FiltroDeOcorrencias;
  consultaAtual: string;
  nomeDaOrganizacao: string | null;
  podeLerTodas: boolean;
  /** Qual coluna do `glossario.md` §4 os itens da lista mostram — item 31. */
  lente: LenteDeRotulo;
  podeAlterarPrioridade: boolean;
  opcoesDeStatus: readonly OpcaoDeFiltro[];
  opcoesDePrioridade: readonly OpcaoDeFiltro[];
  podeRegistrar: boolean;
  podeConfigurar: boolean;
  mostrarPrioridade: boolean;
  /** Quem abriu T-03 — para a marca *"Conte como foi"* do critério 27.5. */
  pessoaIdDeQuemLe: string;
}) {
  const [resultado, listaDeCategorias] = await Promise.all([pagina, categorias]);
  const projetada = projetarPaginaDeOcorrencias(resultado, lente);

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
      />
    ) : (
      algumFiltroAplicado(filtro) && (
        /*
         * §3.1 — **URL filtrada nunca é beco.** Quem não tem `ler_todas` não tem barra, e pode chegar aqui
         * por um link filtrado que um Gestor compartilhou (critério 15.3). Sem esta saída, ele fica preso
         * num recorte que não sabe que existe.
         */
        <p className="border-linha text-interface border-b px-4 py-3">
          <Link href="/ocorrencias" className="text-marca underline underline-offset-4">
            Limpar filtros
          </Link>
        </p>
      )
    );

  /**
   * **O cruzamento do ícone, e ele é do cliente — não do payload** (critério 14.6).
   * `incluirInativas: true`: uma ocorrência antiga pode apontar para categoria desativada, e o ícone dela
   * não pode sumir por isso. Categoria fora do mapa degrada para `tag`, no próprio `IconeDeCategoria`.
   */
  const iconePorCategoria = Object.fromEntries(
    listaDeCategorias.map((categoria) => [categoria.id, categoria.icone]),
  );

  /**
   * O teto de página é do contrato (`PAGINA_MAXIMA`), e o cálculo fica aqui porque importar a constante
   * dentro de um componente de cliente arrastaria a Aplicação inteira para o pacote do navegador.
   */
  const totalDePaginas = Math.min(Math.ceil(projetada.total / projetada.limite), PAGINA_MAXIMA);

  /**
   * **Qual dos CINCO desfechos a lista mostra** — critério 44c.3, e a escolha é função pura com teste.
   * *Página além do fim* é decidida **antes** dos três vazios, e por isso não encosta neles.
   */
  const estado = estadoDaLista({
    quantidade: projetada.itens.length,
    total: projetada.total,
    visibilidadeAplicada: projetada.visibilidadeAplicada,
    algumFiltroAplicado: algumFiltroAplicado(filtro),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* **A deriva fica FORA do cartão, acima dele**: ela não recua durante a espera, e o *Atualizar*
          dela continua clicável enquanto a lista anterior está pintada. */}
      <DerivaDaLista
        consultaAtual={consultaAtual}
        ate={projetada.ate}
        hora={horaDoCorte(projetada.ate)}
        saidas={projetada.saidasDesdeOCorte}
        novas={projetada.novasDesdeOCorte}
      />

      {/* **A barra de filtros é a primeira faixa do cartão** (critério 44q.9), fora do recuo da espera.
          Ela some no vazio de organização — guia §8: filtrar um conjunto vazio não é uma oferta. Nos
          outros desfechos ela fica, e é o que impede o vazio de filtro de virar beco. */}
      <CartaoDaLista faixa={estado !== "organizacao" ? barra : undefined}>
        {/*
          **A `key` saiu no item 44c, e a propriedade ficou.** Ela foi escrita quando o componente
          acumulava páginas; desde o item 14b ele é **só desenho**, sem estado a descartar, e remontá-lo a
          cada navegação é o piscar que o critério 44c.4 existe para impedir. O recorte vive no
          endereço desta página, e é o botão voltar do navegador que o devolve a quem sai de T-05
          (critério 44g.10).

          **O que NÃO pode ser chaveado por `searchParams` é a fronteira de `<Suspense>` da página**, e
          ela não é: é o critério 14.7, e sem ele o 15.4 cai junto.
        */}
        {estado === "lista" && (
          <ListaDeOcorrencias
            primeiraPagina={projetada}
            iconePorCategoria={iconePorCategoria}
            mostrarPrioridade={mostrarPrioridade}
            pessoaIdDeQuemLe={pessoaIdDeQuemLe}
            agora={instanteDoServidor()}
          />
        )}

        {estado === "alem-do-fim" && (
          <AlemDoFim total={projetada.total} consultaAtual={consultaAtual} />
        )}

        {estado !== "lista" && estado !== "alem-do-fim" && (
          <Vazio
            tipo={estado}
            filtro={filtro}
            nomeDaOrganizacao={nomeDaOrganizacao}
            nomeDaCategoria={nomeDaCategoria}
            podeRegistrar={podeRegistrar}
            podeConfigurar={podeConfigurar}
          />
        )}

        {/* **A paginação permanece no quarto estado**, e é o guia §8 em letra: *"filtros e paginação
            permanecem"*. Ela some nos vazios de organização e de Solicitante, onde não há conjunto para
            paginar. */}
        {estado !== "organizacao" && estado !== "solicitante" && (
          <PaginacaoDaLista
            consultaAtual={consultaAtual}
            pagina={projetada.pagina}
            totalDePaginas={totalDePaginas}
            totalNoCorte={projetada.totalNoCorte}
            ate={projetada.ate}
            total={projetada.total}
          />
        )}
      </CartaoDaLista>
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
    <div className="border-linha bg-superficie rounded-lg border px-4 py-10 text-center shadow-sm">
      <h2 className="text-tinta text-titulo-bloco font-medium">Este link tem um filtro que não existe.</h2>
      <p className="text-tinta-suave text-corpo mt-1">
        Ele pode ter sido editado, ou ter sido feito numa versão anterior do aplicativo.
      </p>
      <Link
        href="/ocorrencias"
        className="text-marca text-interface mt-4 inline-block underline underline-offset-4"
      >
        Limpar filtros
      </Link>
    </div>
  );
}

/**
 * Os vazios — critério 14.4.
 *
 * **Qual dos três é decisão de `vazioDaLista`**, que tem teste próprio — e desde o item 44c quem a chama
 * é `estadoDaLista`, que decide entre cinco. Aqui só se desenha o que ela escolheu. **O terceiro ramo
 * passou a ser alcançável com o item 15**, que é quem tem os valores do recorte: o `false` fixo virou
 * `algumFiltroAplicado(filtro)`, e o subtítulo e o *"Limpar filtros"* entraram (critério 15.6). **A função
 * de escolha é reusada, não reescrita** — a precedência *filtro ganha da visibilidade* já vinha decidida
 * do 14.
 */
function Vazio({
  tipo,
  filtro,
  nomeDaOrganizacao,
  nomeDaCategoria,
  podeRegistrar,
  podeConfigurar,
}: {
  tipo: TipoDeVazio;
  filtro: FiltroDeOcorrencias;
  nomeDaOrganizacao: string | null;
  nomeDaCategoria: (id: string) => string | undefined;
  podeRegistrar: boolean;
  podeConfigurar: boolean;
}) {
  const texto = TEXTO_DO_VAZIO[tipo];

  return (
    <Empty className="md:p-10">
      <EmptyHeader>
        <EmptyTitle className="text-titulo-bloco text-tinta">{texto.titulo}</EmptyTitle>
        {texto.corpo !== null && (
          <EmptyDescription className="text-corpo text-tinta-suave">{texto.corpo}</EmptyDescription>
        )}
        {/*
          O subtítulo do **terceiro vazio** — critério 15.6. `corpo` é `null` para este tipo de propósito,
          esperando exatamente isto: o recorte em palavras, com os mesmos rótulos dos chips.
          **`nomeDaOrganizacao` pode ser nulo**, e a frase sem o nome continua verdadeira; inventá-lo
          seria pior.
        */}
        {tipo === "filtro" && (
          <EmptyDescription className="text-corpo text-tinta-suave">
            {nomeDaOrganizacao === null ? "Com " : `Em ${nomeDaOrganizacao}, com `}
            {descricaoDoRecorte(filtro, nomeDaCategoria).join(" · ")}.
          </EmptyDescription>
        )}
      </EmptyHeader>
      {/* **Registrar é a ação da tela, e vem primeiro, em marca** (item 64, validação de 23/09/2026). Até
          o 64 o convite principal do primeiro vazio era *Conferir as áreas*, porque a organização nasce com
          áreas-semente genéricas e é isso que primeiro quebra o registro do Solicitante. Ele continua
          oferecido, ao lado e em contorno: o dono decidiu a hierarquia pela ação da tela. Abaixo de `sm`
          os dois empilham, principal em cima, na largura cheia. */}
      <EmptyContent className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center">
        {podeRegistrar && (
          <Link
            href="/ocorrencias/nova"
            className={cn(buttonVariants({ variant: "marca" }), "text-interface min-h-11 px-4")}
          >
            <Plus aria-hidden="true" />
            {tipo === "organizacao" ? "Registrar a primeira" : "Registrar ocorrência"}
          </Link>
        )}
        {tipo === "organizacao" && podeConfigurar && (
          <Link
            href="/configuracao/areas"
            className={cn(buttonVariants({ variant: "outline" }), "border-linha text-interface min-h-11 px-4")}
          >
            Conferir as áreas
          </Link>
        )}
        {tipo === "filtro" && (
          <Link
            href="/ocorrencias"
            className={cn(buttonVariants({ variant: "outline" }), "border-linha text-interface min-h-11 px-4")}
          >
            Limpar filtros
          </Link>
        )}
      </EmptyContent>
    </Empty>
  );
}

/**
 * **O quarto estado — e ele NÃO é um dos três vazios do critério 14.4.**
 *
 * Aqueles respondem *"a consulta correu e não achou nada"*; este responde *"a consulta correu e você
 * pediu depois do fim"*. Quem decide entre eles é `estadoDaLista`, que tem teste.
 *
 * **A ação leva à PRIMEIRA página**, e é o guia §8. A spec do item 14b escreveu *"oferece a última"*, e
 * o guia tem precedência desde 13/09/2026 — está no achado A-03.
 *
 * **Os filtros e a paginação permanecem**, porque a lista existe: o que não existe é esta página.
 */
function AlemDoFim({ total, consultaAtual }: { total: number; consultaAtual: string }) {
  const daPrimeira = new URLSearchParams(consultaAtual);
  for (const nome of ["pagina", "ate", "totalNoCorte"]) daPrimeira.delete(nome);
  const consulta = daPrimeira.toString();

  return (
    <Empty className="md:p-10">
      <EmptyHeader>
        <EmptyTitle className="text-titulo-bloco text-tinta">{TEXTO_ALEM_DO_FIM.titulo}</EmptyTitle>
        <EmptyDescription className="text-corpo text-tinta-suave">
          Este corte tem {total} {total === 1 ? "ocorrência" : "ocorrências"}, e nenhuma delas cai nesta
          página.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          href={consulta === "" ? "/ocorrencias" : `/ocorrencias?${consulta}`}
          className={cn(buttonVariants({ variant: "outline" }), "text-interface min-h-11 px-4")}
        >
          {TEXTO_ALEM_DO_FIM.acao}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
