"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChartColumn,
  ClipboardList,
  LayoutGrid,
  Settings,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { estaMarcado, type DestinoDaBarra } from "@/interface/componentes/casca/destino-atual";
import { fraseDePedidosPendentes } from "@/interface/componentes/rotulos";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/interface/componentes/ui/sidebar";

/**
 * **Os itens da barra lateral — item 44f.**
 *
 * **Três blocos, separados por régua**, e a ordem é a do dono em 14/09/2026: `Ocorrências` sozinha,
 * o grupo `Organização`, e `Dashboard` por último.
 *
 * **Um quarto bloco, num segundo marco: *Além desta organização*.** *Meus dados* entra nele no item 64:
 * a tela vale em todas as organizações (`meus-dados/page.tsx:51`), e sob o rótulo *"Nesta organização"* o
 * leitor de tela anunciaria uma coisa falsa. A página do grupo e a documentação moraram aqui do item 70 ao
 * 76; desde o 76 elas estão no pé da barra, em `pe-da-barra.tsx`, num marco próprio. A régua acima do
 * bloco não depende de papel: o Solicitante, sem Dashboard, também a vê, e ela separa os dois marcos.
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
 * **Quatro filhos sob `Organização`, desde o item 48.** `Configuração` é a tela da organização inteira,
 * `Participantes` é quem está nela, e `Categorias` e `Áreas` são as duas listas que ela configura — a
 * ordem vai do geral para o particular, que é a mesma regra que põe `Dashboard` por último. **O modo de
 * ícones do catálogo continua fora**, pela razão medida no 44f: `SidebarMenuSub` carrega
 * `group-data-[collapsible=icon]:hidden`.
 *
 * **O ícone de `Áreas` não é `MapPin`, e a recusa é do glossário.** A entrada *Localização* diz *"não é
 * geolocalização: não há mapa nem coordenada"*, e um alfinete de mapa no item que **nomeia a lista**
 * contradiria a definição no primeiro pixel. `LayoutGrid` é o lugar dividido em partes. A recusa vale
 * para este item: a ficha do local numa ocorrência leva o `MapPin` desde o item 64, porque ali ele marca
 * *onde*, e o emoji que ele substituiu já era um alfinete.
 *
 * **O ícone nunca substitui o rótulo** (compromisso A-5): ele vai `aria-hidden` e a palavra fica ao lado
 * em todas as larguras.
 *
 * **A contagem carrega a palavra, nunca só o número.** O catálogo oferece `SidebarMenuBadge`, que mostra o
 * número sozinho — e sob o rótulo `Participantes` um "3" não diz três do quê. A linha de apoio fica, no
 * `size="lg"`, que é o tamanho de duas linhas.
 *
 * ---------------------------------------------------------------------------
 *  Item 44h — a barra marca onde você está
 * ---------------------------------------------------------------------------
 *
 * **A barra inteira é de cliente**, porque o caminho vem de `usePathname()`, e o layout não re-renderiza
 * entre telas: o servidor não tem como decidir a marca. Os ícones são importados deste lado, então nenhum
 * componente atravessa a fronteira; o layout passa só booleanos e número. A regra mora em
 * `destino-atual.ts`, com teste, e cada item recebe um `DestinoDaBarra`.
 *
 * **O item marcado** tem o fundo `--sidebar-accent`, peso 500 e `aria-current="page"` no link. **O ícone
 * dele vai em tinta, e o dos outros em tinta suave**, como a prancheta desenha: a passagem do ponteiro usa
 * o mesmo fundo da marca, e sem o ícone o item sob o ponteiro e o item atual só se distinguiriam pelo
 * peso. A marca não depende só de cor: `aria-current` e o peso a carregam.
 *
 * **Participantes existe durante a espera.** `podeGerirVinculos` diz se o item aparece; `pendentes` diz
 * só se o número já chegou. Antes, um `null` dizia as duas coisas, e o item entrava depois, empurrando os
 * de baixo e deixando `/vinculos` sem marca na primeira carga.
 *
 * **Os grupos não têm recuo próprio** (`p-0`), que é a geometria da prancheta: ícones, rótulo de seção e
 * réguas a 16 px da borda, e 157 px de coluna para o texto do item. Com o `p-2` do catálogo eram 141, e a
 * forma de zero da contagem, com 145, era cortada.
 *
 * **No celular, tocar num item fecha a gaveta**, no próprio toque. A gaveta é modal e cobre a página,
 * então tocar num item dela é a única mudança de tela que o produto oferece enquanto ela está aberta; e
 * tocar no item da tela atual também fecha, porque um toque que não faz nada parece defeito. Um efeito
 * sobre o caminho fecharia só quando o roteador trocasse o caminho, o que espera o servidor, e numa
 * partida a frio a primeira resposta passa de 20 s.
 */
