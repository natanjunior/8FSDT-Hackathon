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
 * ---------------------------------------------------------------------------
 *  DORMENTE — existe, e nada a alcança nesta entrega
 * ---------------------------------------------------------------------------
 *
 * **O hub fechou a Q-T9 em 22/08/2026: a confirmação de e-mail NÃO é obrigatória antes do primeiro login.**
 * T-11 termina em sessão válida, o provedor não envia e-mail de confirmação, e **nenhum link aterrissa
 * aqui**. O que desliga esta rota é o interruptor *Confirm email* no painel do provedor — não o código.
 *
 * **Por que ela fica.** Virar o interruptor é decisão de painel, e apagar a rota cobraria reescrevê-la no
 * mesmo dia. O item 6b precisa da mesma mecânica de aterrissagem para T-13.
 *
 * **Nota de método, e é o que este comentário existe para não repetir.** A redação anterior justificava a
 * rota citando *"a recomendação da Q-T9"* — recomendação de uma questão que estava **aberta**. Virou o
 * achado A-6a-1 da spec do item 6a. Recomendação não decide nada (convenção 6 do `CLAUDE.md`).
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
