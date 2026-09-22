import { MENSAGEM_GENERICA, mensagemDoProblema } from "@/interface/componentes/retorno-de-acao";

/**
 * ============================================================================
 *  A chamada de `PUT /contexto/organizacao` — um `fetch`, duas frases, um lugar
 * ============================================================================
 *
 * **Módulo sem componente**, pela mesma razão escrita em `comando-de-ocorrencia.ts`: há **três** arquivos
 * chamadores — `escolha-de-organizacao.tsx` (a lista da face D de T-02 e a de T-10), o
 * `SeletorDeOrganizacao` da casca e o *"Entrar nela"* de T-02 —, e uma construção da mesma frase do `403`
 * em cada um seria a cópia de sempre.
 *
 * **Sem `"use client"`, e não é esquecimento:** este arquivo não usa hook nenhum. A diretiva mora no
 * componente que tem estado.
 *
 * **Sem `X-Organizacao-Id`:** `PUT /contexto/organizacao` é uma das cinco operações da §4.4, e o servidor
 * não confere a afirmação nelas (`com-contexto.ts:321-324`). Mandá-la aqui seria ruído que o item 7b.6
 * não pediu.
 *
 * **Quem navega é quem chama.** Os chamadores navegam para o mesmo lugar — `/` —, mas em momentos
 * diferentes do próprio estado, e embutir o `router` aqui tiraria deles essa escolha.
 */

/** A frase do `403`, escrita uma vez para os três chamadores. */
const TEXTO_DA_RECUSA: Readonly<Record<string, string>> = {
  SEM_VINCULO_NA_ORGANIZACAO: "Você não tem acesso a esta organização.",
};

export type ResultadoDaTroca = { ok: true } | { ok: false; aviso: string };

export async function trocarOrganizacao(organizacaoId: string): Promise<ResultadoDaTroca> {
  try {
    const resposta = await fetch("/api/contexto/organizacao", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizacaoId }),
    });

    if (resposta.ok) return { ok: true };

    const problema = (await resposta.json().catch(() => null)) as unknown;
    // A frase que nós escrevemos ganha do `detail`, que ganha da genérica (retorno-de-acao.ts).
    return { ok: false, aviso: mensagemDoProblema(problema, TEXTO_DA_RECUSA) };
  } catch {
    // `fetch` rejeitou antes de haver resposta. Sem este `catch` a rejeição aciona o Error Boundary mais
    // próximo em vez de mostrar uma linha de aviso. Nuvem sem SLA: rede instável é o caso esperado.
    return { ok: false, aviso: MENSAGEM_GENERICA };
  }
}
