import { criarArea, listarAreas } from "@/aplicacao/organizacao";
import { comContexto, lerBooleanoDaUrl, resposta } from "@/interface/http";
import { projetarArea } from "@/interface/projecoes";
import { criacaoDeAreaSchema } from "@/interface/schemas";

/**
 * `GET /areas` — a lista de onde a ocorrência acontece, com o **tipo** de cada uma.
 *
 * Mesmo regime do `GET /categorias`: `qualquer-vinculo-ativo`, porque T-04 a consome. **Sem paginação** —
 * são ~30 linhas, e o contrato §7.7 já a excluiu para as coleções de configuração.
 */
export const GET = comContexto({ exige: "qualquer-vinculo-ativo" }, async ({ repos, requisicao }) => {
  const ativa = lerBooleanoDaUrl(requisicao, "ativa");
  const itens = await listarAreas(repos.areas, { incluirInativas: ativa === false });
  return { itens: itens.map(projetarArea) };
});

/**
 * **`POST /areas` — criar área.**
 *
 * **`tipo` é obrigatório e não tem padrão**, e a recusa vem do schema: *"um padrão implícito escolheria a
 * visibilidade das ocorrências em silêncio — que é exatamente o que a D10 recusa"*.
 */
export const POST = comContexto(
  { exige: "organizacao.configurar", corpo: criacaoDeAreaSchema },
  async ({ ctx, repos, corpo }) => {
    const area = await criarArea(repos.areas, {
      nome: corpo.nome,
      tipo: corpo.tipo,
      porPessoaId: ctx.pessoaId,
    });
    return resposta(projetarArea(area), { status: 201 });
  },
);

export const dynamic = "force-dynamic";
