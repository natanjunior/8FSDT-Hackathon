import { confirmarPorCodigo } from "@/aplicacao/credenciais";
import { montarCredenciais } from "@/composicao";

import { armazenamentoDeCookies } from "./com-contexto";

/**
 * A aterrissagem do link do e-mail de confirmação de conta.
 *
 * **Não é tela** — é o estado que o inventário descreve como *"o estado que não é tela"*: zero campos
 * próprios, e a única ação é entrar. Ele consome o código do link, cria a sessão e devolve a pessoa a T-01
 * com a linha certa acima do formulário (protótipo, T-01, quadros 5 e 6).
 *
 * **Por que ele existe, e não é escopo a mais.** O inventário registra que a redação anterior tratava as
 * telas de credencial como *"não são telas nossas"*, e que o erro concreto disso foi que o **link do e-mail
 * de redefinição não tinha onde aterrissar**. O mesmo valia para o de confirmação. Com a confirmação de
 * e-mail ligada — que é a recomendação da Q-T9 —, sem esta rota T-01 não fecha: a conta é criada e ninguém
 * consegue entrar.
 *
 * **Não é `route.ts` de contrato**, então não entra no `openapi.yaml` e não tem `comContexto`: aqui não há
 * sessão a resolver ainda — é o pedido que a cria.
 */
export async function aterrissarConfirmacaoDeConta(requisicao: Request): Promise<Response> {
  const codigo = new URL(requisicao.url).searchParams.get("code");

  if (codigo === null || codigo === "") {
    return redirecionarParaEntrar(requisicao, "expirada");
  }

  const resultado = await confirmarPorCodigo(
    montarCredenciais(await armazenamentoDeCookies()),
    codigo,
  );

  return redirecionarParaEntrar(requisicao, resultado.ok ? "confirmada" : "expirada");
}

function redirecionarParaEntrar(requisicao: Request, estado: "confirmada" | "expirada"): Response {
  const destino = new URL("/entrar", requisicao.url);
  destino.searchParams.set("confirmacao", estado);
  return Response.redirect(destino, 303);
}
