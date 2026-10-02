import { atribuirEtiqueta } from "@/aplicacao/organizacao";
import { comContexto, resposta } from "@/interface/http";
import { projetarEtiqueta } from "@/interface/projecoes";
import { atribuicaoDeEtiquetaSchema } from "@/interface/schemas";

/**
 * **`POST /vinculos/{pessoaId}/etiquetas` — etiquetar um participante** (item 115, critérios 1 e 2).
 *
 * Cria a etiqueta se a grafia for nova, ou reaproveita a que já existe, e atribui. `201` quando a pessoa
 * ganhou a etiqueta agora; `200` quando já a tinha, sem reescrever quem atribuiu nem quando.
 */
export const POST = comContexto(
  { exige: "vinculo.gerir", corpo: atribuicaoDeEtiquetaSchema },
  async ({ repos, parametros, corpo, ctx }) => {
    const resultado = await atribuirEtiqueta(repos.etiquetas, {
      pessoaId: parametros["pessoaId"] ?? "",
      nome: corpo.nome,
      porPessoaId: ctx.pessoaId,
    });
    return resposta(
      { etiqueta: projetarEtiqueta(resultado.etiqueta), criada: resultado.criada },
      { status: resultado.jaTinha ? 200 : 201 },
    );
  },
);

export const dynamic = "force-dynamic";
