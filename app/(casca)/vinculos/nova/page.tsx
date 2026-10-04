import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { listarAreas } from "@/aplicacao/organizacao";
import { CabecalhoDaPagina } from "@/interface/componentes/cabecalho-da-pagina";
import { CaminhoDaPagina } from "@/interface/componentes/caminho-da-pagina";
import { FormularioDeVinculo } from "@/interface/componentes/formulario-de-vinculo";
import { SemAcesso } from "@/interface/componentes/sem-acesso";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";

/**
 * **T-08 · cadastrar participante.**
 *
 * A resolução do escopo é a de `app/(casca)/vinculos/page.tsx`, copiada e não importada:
 * `resolverOuMandarParaPorta` é função local lá, e o `destino` da volta muda por página. **O estado sem
 * acesso é o `SemAcesso` da casca desde o item 44h**, e deixou de ser uma das cópias.
 *
 * O caminho no topo e o rodapé preso ao fim do conteúdo são a forma que o guia §7 deu à página própria
 * (item 44j).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cadastrar participante" };

export default async function CadastrarParticipante() {
  const escopo = await resolverOuMandarParaPorta();
  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") {
    return <SemAcesso titulo="Cadastrar participante" permissao="vinculo.gerir" />;
  }

  const areas = await listarAreas(escopo.repos.areas);

  return (
    <div className="flex flex-col gap-5.5">
      <CaminhoDaPagina anterior={{ rotulo: "Participantes", href: "/vinculos" }} atual="Cadastrar participante" />
      <CabecalhoDaPagina
        titulo="Cadastrar participante"
        fato="Para quem participa da organização e ainda não usa o aplicativo, como o zelador, o eletricista terceirizado ou um morador sem conta."
      />
      <FormularioDeVinculo
        modo={{ tipo: "cadastro" }}
        areas={areas.map(projetarArea)}
        organizacaoId={escopo.ctx.vinculo.organizacaoId}
      />
    </div>
  );
}

/** Local, como em `app/(casca)/vinculos/page.tsx`. **O `destino` é o desta página**, não `/vinculos`. */
async function resolverOuMandarParaPorta() {
  try {
    return await resolverEscopoParaTela("vinculo.gerir");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar?destino=%2Fvinculos%2Fnova");
    throw erro;
  }
}
