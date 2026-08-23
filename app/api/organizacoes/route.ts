import { criarOrganizacao } from "@/aplicacao/organizacao";
import { resposta, semOrganizacao } from "@/interface/http";
import { projetarOrganizacao } from "@/interface/projecoes";
import { criacaoDeOrganizacaoSchema } from "@/interface/schemas";

/**
 * `POST /organizacoes` — *criar a organização por auto-serviço* (contrato §8.1).
 *
 * **`semOrganizacao` porque este é o terceiro dos quatro endpoints da lista fechada da §4.4:** ele não
 * roda **sem** escopo por conveniência — ele **cria** o escopo. É o bootstrap da D26, e o `eslint.config.mjs`
 * já autoriza este caminho pelo nome.
 *
 * **Não exige organização ativa, e também não a recusa.** Um Gestor de A pode fundar B, e a nova fica
 * ativa pelo `Set-Cookie` da própria resposta — é o caso da Persona 1B.
 *
 * O handler faz o que a tabela de camadas lhe permite: valida a forma (pelo schema), chama **uma** função
 * de aplicação, projeta, e diz que a nova organização é a ativa. Nenhuma regra mora aqui.
 */
export const POST = semOrganizacao(
  { corpo: criacaoDeOrganizacaoSchema },
  async ({ ctx, corpo, portasGlobais, definirOrganizacaoAtiva }) => {
    const criada = await criarOrganizacao(portasGlobais.organizacoes, {
      nome: corpo.nome,
      criadaPorPessoaId: ctx.pessoaId,
    });

    // Antes de devolver: sem isto, o `GET /categorias` seguinte responderia `403 SEM_ORGANIZACAO_ATIVA`, e
    // o critério 1.3 — *"um GET /categorias imediatamente depois responde 200"* — cairia sem que nada na
    // criação estivesse errado.
    definirOrganizacaoAtiva(criada.id);

    // **Sem `Location`**: o contrato não declara o cabeçalho para esta operação, e não há
    // `GET /organizacoes/{id}` para onde ele apontaria.
    return resposta(projetarOrganizacao(criada), { status: 201 });
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
