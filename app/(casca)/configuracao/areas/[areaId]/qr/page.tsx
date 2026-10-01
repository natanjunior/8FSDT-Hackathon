import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CabecaDoCartao, Cartao } from "@/interface/componentes/cartao";
import { CLASSE_DO_CAMINHO } from "@/interface/componentes/moldura-de-conta";
import { QrDoLink } from "@/interface/componentes/qr";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { montarLinkDoQrDaArea, resolverEscopoParaTela } from "@/interface/http";

/**
 * **O QR de uma área** (item 111) — *"Como eu ponho o registro na parede?"*
 *
 * **Página, e não modal na tabela.** O QR é desenhado no servidor (ADR-0019, sem JavaScript de cliente), e
 * a tabela de áreas é componente de cliente. Um modal mandaria o `uqr` ao navegador ou desenharia todos os
 * QRs da organização na lista.
 *
 * **A área é lida pela porta escopada**, entre todas: id que não está na organização ativa é a 404 do
 * produto. Área desativada também tem QR, porque a etiqueta pode já estar na parede.
 *
 * **O link leva o código da organização**, e a etiqueta passa a ser também o cartaz do convite. Pela D25
 * isso não abre acesso: quem não participa chega a um pedido de entrada.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "QR da área" };

export default async function QrDaArea({ params }: { params: Promise<{ areaId: string }> }) {
  const { areaId } = await params;
  const escopo = await resolverOuMandarParaPorta(areaId);

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="QR da área" permissao="organizacao.configurar" />;
  }

  // O `null` é inalcançável com `situacao: "pronto"`, como em T-04; o tipo não sabe disso.
  const ativo = escopo.resolucao.ativo;
  if (ativo === null) redirect("/organizacao");

  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const area = areas.find((a) => a.id === areaId.toLowerCase());
  if (area === undefined) notFound();

  const organizacao = ativo.organizacao;
  const link = await montarLinkDoQrDaArea(organizacao.codigoPublico, area.id);

  return (
    <div className="flex flex-col gap-5.5">
      <CabecalhoDaPagina titulo={area.nome} fato={`Em ${organizacao.nome}.`} />

      <Cartao tituloId="qr">
        <CabecaDoCartao
          id="qr"
          titulo="QR da área"
          apoio="Cole no próprio lugar. Quem participa registra com a área já escolhida; quem não participa pede para entrar."
        />
        <div className="flex flex-col gap-3 p-[15px] md:px-6 md:py-5">
          <QrDoLink link={link} rotulo={`QR da área ${area.nome} em ${organizacao.nome}`} />
          {!area.ativa && (
            <p className="text-tinta-suave text-interface">
              Esta área está desativada. Quem ler o QR vai escolher outra.
            </p>
          )}
        </div>
      </Cartao>

      <Link href="/configuracao/areas" className={`${CLASSE_DO_CAMINHO} self-start`}>
        Voltar para Áreas
      </Link>
    </div>
  );
}

async function resolverOuMandarParaPorta(areaId: string) {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) {
      redirect(`/entrar?destino=${encodeURIComponent(`/configuracao/areas/${areaId}/qr`)}`);
    }
    throw erro;
  }
}
