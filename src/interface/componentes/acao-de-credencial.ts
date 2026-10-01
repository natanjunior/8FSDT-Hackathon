import { unstable_rethrow } from "next/navigation";

import type { EstadoDoFormulario } from "@/interface/acoes";

/**
 * **A chamada de uma ação de credencial, e o que acontece quando ela não chega ao servidor.**
 *
 * Sem rede, a promessa da ação rejeita, e sem este `try` o erro sobe até a página de erro do framework,
 * no lugar do aviso de falha que o guia §7 manda dar. Aqui ele vira `FALHA_DO_PROVEDOR`, que as quatro
 * telas já traduzem pela frase genérica: para quem está na tela, as duas falhas são a mesma.
 *
 * **O erro de controle do Next atravessa** (`unstable_rethrow`). É por ele que o `redirect()` de T-01 leva
 * a pessoa para dentro e que o link vencido de T-13 troca de face; engoli-lo a deixaria parada na tela.
 */
export async function chamarAcaoDeCredencial(
  acao: (anterior: EstadoDoFormulario, dados: FormData) => Promise<EstadoDoFormulario>,
  anterior: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  try {
    return await acao(anterior, dados);
  } catch (erro) {
    unstable_rethrow(erro);
    return { recusa: "FALHA_DO_PROVEDOR" };
  }
}

/** Os campos que nunca voltam ao formulário depois de uma resposta, nem se alguém os pedir. */
const NUNCA_VOLTAM: ReadonlySet<string> = new Set(["senha"]);

/**
 * **O que a pessoa digitou e não é senha, para voltar ao formulário depois da resposta** (item 103,
 * critério 6). O React 19 esvazia o formulário com `action` ao fim da ação; os campos voltam ao valor
 * inicial, e é esse valor que estes dados reescrevem.
 *
 * **Sai do `FormData` que a função da ação já recebe no navegador**, e nunca de eco do servidor: a senha não
 * entra em estado nenhum.
 */
export function valoresPreservados(
  dados: FormData,
  campos: readonly string[],
): Readonly<Record<string, string>> {
  const valores: Record<string, string> = {};
  for (const campo of campos) {
    if (NUNCA_VOLTAM.has(campo)) continue;
    const valor = dados.get(campo);
    if (typeof valor === "string") valores[campo] = valor;
  }
  return valores;
}
