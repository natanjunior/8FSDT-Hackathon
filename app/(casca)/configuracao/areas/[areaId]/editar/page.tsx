import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { FormularioDeArea } from "@/interface/componentes/formulario-de-area";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-14 · corrigir área** — renomear, reclassificar, reordenar, desativar e reativar.
 *
 * **A área é procurada na lista escopada**, pela mesma razão da categoria: não existe
 * `GET /areas/{id}`, são ~30 linhas, e a lista mantém o `$1` como única porta. Área de outra organização
 * é **inalcançável** e cai no mesmo `notFound()` da inexistente (contrato §6.3).
 */
export const dynamic = "force-dynamic";

export default async function CorrigirArea({ params }: { params: Promise<{ areaId: string }> }) {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Corrigir área" permissao="organizacao.configurar" />;
  }

  const { areaId } = await params;
  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const area = areas.find((a) => a.id === areaId);

  if (area === undefined) notFound();

  const ativas = areas.filter((a) => a.ativa).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/configuracao/areas" className="text-marca text-sm underline underline-offset-4">
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
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
      />
    </div>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao%2Fareas");
    throw erro;
  }
}
