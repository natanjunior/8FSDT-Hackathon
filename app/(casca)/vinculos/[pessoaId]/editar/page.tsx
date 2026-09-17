import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, verVinculo } from "@/aplicacao/organizacao";
import { FormularioDeVinculo } from "@/interface/componentes/formulario-de-vinculo";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

/**
 * **T-08 · corrigir os dados de um vínculo.**
 *
 * A resolução do escopo é a de `app/(casca)/vinculos/page.tsx`, copiada e não importada, pela mesma razão
 * da página de cadastro. O estado sem acesso é o `SemAcesso` da casca.
 */
export const dynamic = "force-dynamic";

export default async function CorrigirVinculo({
  params,
}: {
  params: Promise<{ pessoaId: string }>;
}) {
  // `params` vem antes do escopo: o ajudante precisa do `pessoaId` para montar o `destino` da volta.
  const { pessoaId } = await params;

  const escopo = await resolverOuMandarParaPorta(pessoaId);
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Corrigir os dados" permissao="vinculo.gerir" />;
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/vinculos" className="text-marca text-sm underline underline-offset-4">
          Voltar
        </Link>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Corrigir os dados</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <p className="text-tinta-suave text-sm leading-relaxed">
        Não há como trocar o papel de alguém. O único conserto de papel errado é remover o vínculo e pedir
        entrada de novo.
      </p>

      <FormularioDeVinculo
        modo={{
          tipo: "correcao",
          pessoaId,
          nome: vinculo.pessoa.nome,
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
 * Local, como em `app/vinculos/page.tsx`. **O `destino` carrega o `pessoaId`** — quem foi para T-01 no
 * meio de uma correção volta para a correção daquela pessoa, não para a lista.
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
