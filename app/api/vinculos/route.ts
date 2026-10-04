import { cadastrarVinculo, listarVinculos } from "@/aplicacao/organizacao";
import { comContexto, resposta } from "@/interface/http";
import { projetarVinculo } from "@/interface/projecoes";
import { cadastroDeVinculoSchema } from "@/interface/schemas";

/**
 * **`GET /vinculos` — quem está nesta organização.**
 *
 * Este endpoint é o que substitui, de propósito, um `GET /pessoas` que **não existe e não deve existir**
 * (contrato §4.6): `pessoas` é global, e uma listagem que partisse dela devolveria o cadastro do sistema
 * inteiro. É também a lista de candidatos a responsável (D21).
 *
 * **`vinculo.gerir`, e não `qualquer-vinculo-ativo`:** `contatos[]` só aparece aqui, e contato é dado
 * pessoal sob o RNF10 (suposição S-A5). Não há razão para o Solicitante ler o telefone do vizinho.
 *
 * **O filtro `?papel=` do contrato não tem consumidor nesta linha** — spec §2.3. O parâmetro continua
 * declarado; a tela não o oferece.
 */
export const GET = comContexto({ exige: "vinculo.gerir" }, async ({ repos }) => ({
  itens: (await listarVinculos(repos.vinculos)).map(projetarVinculo),
}));

/**
 * **`POST /vinculos` — cadastrar participante sem conta.**
 *
 * Cria **Pessoa e Vínculo na mesma transação** (D27). É o caminho de escrita da regra do vínculo primeiro:
 * entra-se pelo vínculo, nunca pela Pessoa.
 *
 * **Sem `Location`, e é o contrato que assim quer:** `/vinculos/{pessoaId}` não tem `GET`, então apontar
 * para lá seria apontar para uma porta que não abre. O `201` devolve o vínculo inteiro.
 */
export const POST = comContexto(
  { exige: "vinculo.gerir", corpo: cadastroDeVinculoSchema },
  async ({ repos, corpo }) => {
    const vinculo = await cadastrarVinculo(repos.vinculos, {
      nome: corpo.nome,
      papel: corpo.papel,
      areaId: corpo.areaId,
      contatos: corpo.contatos,
    });
    return resposta(projetarVinculo(vinculo), { status: 201 });
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
