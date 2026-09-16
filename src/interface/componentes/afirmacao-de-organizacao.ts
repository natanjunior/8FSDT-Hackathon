/**
 * ============================================================================
 *  A afirmação de organização — a trava da aba esquecida, do lado do cliente
 * ============================================================================
 *
 * O contrato §4.3 já a declarava e o servidor já a conferia (`com-contexto.ts:319-331`):
 *
 * > `X-Organizacao-Id` **nunca escolhe** a organização — apenas confirma a que a sessão já escolheu.
 * > Ausente, não há verificação. Presente e diferente: `409`, e nada é executado.
 *
 * **Nenhuma linha de cliente a enviava**, e até o item 7b isso não custava nada: **ninguém conseguia trocar
 * de organização** — com um vínculo o servidor escolhia sozinho, e com dois a face D não fazia nada. Este
 * item abre a troca, e com ela a classe de erro que o cabeçalho existe para fechar.
 *
 * **O valor é sempre o da renderização daquela aba.** Ler o cookie aqui anularia o mecanismo: a outra aba
 * já o reescreveu, e a afirmação bateria consigo mesma. Por isso esta função **recebe** o identificador e
 * não o busca em lugar nenhum — e por isso a propriedade que o traz é obrigatória em todo componente que a
 * usa.
 *
 * **Onde NÃO entra**, e cada um por uma razão própria: na **leitura** (falha sozinha, sem gravar nada); nas
 * **cinco operações da §4.4** (não há organização ativa a confirmar, e `comContexto` nem confere ali —
 * `com-contexto.ts:321-324`); e no **envio ao Storage** (é outro domínio, não a nossa API).
 */

/** O nome que o servidor lê em `com-contexto.ts:327`. Escrito uma vez, dos dois lados. */
export const CABECALHO_DE_ORGANIZACAO = "x-organizacao-id";

/**
 * Os cabeçalhos de uma escrita de cliente para endpoint escopado.
 *
 * @param organizacaoId a organização **com que aquela aba renderizou** — nunca a do cookie no clique.
 */
export function cabecalhosDeEscrita(organizacaoId: string): Record<string, string> {
  return {
    "content-type": "application/json",
    [CABECALHO_DE_ORGANIZACAO]: organizacaoId,
  };
}
