import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { FormularioDeArea } from "@/interface/componentes/formulario-de-area";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-09 · corrigir área** — renomear, reclassificar, reordenar, desativar e reativar.
 *
 * **A área é procurada na lista escopada**, pela mesma razão da categoria: não existe
 * `GET /areas/{id}`, são ~30 linhas, e a lista mantém o `$1` como única porta. Área de outra organização
 * é **inalcançável** e cai no mesmo `notFound()` da inexistente (contrato §6.3).
 */
export const dynamic = "force-dynamic";

export default async function CorrigirArea({ params }: { params: Promise<{ areaId: string }> }) {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  const { areaId } = await params;
  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const area = areas.find((a) => a.id === areaId);

  if (area === undefined) notFound();

  const ativas = areas.filter((a) => a.ativa).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-12">
      <header className="flex flex-col gap-1">
        <Link href="/configuracao" className="text-marca text-sm underline underline-offset-4">
          Voltar
        </Link>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Corrigir área</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <FormularioDeArea
        modo={{
          tipo: "edicao",
          areaId: area.id,
          nome: area.nome,
          tipoAtual: area.tipo,
          ordem: area.ordem,
          ativa: area.ativa,
          ehUltimaAtiva: area.ativa && ativas === 1,
        }}
      />
    </main>
  );
}

function SemAcesso() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-6 pt-10 pb-12">
      <h1 className="text-tinta text-xl font-semibold">Corrigir área</h1>
      <p role="alert" className="text-tinta-suave text-sm">
        Seu papel nesta organização não dá acesso a esta página.
      </p>
      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </main>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao");
    throw erro;
  }
}
