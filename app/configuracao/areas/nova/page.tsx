import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { FormularioDeArea } from "@/interface/componentes/formulario-de-area";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-09 · criar área.**
 *
 * A `ordem` chega pré-preenchida com a última + 1 (spec §2.6) — o `default: 0` do contrato fica intocado
 * para quem chama a API direto.
 */
export const dynamic = "force-dynamic";

export default async function CriarArea() {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  const areas = await listarAreas(escopo.repos.areas, { incluirInativas: true });
  const maiorOrdem = areas.reduce((maior, a) => (a.ordem > maior ? a.ordem : maior), 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-12">
      <header className="flex flex-col gap-1">
        <Link href="/configuracao" className="text-marca text-sm underline underline-offset-4">
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

      <FormularioDeArea modo={{ tipo: "cadastro", proximaOrdem: Math.min(maiorOrdem + 1, 999) }} />
    </main>
  );
}

function SemAcesso() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-6 pt-10 pb-12">
      <h1 className="text-tinta text-xl font-semibold">Criar área</h1>
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
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao%2Fareas%2Fnova");
    throw erro;
  }
}
