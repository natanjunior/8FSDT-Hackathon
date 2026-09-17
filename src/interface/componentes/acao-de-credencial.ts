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
