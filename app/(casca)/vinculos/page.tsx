import { UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  listarAreas,
  listarImpedimentosDeRemocao,
  listarPedidosDeEntrada,
  listarResponsabilidadesEmAberto,
  listarVinculos,
} from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import type { ImpedimentoNaTela } from "@/interface/componentes/frases-da-remocao";
import {
  SEM_PEDIDOS,
  palavraDeParticipantes,
  palavraDePedidos,
} from "@/interface/componentes/frases-de-participantes";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { TabelaDeParticipantes } from "@/interface/componentes/tabela-de-participantes";
import { buttonVariants } from "@/interface/componentes/ui/button";
import { cn } from "@/interface/componentes/utilitarios";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea, projetarPedidoDeEntradaDetalhe, projetarVinculo } from "@/interface/projecoes";

/**
 * **T-08 · Participantes** — *"Quem está aqui, e quem quer entrar?"*
 *
 * **Uma tabela só** (item 44j): os pedidos pendentes são a parte acionável da lista de gente, e separá-los
 * produzia uma seção cuja resposta é *"nenhum pedido"* na maior parte das semanas.
 *
 * **A página lê e não decide.** As cinco leituras vão juntas, pela estrada direta (contrato §5); filtro,
 * ordem, busca e página são do navegador, porque `GET /vinculos` devolve a lista inteira. **Ela não lê o
 * endereço**: quem o lê é a tabela, que também o escreve.
 *
 * **O nome da tela é Participantes** desde 17/09/2026 (item 48, achado V-09): o título e o rótulo da
 * barra lateral passaram a ser o mesmo nome.
 *
 * **Alvo primário: tela grande.** É trabalho de escritório, feito uma vez por semana — o RNF6 cronometra
 * T-04, não esta.
 */
export const dynamic = "force-dynamic";

export default async function Participantes() {
  const escopo = await resolverOuMandarParaPorta();

  // O mapa de navegação do inventário (§3): sem organização ativa, T-02.
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");

  // Não acontece pela navegação: o item de menu só existe com a permissão. Acontece por link recebido.
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Participantes" permissao="vinculo.gerir" />;
  }

  const [pedidos, areas, vinculos, mapaDeImpedimentos, mapaDeResponsabilidades] = await Promise.all([
    listarPedidosDeEntrada(escopo.repos.pedidosDeEntrada, {}),
    listarAreas(escopo.repos.areas),
    listarVinculos(escopo.repos.vinculos),
    listarImpedimentosDeRemocao(escopo.repos.vinculos),
    listarResponsabilidadesEmAberto(escopo.repos.vinculos),
  ]);

  // **`Map` → objeto simples na fronteira Server/Client.** O `Map` é a forma certa dentro do servidor —
  // `O(1)` por linha —, e um objeto é o que atravessa sem depender de capacidade de serialização que
  // nenhuma outra propriedade deste repositório exercita.
  const impedimentos = Object.fromEntries(mapaDeImpedimentos) as Readonly<
    Record<string, ImpedimentoNaTela>
  >;
  const responsabilidades = Object.fromEntries(mapaDeResponsabilidades) as Readonly<Record<string, number>>;

  return (
    <div className="flex flex-col gap-5.5">
      <CabecalhoDaPagina
        titulo="Participantes"
        fato={<Fato participantes={vinculos.length} pedidos={pedidos.length} />}
        acao={
          <Link
            href="/vinculos/nova"
            className={cn(
              buttonVariants({ variant: "marca" }),
              "text-interface min-h-11 rounded-sm px-4 font-semibold has-[>svg]:px-4",
            )}
          >
            <UserPlus aria-hidden="true" />
            Cadastrar pessoa sem conta
          </Link>
        }
      />

      <TabelaDeParticipantes
        pedidos={pedidos.map(projetarPedidoDeEntradaDetalhe)}
        vinculos={vinculos.map(projetarVinculo)}
        impedimentos={impedimentos}
        responsabilidades={responsabilidades}
        areas={areas.map(projetarArea)}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
        euPessoaId={escopo.ctx.pessoaId}
      />
    </div>
  );
}

/**
 * O fato do cabeçalho, com os números em mono tabular. **Na tinta do texto**, e não na cor da marca como
 * a prancheta desenha o dos pedidos: o guia §2 reserva a cor para a ação principal, e o critério 2 abre
 * exceção só para a contagem do filtro. As palavras são as de `fraseDoFato`, que tem teste.
 */
function Fato({ participantes, pedidos }: { participantes: number; pedidos: number }) {
  const numero = (valor: number) => <span className="font-mono tabular-nums">{valor}</span>;
  if (pedidos === 0) {
    return (
      <>
        {numero(participantes)} {palavraDeParticipantes(participantes)}. {SEM_PEDIDOS}
      </>
    );
  }
  return (
    <>
      {numero(participantes)} {palavraDeParticipantes(participantes)} e {numero(pedidos)}{" "}
      {palavraDePedidos(pedidos)}.
    </>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("vinculo.gerir");
  } catch (erro) {
    // Regra do shell: sem sessão vai para T-01, guardando o destino pretendido (inventário §3).
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fvinculos");
    throw erro;
  }
}
