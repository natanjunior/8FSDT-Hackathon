import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas, verVinculo } from "@/aplicacao/organizacao";
import { FormularioDeVinculo } from "@/interface/componentes/formulario-de-vinculo";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

/**
 * **T-08 · corrigir os dados de um vínculo.**
 *
 * A moldura é a de `app/vinculos/page.tsx`, copiada e não importada — mesma razão da página de cadastro.
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
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  // Leitura pela estrada direta (contrato §5) — **sem salto HTTP, e pela camada de Aplicação**, como
  // toda outra página. Com o repositório já escopado, um vínculo de outra organização é **inalcançável**,
  // e por isso o `notFound()` daqui é o mesmo `404` da §6.3.
  const [vinculo, areas] = await Promise.all([
    verVinculo(escopo.repos.vinculos, pessoaId),
    listarAreas(escopo.repos.areas),
  ]);

  if (vinculo === null) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-12">
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
      />
    </main>
  );
}

/** O ramo em linha de `app/vinculos/page.tsx`, com o título desta página. */
function SemAcesso() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-6 pt-10 pb-12">
      <h1 className="text-tinta text-xl font-semibold">Corrigir os dados</h1>
      <p role="alert" className="text-tinta-suave text-sm">
        Seu papel nesta organização não dá acesso a esta página.
      </p>
      <Link href="/" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </main>
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
