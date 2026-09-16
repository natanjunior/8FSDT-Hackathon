import { escolherOrganizacaoAtiva } from "@/aplicacao/contexto";
import { semOrganizacao } from "@/interface/http";
import { projetarContexto } from "@/interface/projecoes";
import { trocaDeOrganizacaoSchema } from "@/interface/schemas";

/**
 * **`PUT /contexto/organizacao`** — escolher a organização ativa da sessão (contrato §8.0).
 *
 * **A segunda das cinco operações da lista fechada da §4.4**, e o caminho deste arquivo estava reservado
 * em `eslint.config.mjs` desde o esqueleto: nenhuma linha de lint muda aqui.
 *
 * **Quatro coisas e nada mais**: a regra, o cookie, a projeção, o `200`. **Nenhum agregado é tocado** e
 * **nenhuma consulta é feita** — a lista de vínculos já veio da resolução, que roda uma vez por
 * requisição.
 *
 * **O `Set-Cookie` sai por `definirOrganizacaoAtiva`**, e não montado aqui: a assinatura é mecânica de
 * sessão, e um `route.ts` que montasse o cookie seria a segunda cópia da regra do §4.3 — *"é sempre a
 * segunda cópia que diverge"* (`com-contexto.ts:126-135`).
 *
 * **A recusa é `403 SEM_VINCULO_NA_ORGANIZACAO`, com a mesma resposta para organização inexistente.** O
 * de-para já existe (`problema.ts:25`); quem lança é a Aplicação.
 */
export const PUT = semOrganizacao(
  { corpo: trocaDeOrganizacaoSchema },
  ({ resolucao, corpo, definirOrganizacaoAtiva }) => {
    const escolhida = escolherOrganizacaoAtiva(resolucao, corpo.organizacaoId);

    definirOrganizacaoAtiva(corpo.organizacaoId);

    return projetarContexto(escolhida);
  },
);

/** Escala a zero e cookie de sessão: nada aqui é cacheável (RNF5). */
export const dynamic = "force-dynamic";
