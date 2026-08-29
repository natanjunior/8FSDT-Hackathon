import { cabecalhosDeEscrita } from "@/interface/componentes/afirmacao-de-organizacao";

/**
 * ============================================================================
 *  A chamada de comando de T-05 — um `fetch`, três frases, um lugar
 * ============================================================================
 *
 * **Módulo sem componente**, e é o ponto: a barra fazia isto dentro dela, e a partir do item 19 há um
 * segundo chamador — o modal de atribuição. Duas construções da **mesma** frase do `409` seriam a segunda
 * cópia de sempre.
 *
 * **Nenhum tipo do Domínio entra aqui.** `comando` é `string`, e o mapa de rótulos chega **pronto**, por
 * parâmetro: importar `rotulosDeStatus` arrastaria `@/interface/projecoes` e, com ele,
 * `comandosDisponiveis` — a máquina de estados inteira para dentro do pacote do navegador, que é
 * literalmente a segunda cópia que `acoesDisponiveis` existe para impedir.
 *
 * **Sem `"use client"`, e não é esquecimento:** quem tem estado é quem chama. Este arquivo não usa hook
 * nenhum, e a diretiva mora no componente.
 */

/** O que a tela mostra quando não há frase melhor — a resposta mais completa que o inventário dá a um
 *  erro sem código conhecido. */
export const MENSAGEM_GENERICA = "Não foi possível executar agora. Tente de novo.";

export type ResultadoDoComando = { ok: true } | { ok: false; aviso: string };

/**
 * Chama `POST /api/ocorrencias/{id}/{comando}` e traduz a resposta em **uma frase ou nada**.
 *
 * **A frase do `409` é a do inventário**, montada com o `statusAtual` que o contrato pôs no corpo do erro
 * exatamente para isto: *"Esta ocorrência mudou enquanto você estava olhando: agora ela está …"*. É o caso
 * das duas pessoas triando ao mesmo tempo.
 *
 * **Quem repinta a tela é quem chama**, e não esta função — os dois chamadores repintam em momentos
 * diferentes, e embutir o `router.refresh()` aqui tiraria essa escolha deles.
 */
export async function executarComando(
  ocorrenciaId: string,
  comando: string,
  corpo: unknown,
  rotulosDeStatus: Readonly<Record<string, string>>,
  /**
   * A organização **com que a página renderizou** — a afirmação da §4.3, e é aqui que ela cobre os
   * **dez** comandos de uma vez. Nunca lida do cookie: a outra aba já o reescreveu.
   */
  organizacaoId: string,
): Promise<ResultadoDoComando> {
  try {
    const resposta = await fetch(`/api/ocorrencias/${ocorrenciaId}/${comando}`, {
      method: "POST",
      headers: cabecalhosDeEscrita(organizacaoId),
      body: JSON.stringify(corpo),
    });

    if (resposta.ok) return { ok: true };

    const problema = (await resposta.json().catch(() => ({}))) as {
      codigo?: string;
      statusAtual?: string;
      detail?: string;
    };

    if (problema.codigo === "TRANSICAO_NAO_PERMITIDA" && problema.statusAtual !== undefined) {
      const rotulo = rotulosDeStatus[problema.statusAtual] ?? problema.statusAtual;
      return {
        ok: false,
        aviso: `Esta ocorrência mudou enquanto você estava olhando: agora ela está ${rotulo}.`,
      };
    }

    return { ok: false, aviso: problema.detail ?? MENSAGEM_GENERICA };
  } catch {
    // `fetch` rejeitou antes de haver resposta — rede caiu. Sem este `catch` a rejeição aciona o Error
    // Boundary em vez de mostrar a linha de aviso. Nuvem sem SLA: rede instável é o caso esperado.
    return { ok: false, aviso: MENSAGEM_GENERICA };
  }
}
