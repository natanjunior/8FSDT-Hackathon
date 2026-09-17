import Link from "next/link";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { FormularioDeVinculo } from "@/interface/componentes/formulario-de-vinculo";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

/**
 * **T-08 · cadastrar pessoa sem conta.**
 *
 * A resolução do escopo é a de `app/(casca)/vinculos/page.tsx`, copiada e não importada:
 * `resolverOuMandarParaPorta` é função local lá, e o `destino` da volta muda por página. **O estado sem
 * acesso é o `SemAcesso` da casca desde o item 44h**, e deixou de ser uma das cópias.
 */
export const dynamic = "force-dynamic";

export default async function CadastrarPessoaSemConta() {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Cadastrar pessoa sem conta" permissao="vinculo.gerir" />;
  }

  const areas = await listarAreas(escopo.repos.areas);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/vinculos" className="text-marca text-sm underline underline-offset-4">
          Voltar
        </Link>
        <h1 className="text-tinta text-xl leading-snug font-semibold">Cadastrar pessoa sem conta</h1>
        <p className="text-tinta-suave text-sm">{escopo.resolucao.ativo?.organizacao.nome}</p>
      </header>

      <p className="text-tinta-suave text-sm leading-relaxed">
        Este cadastro cria a pessoa e o vínculo de uma vez. Quem entra por aqui não tem conta: existe como
        cadastro, recebe atribuições e aparece como responsável, e para agir no sistema seria preciso ter
        conta. É o zelador que não usa o aplicativo — e o Gestor age em nome dele.
      </p>

      <FormularioDeVinculo
        modo={{ tipo: "cadastro" }}
        areas={areas.map(projetarArea)}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
      />
    </div>
  );
}

/** Local, como em `app/vinculos/page.tsx`. **O `destino` é o desta página**, não `/vinculos`. */
async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("vinculo.gerir");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fvinculos%2Fnova");
    throw erro;
  }
}
