import Link from "next/link";
import { Building2, ChartColumn, ClipboardList, Tags, Users, type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/interface/componentes/ui/sidebar";

/**
 * **Os itens da barra lateral — item 44f.**
 *
 * **Três blocos, separados por régua**, e a ordem é a do dono em 14/09/2026: `Ocorrências` sozinha,
 * o grupo `Organização`, e `Dashboard` por último.
 *
 * **`Ocorrências` fica sozinha no topo** porque o `inventario-de-telas.md` decide que *"T-03 é o eixo:
 * toda tela de dentro se alcança dela"*, e um eixo dentro de um grupo deixa de parecer eixo. **`Dashboard`
 * vem por último** porque é leitura sobre o que as outras três produzem.
 *
 * **`Organização` é rótulo de seção, e não alvo.** Um item pai que só existe para ter filhos seria um alvo
 * de 44 px que não navega para lugar nenhum; se ele expandisse e recolhesse, seria um controle
 * administrando duas linhas. Por isso `SidebarGroupLabel`, no sétimo papel da escala — o mesmo que a barra
 * superior usa para a marca.
 *
 * **O ícone nunca substitui o rótulo** (compromisso A-5): ele vai `aria-hidden` e a palavra fica ao lado
 * em todas as larguras.
 *
 * **A contagem carrega a palavra, nunca só o número.** O catálogo oferece `SidebarMenuBadge`, que mostra o
 * número sozinho — e sob o rótulo `Participantes` um "3" não diz três do quê. A linha de apoio fica, no
 * `size="lg"`, que é o tamanho de duas linhas.
 */
export function Navegacao({
  podeVerDashboard,
  pendentes,
  podeConfigurar,
}: {
  podeVerDashboard: boolean;
  pendentes: number | null;
  podeConfigurar: boolean;
}) {
  const temOrganizacao = pendentes !== null || podeConfigurar;

  return (
    <nav aria-label="Nesta organização" className="flex flex-col">
      <SidebarGroup className="py-0">
        <SidebarGroupContent>
          <SidebarMenu>
            <ItemDeNavegacao href="/ocorrencias" rotulo="Ocorrências" Icone={ClipboardList} />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {temOrganizacao && (
        <>
          <SidebarSeparator className="mx-2 my-3" />
          <SidebarGroup className="py-0">
            <SidebarGroupLabel className="text-rotulo-coluna text-tinta-suave gap-2 font-mono tracking-[0.11em] uppercase">
              <Building2 aria-hidden="true" />
              Organização
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pendentes !== null && (
                  <ItemDeNavegacao
                    href="/vinculos"
                    rotulo="Participantes"
                    Icone={Users}
                    apoio={fraseDaContagem(pendentes)}
                  />
                )}
                {podeConfigurar && (
                  <ItemDeNavegacao href="/configuracao" rotulo="Categorias e áreas" Icone={Tags} />
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </>
      )}

      {podeVerDashboard && (
        <>
          <SidebarSeparator className="mx-2 my-3" />
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <ItemDeNavegacao href="/dashboard" rotulo="Dashboard" Icone={ChartColumn} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </>
      )}
    </nav>
  );
}

/** As três formas da contagem, e a de zero é informação: a fila foi olhada e está vazia. */
function fraseDaContagem(pendentes: number): string {
  if (pendentes === 0) return "nenhum pedido aguardando";
  if (pendentes === 1) return "1 pedido aguardando";
  return `${pendentes} pedidos aguardando`;
}

/**
 * **`asChild` com `<Link>`**, e não `<button>`: navegação é âncora, e é o que preserva abrir em outra aba.
 *
 * **`h-auto` mais `min-h-11`**, e não a altura do `cva`: `h-8` e `h-12` são grupo `h` no `tailwind-merge`,
 * então `h-auto` os substitui e o piso de 44 px do guia §4 passa a ser `min-h-11`. **Medido:** no
 * `size="lg"`, `h-12` são 48 px fixos com `overflow-hidden`, e as duas linhas mais o `p-2` do `cva` pedem
 * 48,5 px — `text-interface` e `text-meta` em `leading-tight` somam 32,5. Meio pixel de corte, e ele cai
 * no descendente da linha de apoio. Com a altura decidida pelo conteúdo o caso some.
 *
 * **`text-interface` vence o `text-sm`** do `cva` pelo `cn` estendido, que declara os sete papéis da
 * escala como `font-size`.
 *
 * **O movimento usa a forma de parêntese**, `duration-(--tempo-ponteiro)`, e não `duration-[--…]`:
 * conferido compilando o Tailwind 4.3.3 deste repositório, a forma de colchete emite
 * `transition-duration: --tempo-ponteiro`, sem `var()`, que é valor inválido e cai fora. A forma antiga
 * está em `button.tsx:8` e no `navegacao.tsx` de hoje, e é o achado A-11.
 *
 * **O rótulo e o apoio vão num `div`, e não num `span`.** O `cva` do `SidebarMenuButton` traz
 * `[&>span:last-child]:truncate`, que num contêiner de duas linhas aplicaria `white-space: nowrap` na
 * pilha inteira.
 */
function ItemDeNavegacao({
  href,
  rotulo,
  Icone,
  apoio,
}: {
  href: string;
  rotulo: string;
  Icone: LucideIcon;
  apoio?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        size={apoio === undefined ? "default" : "lg"}
        className="text-interface h-auto min-h-11 transition-[background-color,color,transform] duration-(--tempo-ponteiro) ease-(--curva-ponteiro) active:scale-[0.97]"
      >
        <Link href={href}>
          <Icone aria-hidden="true" />
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate">{rotulo}</span>
            {apoio !== undefined && (
              <span className="text-tinta-suave text-meta truncate">{apoio}</span>
            )}
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
