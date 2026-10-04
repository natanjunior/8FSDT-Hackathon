import { lerConvitePessoal } from "@/aplicacao/organizacao";
import { FORMATO_DO_TOKEN, semSessao } from "@/interface/http";
import { projetarConvitePessoal } from "@/interface/projecoes";

/**
 * **`GET /convites-pessoais/{token}`** — a segunda operação sem sessão (item 121, ADR-0021).
 *
 * Sem sessão, devolve o nome da pessoa, o da organização e o papel, para a página dizer quem o convite
 * acha que a pessoa é, e **nenhum contato**. **`200` em todas as situações**: um `404` para o token morto
 * diria, pelo status, que ele existiu. Fora do formato, inexistente, renovado, aceito, de vínculo
 * revogado ou de quem já tem conta: todos são `{ situacao: "nao-vale" }`, sem nome nenhum.
 */
export const GET = semSessao(async ({ quem, convitesPessoais, parametros }) => {
  const token = parametros.token ?? "";
  if (!FORMATO_DO_TOKEN.test(token)) return projetarConvitePessoal(null);
  return projetarConvitePessoal(await lerConvitePessoal({ convitesPessoais }, quem, token));
});

/** Escala a zero e cookie de sessão: nada aqui é cacheável. */
export const dynamic = "force-dynamic";
