import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { FormularioDeArea } from "@/interface/componentes/formulario-de-area";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-14 · criar área.**
 *
 * A `ordem` chega pré-preenchida com a última + 1 (spec §2.6) — o `default: 0` do contrato fica intocado
 * para quem chama a API direto.
 */
export const dynamic = "force-dynamic";

export default async function CriarArea() {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Criar área" permissao="organizacao.configurar" />;
  }

  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const maiorOrdem = areas.reduce((maior, a) => (a.ordem > maior ? a.ordem : maior), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/configuracao/areas" className="text-marca text-sm underline underline-offset-4">
          Voltar
        </Link>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Criar área</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <p className="text-tinta-suave text-sm leading-relaxed">
        A área diz <strong className="text-tinta font-semibold">onde</strong> a ocorrência aconteceu, e o
        tipo dela decide quem enxerga o que for registrado ali. Dois nomes iguais não são aceitos nesta
        organização.
      </p>

      <FormularioDeArea
        modo={{ tipo: "cadastro", proximaOrdem: Math.min(maiorOrdem + 1, 999) }}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
      />
    </div>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao%2Fareas%2Fnova");
    throw erro;
  }
}
