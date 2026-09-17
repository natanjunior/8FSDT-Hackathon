/**
 * ============================================================================
 *  *Usadas por você* — armazenamento do aparelho, não cache de resposta
 * ============================================================================
 *
 * **A distinção é a S-T6 do `inventario-de-telas.md` e a §3 do `prototipo-low-fi.md`.** O que se guarda é
 * uma **preferência** — uma lista curta de `areaId`. O que **nunca** se guarda é o corpo de `GET /areas`.
 *
 * | Decisão | Qual é | Por quê |
 * |---|---|---|
 * | Chave | `resolve-ai.areas-usadas.<organizacaoId>` | `areaId` só faz sentido dentro de uma organização; uma chave só misturaria os locais de quem tem dois vínculos, que é o caso da semente |
 * | Quantas se guardam | até **6**, a mais recente na frente | o bloco mostra 3; guardar 6 dá folga para que desativar uma área não encolha o bloco na hora |
 * | Quantas aparecem | até **3** | critério 44l.3 |
 * | Quando se grava | no **`201`** | *"usadas"* quer dizer usadas; gravar na escolha encheria a lista com as tentativas abandonadas no cancelar |
 * | Como se cruza | a guardada é **reordenada sobre as ativas que acabaram de chegar** | área desativada, apagada ou de outra organização não casa e some. É a frase do protótipo, ao pé da letra |
 * | Falha de leitura ou escrita | **engolida**, e o bloco não aparece | `localStorage` lança em janela privada e com dados de site bloqueados. Uma lista de conveniência nunca pode impedir o registro — é a tela do RNF6 |
 *
 * **As duas funções de cima são puras e têm teste.** O par de baixo toca `window.localStorage` e não tem:
 * é `try/catch` de duas linhas, e o que ele protege está declarado na linha acima.
 */

const PREFIXO = "resolve-ai.areas-usadas.";
const TETO_GUARDADO = 6;
const TETO_MOSTRADO = 3;

/** As guardadas que ainda existem entre as ativas, **na ordem de uso**, no máximo três. */
export function areasUsadas<T extends { readonly id: string }>(
  guardadas: readonly string[],
  ativas: readonly T[],
): readonly T[] {
  const porId = new Map(ativas.map((item) => [item.id, item]));
  const achadas: T[] = [];
  for (const id of guardadas) {
    const item = porId.get(id);
    if (item !== undefined) achadas.push(item);
    if (achadas.length === TETO_MOSTRADO) break;
  }
  return achadas;
}

/** A nova vai para a frente; repetida sobe em vez de duplicar; o teto corta a mais antiga. */
export function comAreaUsada(guardadas: readonly string[], areaId: string): readonly string[] {
  return [areaId, ...guardadas.filter((id) => id !== areaId)].slice(0, TETO_GUARDADO);
}

export function lerAreasUsadas(organizacaoId: string): readonly string[] {
  try {
    const cru = window.localStorage.getItem(PREFIXO + organizacaoId);
    if (cru === null) return [];
    const lido: unknown = JSON.parse(cru);
    if (!Array.isArray(lido)) return [];
    return lido.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function gravarAreaUsada(organizacaoId: string, areaId: string): void {
  try {
    const proxima = comAreaUsada(lerAreasUsadas(organizacaoId), areaId);
    window.localStorage.setItem(PREFIXO + organizacaoId, JSON.stringify(proxima));
  } catch {
    // Engolida de propósito: uma lista de conveniência nunca impede o registro.
  }
}
