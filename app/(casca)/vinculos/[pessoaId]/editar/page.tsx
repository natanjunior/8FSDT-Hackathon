import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, verVinculo } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CaminhoDaPagina } from "@/interface/componentes/caminho-da-pagina";
import { FormularioDeVinculo } from "@/interface/componentes/formulario-de-vinculo";
import { dataCurta, rotuloDoPapel } from "@/interface/componentes/frases-de-participantes";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

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
  const [vinculo, areas] = await Promise.all([
    verVinculo(escopo.repos.vinculos, pessoaId),
    listarAreas(escopo.repos.areas),
  ]);

  if (vinculo === null) notFound();

  return (
    <div className="flex flex-col gap-5.5">
      <CaminhoDaPagina anterior={{ rotulo: "Participantes", href: "/vinculos" }} atual={vinculo.pessoa.nome} />
      <CabecalhoDaPagina
        titulo="Editar participante"
        fato={
          <>
            {vinculo.pessoa.nome}, {rotuloDoPapel(vinculo.papel)} desde{" "}
            <span className="font-mono tabular-nums">{dataCurta(vinculo.criadoEm)}</span>.
          </>
        }
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
