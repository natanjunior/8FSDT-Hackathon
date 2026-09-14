import { redirect } from "next/navigation";

import { NaoAutenticado } from "@/aplicacao/contexto";
import { BarraSuperior } from "@/interface/componentes/casca/barra-superior";
import { resolverEscopoParaTela } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";

/**
 * **A moldura focada, e T-04 é a única tela que a usa.**
 *
 * A barra superior fica porque a organização ativa precisa estar visível: registrar na organização errada
 * é o erro que ela previne. A navegação lateral não fica, pela razão inversa — sair no meio de um registro
 * custa refazer o formulário, e o inventário já decide que voltar dele descarta com confirmação.
 */
export default async function LayoutFocado({ children }: { children: React.ReactNode }) {
  let escopo;
  try {
    escopo = await resolverEscopoParaTela("qualquer-vinculo-ativo");
  } catch (erro) {
    if (erro instanceof NaoAutenticado) redirect("/entrar");
    throw erro;
  }

  if (escopo.situacao === "sem-organizacao") redirect("/organizacao");
  if (escopo.situacao === "sem-permissao") redirect("/");

  const projetado = projetarContexto(escopo.resolucao);
  const organizacaoAtiva = projetado.organizacaoAtiva;
  if (organizacaoAtiva === null) redirect("/organizacao");

  return (
    <div className="min-h-dvh">
      <BarraSuperior
        vinculos={projetado.vinculos}
        organizacaoAtivaId={organizacaoAtiva.id}
        nomeDaPessoa={projetado.pessoa.nome}
      />
      <main className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
