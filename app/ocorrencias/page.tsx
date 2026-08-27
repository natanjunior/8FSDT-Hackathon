import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarOcorrencias, type PaginaDeOcorrencias } from "@/aplicacao/ocorrencia";
import { listarCategorias, listarPedidosDeEntrada, type CategoriaLida } from "@/aplicacao/organizacao";
import { acaoDeSair } from "@/interface/acoes";
import { ListaDeOcorrencias } from "@/interface/componentes/lista-de-ocorrencias";
import { instanteDoServidor } from "@/interface/componentes/tempo-relativo";
import { TEXTO_DO_VAZIO, vazioDaLista } from "@/interface/componentes/vazio-da-lista";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarPaginaDeOcorrencias } from "@/interface/projecoes";

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

export default async function Ocorrencias() {
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
  const organizacao = resolucao.ativo?.organizacao ?? null;

  /**
   * **As duas leituras da lista partem agora e não são esperadas aqui.** Elas são passadas como promessa
   * para dentro do `<Suspense>`, que é quem as espera — é o que faz o cabeçalho pintar antes da lista.
   */
  const paginaPedida = listarOcorrencias(repos.ocorrencias, {
    pessoaId: ctx.pessoaId,
    podeLerTodas,
  });
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
          {podeLerTodas ? "Todas as ocorrências" : "Minhas ocorrências"}
        </h1>
        {/* A organização ativa, permanentemente visível: *"num produto em que a organização vem da sessão
            e não da URL, o endereço não diz onde você está, então a tela tem de dizer"* (inventário §3,
            decisão 3). **Sem o `▾` de trocar** — isso é `PUT /contexto/organizacao`, o item 7b. */}
        {organizacao !== null && <p className="text-tinta-suave text-sm">{organizacao.nome}</p>}
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
          podeRegistrar={podeRegistrar}
          podeConfigurar={vinculo.pode("organizacao.configurar")}
          mostrarPrioridade={vinculo.pode("ocorrencia.alterar_prioridade")}
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
  podeRegistrar,
  podeConfigurar,
  mostrarPrioridade,
}: {
  pagina: Promise<PaginaDeOcorrencias>;
  categorias: Promise<readonly CategoriaLida[]>;
  podeRegistrar: boolean;
  podeConfigurar: boolean;
  mostrarPrioridade: boolean;
}) {
  const [resultado, listaDeCategorias] = await Promise.all([pagina, categorias]);
  const projetada = projetarPaginaDeOcorrencias(resultado);

  if (projetada.itens.length === 0) {
    return (
      <Vazio
        visibilidade={projetada.visibilidadeAplicada}
        podeRegistrar={podeRegistrar}
        podeConfigurar={podeConfigurar}
      />
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
    <ListaDeOcorrencias
      primeiraPagina={projetada}
      iconePorCategoria={iconePorCategoria}
      mostrarPrioridade={mostrarPrioridade}
      agora={instanteDoServidor()}
    />
  );
}

/**
 * Os vazios — critério 14.4.
 *
 * **Qual dos três é decisão de `vazioDaLista`**, que tem teste próprio. Aqui só se desenha o que ela
 * escolheu. **`algumFiltroAplicado` é `false` fixo nesta fatia:** não há filtro até o item 15, que é quem
 * torna o terceiro ramo alcançável e quem acrescenta o subtítulo com os valores e o *"Limpar filtros"*
 * (critério 15.6).
 */
function Vazio({
  visibilidade,
  podeRegistrar,
  podeConfigurar,
}: {
  visibilidade: "todas" | "apenas_minhas";
  podeRegistrar: boolean;
  podeConfigurar: boolean;
}) {
  const tipo = vazioDaLista(visibilidade, false);
  const texto = TEXTO_DO_VAZIO[tipo];

  return (
    <section className="border-linha flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-6">
      <h2 className="text-tinta text-base font-semibold">{texto.titulo}</h2>
      {texto.corpo !== null && (
        <p className="text-tinta-suave text-sm leading-relaxed">{texto.corpo}</p>
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
