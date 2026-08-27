import { criarCategoria, listarCategorias } from "@/aplicacao/organizacao";
import { comContexto, lerBooleanoDaUrl, resposta } from "@/interface/http";
import { projetarCategoria } from "@/interface/projecoes";
import { criacaoDeCategoriaSchema } from "@/interface/schemas";

/**
 * `GET /categorias` — *"a leitura que precede o registro de ocorrência, e é onde se confirma que a semente
 * das sete categorias do desafio foi criada junto com a organização (POL-01)"* (`openapi.yaml`).
 *
 * **`qualquer-vinculo-ativo`, e não `organizacao.configurar`:** T-04 consome esta lista, e quem registra
 * ocorrência é o Solicitante. É um dos dois casos em que o contrato diz literalmente *"qualquer vínculo
 * ativo"* (§8.1).
 *
 * **O `PATCH` mora em `[categoriaId]/route.ts`** — um recurso por arquivo, como o App Router pede.
 */
export const GET = comContexto({ exige: "qualquer-vinculo-ativo" }, async ({ repos, requisicao }) => {
  const ativa = lerBooleanoDaUrl(requisicao, "ativa");
  const itens = await listarCategorias(repos.categorias, { incluirInativas: ativa === false });
  return { itens: itens.map(projetarCategoria) };
});

/**
 * **`POST /categorias` — criar categoria.**
 *
 * **`organizacao.configurar`, e não `qualquer-vinculo-ativo`:** ler a lista é de todo mundo porque T-04 a
 * consome; **escrevê-la é do Gestor** (contrato §8.1).
 *
 * **Sem `Location`:** `/categorias/{id}` não tem `GET`, então apontar para lá seria apontar para uma porta
 * que não abre. O `201` devolve a categoria inteira — mesma decisão de `POST /vinculos`.
 */
export const POST = comContexto(
  { exige: "organizacao.configurar", corpo: criacaoDeCategoriaSchema },
  async ({ ctx, repos, corpo }) => {
    const categoria = await criarCategoria(repos.categorias, {
      nome: corpo.nome,
      ...(corpo.icone === undefined ? {} : { icone: corpo.icone }),
      ...(corpo.ordem === undefined ? {} : { ordem: corpo.ordem }),
      porPessoaId: ctx.pessoaId,
    });
    return resposta(projetarCategoria(categoria), { status: 201 });
  },
);

export const dynamic = "force-dynamic";
