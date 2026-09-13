import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  listarOcorrencias,
  type FiltroDeOcorrencias,
  type PaginaDeOcorrencias,
} from "@/aplicacao/ocorrencia";
import { listarCategorias, type CategoriaLida } from "@/aplicacao/organizacao";
import { STATUS } from "@/dominio/ocorrencia";
import { BarraDeFiltros, type OpcaoDeFiltro } from "@/interface/componentes/barra-de-filtros";
import { ListaDeOcorrencias } from "@/interface/componentes/lista-de-ocorrencias";
import { NavegacaoDaLista } from "@/interface/componentes/navegacao-da-lista";
import { SeletorDeRecorte } from "@/interface/componentes/recorte-da-lista";
import { RECORTE_MINHAS } from "@/interface/componentes/rotulos";
import { instanteDoServidor } from "@/interface/componentes/tempo-relativo";
import { TEXTO_DO_VAZIO, vazioDaLista } from "@/interface/componentes/vazio-da-lista";
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
          <h1 className="text-titulo-pagina text-tinta leading-snug font-semibold">Ocorrências</h1>

          <div className="flex items-center gap-3">
            {podeLerTodas ? (
              <SeletorDeRecorte consultaAtual={consultaAtual} visibilidadeAplicada={visibilidade} />
            ) : (
              /* Critério 44c.9 — as mesmas palavras, no mesmo lugar, sem controle. Parágrafo e não
                 `role="status"`: o texto só muda com a página, e região viva que nunca se atualiza é
                 ruído para quem usa leitor de tela. */
              <p className="text-interface text-tinta-suave">{RECORTE_MINHAS}</p>
            )}

            {podeRegistrar && (
              <Link
                href="/ocorrencias/nova"
                className="border-marca bg-accent text-tinta hidden min-h-11 w-fit shrink-0 items-center rounded-sm border px-4 text-sm font-medium md:inline-flex"
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
              className="border-marca bg-accent text-tinta flex min-h-11 items-center justify-center rounded-md border text-sm font-medium"
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
        **A `key` e a propriedade fazem coisas diferentes, e as duas continuam obrigatórias.** A `key`
        remonta o componente quando o recorte muda; `consultaAtual` é o que faz o *Voltar* de T-05 devolver
        a lista filtrada (critério 15.3).

        **E a `key` continua certa com a paginação numerada:** trocar de página muda `consultaAtual` e
        remonta o componente, que desde o item 14b é **só desenho** — não há estado acumulado para
        preservar. **O que NÃO pode ser chaveado por `searchParams` é a fronteira de `<Suspense>` da
        página**, e ela não é: é o critério 14.7, e sem ele o 15.4 cai junto.

        **`projetada` já É o envelope novo** — `total`, `pagina`, `limite`, `ate`, `totalNoCorte`,
        `saidasDesdeOCorte`, `novasDesdeOCorte` e `contagens` —, então a navegação numerada que a frente
        de design vai desenhar não precisa de nenhuma propriedade nova.
      */}
      <ListaDeOcorrencias
        key={consultaAtual}
        primeiraPagina={projetada}
        consultaAtual={consultaAtual}
        iconePorCategoria={iconePorCategoria}
        mostrarPrioridade={mostrarPrioridade}
        pessoaIdDeQuemLe={pessoaIdDeQuemLe}
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
