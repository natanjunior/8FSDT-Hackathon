import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarCategorias } from "@/aplicacao/organizacao";
import { FormularioDeCategoria } from "@/interface/componentes/formulario-de-categoria";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-09 · corrigir categoria** — renomear, reordenar, desativar e reativar.
 *
 * **A categoria é procurada na lista escopada, não por um `GET /categorias/{id}` que não existe.** São ~7
 * a 15 linhas, e o contrato §7.7 já excluiu paginação para esta coleção — a lista é mais barata que um
 * endpoint novo, e mantém o `$1` como única porta.
 *
 * **`ehUltimaAtiva` sai da mesma lista** — não é uma consulta a mais, e é o que decide qual das duas
 * frases de confirmação a tela mostra.
 */
export const dynamic = "force-dynamic";

export default async function CorrigirCategoria({
  params,
}: {
  params: Promise<{ categoriaId: string }>;
}) {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  const { categoriaId } = await params;
  const categorias = await listarCategorias(escopo.repos.categorias, { incluirInativas: true });
  const categoria = categorias.find((c) => c.id === categoriaId);

  // Categoria de outra organização é **inalcançável** pelo repositório escopado, então cai aqui — a mesma
  // resposta de categoria inexistente, que é o que a §6.3 do contrato exige.
  if (categoria === undefined) notFound();

  const ativas = categorias.filter((c) => c.ativa).length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 pt-10 pb-12">
      <header className="flex flex-col gap-1">
        <Link href="/configuracao" className="text-marca text-sm underline underline-offset-4">
          Voltar
        </Link>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Corrigir categoria</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <FormularioDeCategoria
        modo={{
          tipo: "edicao",
          categoriaId: categoria.id,
          nome: categoria.nome,
          icone: categoria.icone,
          ordem: categoria.ordem,
          ativa: categoria.ativa,
          ehUltimaAtiva: categoria.ativa && ativas === 1,
        }}
      />
    </main>
  );
}

function SemAcesso() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-5 px-6 pt-10 pb-12">
      <h1 className="text-tinta text-xl font-semibold">Corrigir categoria</h1>
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
