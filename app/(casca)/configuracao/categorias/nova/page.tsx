import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarCategorias } from "@/aplicacao/organizacao";
import { FormularioDeCategoria } from "@/interface/componentes/formulario-de-categoria";
import { resolverEscopoParaTela } from "@/interface/http";

/**
 * **T-09 · criar categoria** — o quadro 4 do protótipo, que desenha *"Nova categoria"* como tela própria.
 *
 * **A `ordem` chega pré-preenchida com a última + 1** (spec §2.6). O contrato declara `default: 0`, e o
 * padrão fica intocado para quem chama a API direto — mas uma categoria nova com `ordem = 0` apareceria
 * **antes** das sete sementes, que têm 1 a 7. A decisão é de tela, não de endpoint.
 *
 * A moldura é copiada de `app/(casca)/configuracao/categorias/page.tsx`, e não importada:
 * `resolverOuMandarParaPorta` é função local lá. É a mesma escolha que `app/vinculos/nova/page.tsx`
 * registrou.
 */
export const dynamic = "force-dynamic";

export default async function CriarCategoria() {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") return <SemAcesso />;

  const categorias = await listarCategorias(escopo.repos.categorias, { incluirInativas: true });
  const maiorOrdem = categorias.reduce((maior, c) => (c.ordem > maior ? c.ordem : maior), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/configuracao/categorias" className="text-marca text-sm underline underline-offset-4">
          Voltar
        </Link>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Criar categoria</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <p className="text-tinta-suave text-sm leading-relaxed">
        A categoria diz qual é a natureza da ocorrência, e é o que o dashboard usa para contar
        recorrência. Dois nomes iguais não são aceitos nesta organização.
      </p>

      <FormularioDeCategoria
        modo={{ tipo: "cadastro", proximaOrdem: Math.min(maiorOrdem + 1, 999) }}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
      />
    </div>
  );
}

function SemAcesso() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-tinta text-xl font-semibold">Criar categoria</h1>
      <p role="alert" className="text-tinta-suave text-sm">
        Seu papel nesta organização não dá acesso a esta página.
      </p>
      <Link href="/ocorrencias" className="text-marca text-sm underline underline-offset-4">
        Voltar
      </Link>
    </div>
  );
}

async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("organizacao.configurar");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fconfiguracao%2Fcategorias%2Fnova");
    throw erro;
  }
}
