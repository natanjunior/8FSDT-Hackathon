/**
 * ============================================================================
 *  A chamada de `PUT /contexto/organizacao` — um `fetch`, duas frases, um lugar
 * ============================================================================
 *
 * **Módulo sem componente**, pela mesma razão escrita em `comando-de-ocorrencia.ts`: há **dois**
 * chamadores — o `MenuDeOrganizacao` de T-03 e T-10, e a face D de T-02 —, e duas construções da mesma
 * frase do `403` seriam a segunda cópia de sempre.
 *
 * **Sem `"use client"`, e não é esquecimento:** este arquivo não usa hook nenhum. A diretiva mora no
 * componente que tem estado.
 *
 * **Sem `X-Organizacao-Id`:** `PUT /contexto/organizacao` é uma das quatro operações da §4.4, e o servidor
 * não confere a afirmação nelas (`com-contexto.ts:321-324`). Mandá-la aqui seria ruído que o item 7b.6
 * não pediu.
 *
 * **Quem navega é quem chama.** Os dois chamadores navegam para o mesmo lugar — `/` —, mas em momentos
 * diferentes do próprio estado, e embutir o `router` aqui tiraria deles essa escolha.
 */

/** A frase do `403`, literal do `inventario-de-telas.md:1515`. */
const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  SEM_VINCULO_NA_ORGANIZACAO: "Você não tem acesso a esta organização.",
};

/** O que a tela mostra quando não há frase melhor — mesmo desfecho para resposta sem código conhecido e
 *  para a rejeição do próprio `fetch` (rede caiu, DNS falhou). */
export const MENSAGEM_DE_TROCA_GENERICA = "Não foi possível trocar de organização agora. Tente de novo.";

export type ResultadoDaTroca = { ok: true } | { ok: false; aviso: string };

export async function trocarOrganizacao(organizacaoId: string): Promise<ResultadoDaTroca> {
  try {
    const resposta = await fetch("/api/contexto/organizacao", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizacaoId }),
    });

    if (resposta.ok) return { ok: true };

    const problema = (await resposta.json().catch(() => ({}))) as {
      codigo?: string;
      detail?: string;
    };

    // O texto que nós escrevemos ganha do `detail` do servidor, porque é redigido para a tela; o `detail`
    // entra quando não temos texto próprio (contrato §6.1); o genérico é o último recurso.
    return {
      ok: false,
      aviso: TEXTO_DA_RECUSA[problema.codigo ?? ""] ?? problema.detail ?? MENSAGEM_DE_TROCA_GENERICA,
    };
  } catch {
    // `fetch` rejeitou antes de haver resposta. Sem este `catch` a rejeição aciona o Error Boundary mais
    // próximo em vez de mostrar uma linha de aviso. Nuvem sem SLA: rede instável é o caso esperado.
    return { ok: false, aviso: MENSAGEM_DE_TROCA_GENERICA };
  }
}
