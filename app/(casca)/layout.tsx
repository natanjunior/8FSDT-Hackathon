import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarPedidosDeEntrada } from "@/aplicacao/organizacao";
import type { Permissao } from "@/dominio/organizacao";
import { BarraSuperior } from "@/interface/componentes/casca/barra-superior";
import { Navegacao } from "@/interface/componentes/casca/navegacao";
import { PeDaBarra } from "@/interface/componentes/casca/pe-da-barra";
import { ID_DO_CONTEUDO, PularParaOConteudo } from "@/interface/componentes/pular-para-o-conteudo";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/interface/componentes/ui/sidebar";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * ============================================================================
 *  A casca das telas de dentro da organização
 * ============================================================================
 *
 * **Catorze rotas herdam esta moldura, e nenhuma URL muda:** `(casca)` é grupo entre parênteses, que não
 * entra no endereço. Antes deste layout, dezesseis arquivos declaravam a própria moldura de página à mão,
 * com três larguras escolhidas por arquivo sem regra — que é o que produzia tela sem parecença com a
 * vizinha.
 *
 * **T-04 não está aqui**, e sim em `app/(foco)/`: ela é a tela que o RNF6 cronometra, e oferecer navegação
 * lateral no meio de um registro convida a sair de uma tarefa que custa refazer.
 *
 * **`qualquer-vinculo-ativo` é o que a casca exige**, e não uma permissão: ela é a moldura de telas que
 * pedem permissões diferentes entre si. Cada página continua exigindo a sua.
 */
export default async function LayoutDaCasca({ children }: { children: React.ReactNode }) {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("qualquer-vinculo-ativo");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01 (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const { ctx, repos, resolucao } = escopo;
  const projetado = projetarContexto(resolucao);
  const organizacaoAtiva = projetado.organizacaoAtiva;

  // `situacao === "pronto"` já garante vínculo ativo; a guarda existe para o tipo, não para o caso.
  if (organizacaoAtiva === null) redirect("/organizacao");

  const navegacao = (
    <Suspense fallback={<NavegacaoSemContagem vinculo={ctx.vinculo} />}>
      <NavegacaoComContagem vinculo={ctx.vinculo} pedidos={repos.pedidosDeEntrada} />
    </Suspense>
  );

  return (
    <SidebarProvider open className="min-h-dvh flex-col">
      <PularParaOConteudo />
      {/* **O e-mail vem da resolução, e não da projeção** (item 44i): ele serve ao cabeçalho do menu de
          pessoa, sempre para a própria pessoa, e continua fora de `ContextoProjetado`. */}
      <BarraSuperior
        vinculos={projetado.vinculos}
        organizacaoAtivaId={organizacaoAtiva.id}
        nomeDaPessoa={projetado.pessoa.nome}
        emailDaPessoa={resolucao.sessao.email}
      >
        <SidebarTrigger aria-label="Abrir navegação" className="size-11 md:hidden" />
      </BarraSuperior>

      <div className="flex w-full flex-1">
        {/* **A barra começa abaixo do cabeçalho, e é a única briga entre o componente e o desenho.** O
            `Sidebar` do catálogo é `fixed inset-y-0` com `h-svh`, porque o arranjo canônico dele põe a
            marca dentro da lateral e o cabeçalho só sobre o conteúdo. Este produto tem a barra superior
            atravessando, e foi assim que o dono validou. O `!` é o que torna o deslocamento determinístico:
            sem ele, `top-14` e o `inset-y-0` do componente dependeriam da ordem em que o Tailwind emite as
            duas propriedades.

            **`overflow-x-hidden` no corpo** (critério 76.1): o `overflow-auto` do catálogo vale nos dois
            eixos, e um filho um pixel mais largo que a coluna ligava a rolagem horizontal. O conserto é no
            uso, e não em `ui/sidebar.tsx`. O pé, com a documentação e o grupo, é irmão do corpo (76.2). */}
        <Sidebar
          collapsible="offcanvas"
          className="top-14! h-[calc(100svh-3.5rem)]! md:top-[60px]! md:h-[calc(100svh-60px)]!"
        >
          <SidebarContent className="gap-0 overflow-x-hidden px-2 py-4">{navegacao}</SidebarContent>
          <PeDaBarra />
        </Sidebar>

        {/* **O destino do salto** (critério 94.6). `tabIndex={-1}` move o ponto de partida do Tab para cá,
            e o contorno fica de fora: o `<main>` não é controle, e um anel em volta da página inteira
            pareceria seleção. É a mesma exceção declarada da linha clicável (D-02). */}
        <SidebarInset id={ID_DO_CONTEUDO} tabIndex={-1} className="min-w-0 px-4 py-6 outline-none md:px-6">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

/**
 * O que as duas precisam do contexto, e nada além disso.
 *
 * **`pode` recebe a união `Permissao`, não `string`** — a lista fechada é do domínio
 * (`Permissao.ts:32`), e afrouxá-la aqui deixaria passar nome de permissão que não existe.
 */
type VinculoDaCasca = { pode: (permissao: Permissao) => boolean };

/**
 * **A navegação enquanto a contagem não chegou.** Mesma forma, sem o número — e nunca esqueleto: a casca
 * já está no cliente, e esqueleto aqui piscaria a cada navegação.
 *
 * **Participantes já está nela**, com a linha do número reservada (item 44h). Até ali, o item só existia
 * com a contagem: na primeira carga ele entrava depois, empurrando os de baixo, e `/vinculos` ficava sem
 * marca durante a espera.
 */
function NavegacaoSemContagem({ vinculo }: { vinculo: VinculoDaCasca }) {
  return (
    <Navegacao
      podeVerDashboard={vinculo.pode("dashboard.ler")}
      podeGerirVinculos={vinculo.pode("vinculo.gerir")}
      pendentes={null}
      podeConfigurar={vinculo.pode("organizacao.configurar")}
    />
  );
}

/**
 * **A contagem de pedidos pendentes, e ela é a única coisa da casca que espera o banco.**
 *
 * Ela morava em T-03 (`app/ocorrencias/page.tsx:160-162`) e passa a valer em toda tela de dentro, que é o
 * que a torna um sinal em vez de um detalhe do rodapé de uma lista. **Posta direto no corpo do layout,
 * atrasaria toda navegação de dentro** — dentro do `Suspense` a casca pinta na hora e o número chega
 * depois.
 */
async function NavegacaoComContagem({
  vinculo,
  pedidos,
}: {
  vinculo: VinculoDaCasca;
  pedidos: Parameters<typeof listarPedidosDeEntrada>[0];
}) {
  const podeGerirVinculos = vinculo.pode("vinculo.gerir");
  const pendentes = podeGerirVinculos
    ? (await listarPedidosDeEntrada(pedidos, {})).length
    : null;

  return (
    <Navegacao
      podeVerDashboard={vinculo.pode("dashboard.ler")}
      podeGerirVinculos={podeGerirVinculos}
      pendentes={pendentes}
      podeConfigurar={vinculo.pode("organizacao.configurar")}
    />
  );
}
