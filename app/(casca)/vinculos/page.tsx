import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import {
  listarAreas,
  listarImpedimentosDeRemocao,
  listarPedidosDeEntrada,
  listarVinculos,
} from "@/aplicacao/organizacao";
import { DecisaoDePedidoDeEntrada } from "@/interface/componentes/decisao-de-pedido-de-entrada";
import type { ImpedimentoNaTela } from "@/interface/componentes/frases-da-remocao";
import { ListaDeVinculos } from "@/interface/componentes/lista-de-vinculos";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea, projetarPedidoDeEntradaDetalhe, projetarVinculo } from "@/interface/projecoes";

/**
 * **T-08 · Quem está na organização** — *"Quem está aqui, e quem quer entrar?"*
 *
 * **Meia tela, e a metade que este item possui.** O inventário desenha duas listas — os pedidos e os
 * vínculos ativos —, e a segunda é `GET /vinculos`, que é o item 9a. Os pedidos vêm primeiro porque são
 * **o que exige ação**, e é essa metade que sobe aqui.
 *
 * **Leitura pela estrada direta** (contrato §5), com o ajudante escopado: `app/` não pode montar
 * repositório, e um `fetch` interno custaria o salto HTTP que a §5 recusou.
 *
 * **Alvo primário: tela grande.** É trabalho de escritório, feito uma vez por semana — o RNF6 cronometra
 * T-04, não esta.
 */
export const dynamic = "force-dynamic";

export default async function QuemEstaNaOrganizacao({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const escopo = await resolverOuMandarParaPorta();

  // O mapa de navegação do inventário (§3): sem organização ativa, T-02.
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");

  // Não acontece pela navegação: o item de menu só existe com a permissão. Acontece por link recebido.
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Quem está na organização" permissao="vinculo.gerir" />;
  }

  const [pedidos, areas, vinculos, mapaDeImpedimentos] = await Promise.all([
    listarPedidosDeEntrada(escopo.repos.pedidosDeEntrada, {}),
    listarAreas(escopo.repos.areas),
    listarVinculos(escopo.repos.vinculos),
    listarImpedimentosDeRemocao(escopo.repos.vinculos),
  ]);

  // **`Map` → objeto simples na fronteira Server/Client.** O `Map` é a forma certa dentro do servidor —
  // `O(1)` por linha na renderização —, e um objeto é o que atravessa sem depender de capacidade de
  // serialização que nenhuma outra propriedade deste repositório exercita.
  const impedimentos = Object.fromEntries(mapaDeImpedimentos) as Readonly<
    Record<string, ImpedimentoNaTela>
  >;

  const parametros = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-marca text-sm font-semibold tracking-wide uppercase">Resolve Aí</p>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Quem está na organização</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <FaixaDoDesfecho parametros={parametros} />

      <section className="flex flex-col gap-4">
        <h2 className="text-tinta text-sm font-semibold tracking-wide uppercase">
          Pedidos de entrada ({pedidos.length})
        </h2>

        {pedidos.length === 0 ? (
          /* **O caso normal, e a frase precisa soar como isso** — sem moldura de alerta. */
          <p className="text-tinta-suave text-sm leading-relaxed">
            Nenhum pedido aguardando. Os pedidos aparecem aqui quando alguém digita o código da
            organização — e, na maior parte das semanas, não há nenhum.
          </p>
        ) : (
          pedidos.map((pedido) => (
            <DecisaoDePedidoDeEntrada
              key={pedido.id}
              pedido={projetarPedidoDeEntradaDetalhe(pedido)}
              areas={areas.map(projetarArea)}
              organizacaoId={escopo.ctx.vinculo.organizacaoId}
            />
          ))
        )}
      </section>

      <ListaDeVinculos
        vinculos={vinculos.map(projetarVinculo)}
        impedimentos={impedimentos}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
        euPessoaId={escopo.ctx.pessoaId}
      />

      <Link
        href="/vinculos/nova"
        className="border-linha text-tinta inline-flex min-h-11 w-fit items-center rounded-md border px-4 text-sm font-medium"
      >
        Cadastrar pessoa sem conta
      </Link>

      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </div>
  );
}

/**
 * A faixa de desfecho (spec §2.6). **Vem da URL e não do estado do componente** porque a decisão recarrega
 * a página: o que aconteceu tem de sobreviver ao recarregamento, ou a ação irreversível é comunicada por
 * ausência — que é o que a tela do PA-25 existe para não fazer.
 */
function FaixaDoDesfecho({ parametros }: { parametros: Record<string, string | string[] | undefined> }) {
  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" ? valor : "";
  };

  const cadastrado = texto("cadastrado");
  if (cadastrado !== "") {
    return (
      <p
        role="status"
        className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
      >
        {cadastrado} foi cadastrada como {rotuloDoPapel(texto("papel"))}. Ela existe como cadastro e
        recebe atribuições; para agir no sistema seria preciso ter conta.
      </p>
    );
  }

  const corrigido = texto("corrigido");
  if (corrigido !== "") {
    return (
      <p
        role="status"
        className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
      >
        Os dados de {corrigido} foram corrigidos.
      </p>
    );
  }

  const removido = texto("removido");
  if (removido !== "") {
    return (
      <p
        role="status"
        className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
      >
        O vínculo de {removido} foi removido. O cadastro da pessoa não é apagado.
      </p>
    );
  }

  const decidido = texto("decidido");
  if (decidido !== "aprovado" && decidido !== "recusado") return null;

  const quem = texto("quem");
  const unidade = texto("unidade");
  const papel = rotuloDoPapel(texto("papel"));

  return (
    <p
      role="status"
      className="border-linha bg-superficie text-tinta rounded-md border px-3 py-2.5 text-sm"
    >
      {decidido === "aprovado"
        ? `${quem} entrou como ${papel}${unidade === "" ? ", sem unidade registrada" : `, no ${unidade}`}.`
        : `O pedido de ${quem} foi recusado. Ela pode pedir entrada de novo.`}
    </p>
  );
}

function rotuloDoPapel(papel: string): string {
  if (papel === "gestor") return "Gestor";
  if (papel === "encarregado") return "Encarregado";
  return "Solicitante";
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
