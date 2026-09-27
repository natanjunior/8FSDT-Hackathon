import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { ExibicaoDeCodigo } from "@/interface/componentes/campo-de-codigo";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { LinkDoConvite } from "@/interface/componentes/link-do-convite";
import { QrDoLink } from "@/interface/componentes/qr";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { montarLinkDoConvite, resolverEscopoParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **Convidar pessoas** — o link e o QR da organização ativa (item 86).
 *
 * **A recusa é do servidor** (critério 86.1): quem não gere vínculos não vê o item no menu e, digitando o
 * endereço, recebe o `SemAcesso` da casca, sem link nem QR. É a permissão de Participantes, porque quem
 * aprova o pedido é quem gere vínculos.
 *
 * **A ordem é a de quem abre para mandar:** o link com *Copiar*, depois o QR, que é a segunda forma de
 * mandar a mesma coisa, e por último o código, que já tem casa em T-15.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Convidar pessoas" };

export default async function ConvidarPessoas() {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Convidar pessoas" permissao="vinculo.gerir" />;
  }

  const organizacao = projetarContexto(escopo.resolucao).organizacaoAtiva;
  if (organizacao === null) redirect("/organizacao");

  const link = await montarLinkDoConvite(organizacao.codigoPublico);

  return (
    <div className="flex flex-col gap-5.5">
      <CabecalhoDaPagina
        titulo="Convidar pessoas"
        fato={`O link e o QR levam ao pedido de entrada em ${organizacao.nome}.`}
      />

      <Cartao tituloId="link">
        <CabecaDoCartao id="link" titulo="Link do convite" apoio="Mande por mensagem ou cole no grupo." />
        <div className="p-[15px] md:px-6 md:py-5">
          <LinkDoConvite link={link} />
        </div>
      </Cartao>

      <Cartao tituloId="qr">
        <CabecaDoCartao id="qr" titulo="QR do convite" apoio="Para o cartaz da portaria ou do elevador." />
        <div className="p-[15px] md:px-6 md:py-5">
          <QrDoLink link={link} rotulo={`QR do link de convite para ${organizacao.nome}`} />
        </div>
      </Cartao>

      <Cartao tituloId="codigo">
        <CabecaDoCartao id="codigo" titulo="Código da organização" apoio="Quem preferir pode digitá-lo." />
        <div className="p-[15px] md:px-6 md:py-5">
          <ExibicaoDeCodigo codigo={organizacao.codigoPublico} rotulo="Código da organização" />
        </div>
      </Cartao>
    </div>
  );
}

/** Local, como em `app/(casca)/vinculos/nova/page.tsx`. O `destino` é o desta página. */
async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("vinculo.gerir");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconvidar");
    throw erro;
  }
}
