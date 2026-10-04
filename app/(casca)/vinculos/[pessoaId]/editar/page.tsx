import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Fragment } from "react";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, listarEtiquetas, situacaoDoConvitePorEmail, verVinculo } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CaminhoDaPagina } from "@/interface/componentes/caminho-da-pagina";
import { CartaoDeEtiquetas } from "@/interface/componentes/cartao-de-etiquetas";
import { ConvidarParticipante } from "@/interface/componentes/convidar-participante";
import { TEXTOS_DO_CONVITE_PESSOAL, conviteNoDetalhe } from "@/interface/componentes/convite-pessoal";
import { FormularioDeVinculo } from "@/interface/componentes/formulario-de-vinculo";
import { fatoDeEdicao, rotuloDoPapel } from "@/interface/componentes/frases-de-participantes";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea, projetarEtiqueta, projetarSituacaoDoEmail } from "@/interface/projecoes";

/**
 * **T-08 · editar participante.**
 *
 * A resolução do escopo é a de `app/(casca)/vinculos/page.tsx`, copiada e não importada, pela mesma razão
 * da página de cadastro. O estado sem acesso é o `SemAcesso` da casca.
 *
 * O caminho no topo e o rodapé preso ao fim do conteúdo são a forma que o guia §7 deu à página própria
 * (item 44j).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Editar participante" };

export default async function EditarParticipante({
  params,
}: {
  params: Promise<{ pessoaId: string }>;
}) {
  // `params` vem antes do escopo: o ajudante precisa do `pessoaId` para montar o `destino` da volta.
  const { pessoaId } = await params;

  const escopo = await resolverOuMandarParaPorta(pessoaId);
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Editar participante" permissao="vinculo.gerir" />;
  }

  // Leitura pela estrada direta (contrato §5) — **sem salto HTTP, e pela camada de Aplicação**, como
  // toda outra página. Com o repositório já escopado, um vínculo de outra organização é **inalcançável**,
  // e por isso o `notFound()` daqui é o mesmo `404` da §6.3.
  const [vinculo, areas, todasAsEtiquetas] = await Promise.all([
    verVinculo(escopo.repos.vinculos, pessoaId),
    listarAreas(escopo.repos.areas),
    listarEtiquetas(escopo.repos.etiquetas),
  ]);

  if (vinculo === null) notFound();

  // **O convite pessoal** (item 121): o botão só para Solicitante ou Gestor sem conta; nos outros dois
  // casos, uma frase com o porquê. Texto, e não botão desabilitado, que não recebe foco nem é lido.
  const convite = conviteNoDetalhe(vinculo);
  // A situação do e-mail (item 122) depende do vínculo, então é uma leitura a mais depois dele, e só quando o
  // convite cabe.
  const situacaoDoEmail =
    convite === "botao" ? projetarSituacaoDoEmail(await situacaoDoConvitePorEmail(escopo.repos, vinculo)) : null;
  const acaoDoConvite =
    convite === "botao" && situacaoDoEmail !== null ? (
      <ConvidarParticipante
        pessoaId={pessoaId}
        nome={vinculo.pessoa.nome}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
        organizacao={escopo.resolucao.ativo?.organizacao.nome ?? ""}
        papel={rotuloDoPapel(vinculo.papel)}
        situacaoDoEmail={situacaoDoEmail}
      />
    ) : (
      <p className="text-interface text-tinta-suave">
        {convite === "encarregado"
          ? TEXTOS_DO_CONVITE_PESSOAL.semConviteEncarregado
          : TEXTOS_DO_CONVITE_PESSOAL.semConviteComConta}
      </p>
    );

  return (
    <div className="flex flex-col gap-5.5">
      <CaminhoDaPagina anterior={{ rotulo: "Participantes", href: "/vinculos" }} atual={vinculo.pessoa.nome} />
      <CabecalhoDaPagina
        titulo="Editar participante"
        acao={acaoDoConvite}
        fato={fatoDeEdicao(
          vinculo.pessoa.nome,
          vinculo.papel,
          vinculo.criadoEm,
          vinculo.atualizadoEm,
        ).map((segmento) =>
          segmento.mono ? (
            <span key={segmento.chave} className="font-mono tabular-nums">
              {segmento.texto}
            </span>
          ) : (
            <Fragment key={segmento.chave}>{segmento.texto}</Fragment>
          ),
        )}
      />
      <FormularioDeVinculo
        modo={{
          tipo: "correcao",
          pessoaId,
          nome: vinculo.pessoa.nome,
          papel: vinculo.papel,
          temConta: vinculo.temConta,
          areaIdAtual: vinculo.area?.id ?? null,
          contatosAtuais: vinculo.pessoa.contatos,
        }}
        areas={areas.map(projetarArea)}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
        depoisDosContatos={
          // **Depois de Contatos, fora do formulário** (item 120, critério 8): o cartão grava a cada gesto.
          <CartaoDeEtiquetas
            pessoaId={pessoaId}
            nome={vinculo.pessoa.nome}
            organizacaoId={escopo.ctx.vinculo.organizacaoId}
            daPessoa={vinculo.etiquetas.map(projetarEtiqueta)}
            todas={todasAsEtiquetas.map(projetarEtiqueta)}
          />
        }
      />
    </div>
  );
}

/**
 * Local, como em `app/(casca)/vinculos/page.tsx`. **O `destino` carrega o `pessoaId`** — quem foi para
 * T-01 no meio de uma edição volta para a edição daquela pessoa, não para a lista.
 */
async function resolverOuMandarParaPorta(pessoaId: string) {
  try {
    return await resolverEscopoParaTela("vinculo.gerir");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) {
      redirect(`/entrar?destino=${encodeURIComponent(`/vinculos/${pessoaId}/editar`)}`);
    }
    throw erro;
  }
}
