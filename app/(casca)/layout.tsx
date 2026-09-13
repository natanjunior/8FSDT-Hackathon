import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarPedidosDeEntrada } from "@/aplicacao/organizacao";
import type { Permissao } from "@/dominio/organizacao";
import { BarraSuperior } from "@/interface/componentes/casca/barra-superior";
import { Navegacao } from "@/interface/componentes/casca/navegacao";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/interface/componentes/ui/sheet";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * ============================================================================
 *  A casca das telas de dentro da organização
 * ============================================================================
 *
 * **Doze rotas herdam esta moldura, e nenhuma URL muda:** `(casca)` é grupo entre parênteses, que não
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
    <div className="min-h-dvh">
      <BarraSuperior
        vinculos={projetado.vinculos}
        organizacaoAtivaId={organizacaoAtiva.id}
        nomeDaPessoa={projetado.pessoa.nome}
      >
        <Sheet>
          <SheetTrigger aria-label="Abrir navegação" className="min-h-11 min-w-11 md:hidden">
            ☰
          </SheetTrigger>
          <SheetContent side="left" className="w-[214px] p-4">
            <SheetTitle className="sr-only">Nesta organização</SheetTitle>
            {navegacao}
          </SheetContent>
        </Sheet>
      </BarraSuperior>

      <div className="flex">
        <aside className="border-linha hidden w-[214px] shrink-0 border-r p-4 md:block">
          {navegacao}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
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
 */
function NavegacaoSemContagem({ vinculo }: { vinculo: VinculoDaCasca }) {
  return (
    <Navegacao
      podeVerDashboard={vinculo.pode("dashboard.ler")}
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
  const pendentes = vinculo.pode("vinculo.gerir")
    ? (await listarPedidosDeEntrada(pedidos, {})).length
    : null;

  return (
    <Navegacao
      podeVerDashboard={vinculo.pode("dashboard.ler")}
      pendentes={pendentes}
      podeConfigurar={vinculo.pode("organizacao.configurar")}
    />
  );
}