export function Navegacao({
  podeVerDashboard,
  podeGerirVinculos,
  pendentes,
  podeConfigurar,
}: {
  podeVerDashboard: boolean;
  podeGerirVinculos: boolean;
  /** `null` enquanto a contagem não chegou. Só é lida quando `podeGerirVinculos`. */
  pendentes: number | null;
  podeConfigurar: boolean;
}) {
  const caminho = usePathname();
  const { setOpenMobile } = useSidebar();
  const aoTocar = () => setOpenMobile(false);
  const temOrganizacao = podeGerirVinculos || podeConfigurar;

  return (
    <>
      <nav aria-label="Nesta organização" className="flex flex-col">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <ItemDeNavegacao
                destino="/ocorrencias"
                rotulo="Ocorrências"
                Icone={ClipboardList}
                caminho={caminho}
                aoTocar={aoTocar}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {temOrganizacao && (
          <>
            <SidebarSeparator className="mx-2 my-3" />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="text-rotulo-coluna text-tinta-suave gap-2 font-mono uppercase">
                <Building2 aria-hidden="true" />
                Organização
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {podeConfigurar && (
                    <ItemDeNavegacao
                      destino="/configuracao"
                      rotulo="Configuração"
                      Icone={Settings}
                      caminho={caminho}
                      aoTocar={aoTocar}
                    />
                  )}
                  {podeGerirVinculos && (
                    <ItemDeNavegacao
                      destino="/vinculos"
                      rotulo="Participantes"
                      Icone={Users}
                      apoio={pendentes === null ? null : fraseDePedidosPendentes(pendentes)}
                      caminho={caminho}
                      aoTocar={aoTocar}
                    />
                  )}
                  {podeConfigurar && (
                    <>
                      <ItemDeNavegacao
                        destino="/configuracao/categorias"
                        rotulo="Categorias"
                        Icone={Tags}
                        caminho={caminho}
                        aoTocar={aoTocar}
                      />
                      <ItemDeNavegacao
                        destino="/configuracao/areas"
                        rotulo="Áreas"
                        Icone={LayoutGrid}
                        caminho={caminho}
                        aoTocar={aoTocar}
                      />
                    </>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {podeVerDashboard && (
          <>
            <SidebarSeparator className="mx-2 my-3" />
            <SidebarGroup className="p-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <ItemDeNavegacao
                    destino="/dashboard"
                    rotulo="Dashboard"
                    Icone={ChartColumn}
                    caminho={caminho}
                    aoTocar={aoTocar}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </nav>

      <SidebarSeparator className="mx-2 my-3" />
      <nav aria-label="Além desta organização" className="flex flex-col">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <ItemDeNavegacao
                destino="/meus-dados"
                rotulo="Meus dados"
                Icone={UserRound}
                caminho={caminho}
                aoTocar={aoTocar}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </nav>
    </>
  );
}

/**
 * **`asChild` com `<Link>`**, e não um botão nativo: navegação é âncora, e é o que preserva abrir em outra
 * aba. Por isso `aria-current` vai no `<Link>`, que é o elemento que o `asChild` desenha.
 *
 * **`h-auto` mais `min-h-11`**, e não a altura do `cva`: `h-8` e `h-12` são grupo `h` no `tailwind-merge`,
 * então `h-auto` os substitui e o piso de 44 px do guia §4 passa a ser `min-h-11`. **Medido:** no
 * `size="lg"`, `h-12` são 48 px fixos com `overflow-hidden`, e as duas linhas pediam mais que isso. Desde
 * o item 44q o rótulo leva os 13,5 / 17 do item de menu da prancheta (`text-interface/[17px]`, tamanho e
 * entrelinha numa classe só, que o `cn` não separa): rótulo 17 mais apoio 17 (`text-meta`) mais 12 de
 * respiro (`py-1.5`) dá 46 px, acima dos 44. Com a altura decidida pelo conteúdo, nada corta.
 *
 * **`text-interface` vence o padrão do `cva`** pelo `cn` estendido, que declara os oito papéis da
 * escala como `font-size`.
 *
 * **O movimento usa a forma de parêntese**, `duration-(--tempo-ponteiro)`, e não a de colchete:
 * conferido compilando o Tailwind 4.3.3 deste repositório, a forma de colchete emite
 * `transition-duration: --tempo-ponteiro`, sem `var()`, que é valor inválido e cai fora. A forma antiga
 * continua no `cva` de `ui/button.tsx`, e é o achado A-11 do 44f.
 *
 * **O rótulo e o apoio vão num `div`, e não num `span`.** O `cva` do `SidebarMenuButton` traz
 * `[&>span:last-child]:truncate`, que num contêiner de duas linhas aplicaria `white-space: nowrap` na
 * pilha inteira.
 *
 * **`apoio` tem três estados.** Sem ele, o item tem uma linha. Com `null`, tem duas, e a segunda fica
 * reservada por um espaço não separável (` `, escrito como escape porque um espaço comum colapsa e a
 * linha some) `aria-hidden` no mesmo papel da escala, para o número chegar sem mudar a altura. Com texto,
 * a segunda linha é a contagem, e ela leva `font-normal` porque o `data-[active=true]:font-medium` do
 * `cva` vale para o link inteiro.
 */
function ItemDeNavegacao({
  destino,
  rotulo,
  Icone,
  apoio,
  caminho,
  aoTocar,
}: {
  destino: DestinoDaBarra;
  rotulo: string;
  Icone: LucideIcon;
  apoio?: string | null;
  caminho: string;
  aoTocar: () => void;
}) {
  const marcado = estaMarcado(destino, caminho);
  const duasLinhas = apoio !== undefined;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={marcado}
        size={duasLinhas ? "lg" : "default"}
        className="text-interface/[17px] h-auto min-h-11 transition-[background-color,color,transform] duration-(--tempo-ponteiro) ease-(--curva-ponteiro) active:scale-[0.97]"
      >
        <Link href={destino} aria-current={marcado ? "page" : undefined} onClick={aoTocar}>
          <Icone aria-hidden="true" className={marcado ? "text-tinta" : "text-tinta-suave"} />
          <div className="grid min-w-0 flex-1">
            <span className="truncate">{rotulo}</span>
            {duasLinhas && apoio === null && (
              <span aria-hidden="true" className="text-meta font-normal">
                {" "}
              </span>
            )}
            {duasLinhas && apoio !== null && (
              <span className="text-tinta-suave text-meta truncate font-normal">{apoio}</span>
            )}
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
