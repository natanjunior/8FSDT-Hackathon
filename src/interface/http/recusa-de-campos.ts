import { camposSemDestino } from "@/interface/schemas";

import { CampoNaoSuportado } from "./problema";

/**
 * ============================================================================
 *  A recusa em voz alta — `422 CAMPO_NAO_SUPORTADO`, num lugar só
 * ============================================================================
 *
 * `observacao` é declarada no `openapi.yaml` para **dois** comandos que não a guardam em lugar nenhum:
 * `/atribuir-responsavel` (item 19) e `/alterar-prioridade` (item 17). Nenhum dos dois gera registro de
 * transição, `atribuicoes` não tem coluna de observação, e a alteração de prioridade nem aparece na linha
 * do tempo. **Campo cuja capacidade é evolução prevista é a definição literal de `CAMPO_NAO_SUPORTADO`**
 * (contrato §6.2).
 *
 * **A LISTA mora em `interface/schemas` e a RECUSA mora aqui, e a divisão é deliberada.** O item 19 deixou
 * `camposSemDestino` no schema e o `if` do `throw` **dentro** do `route.ts` dele; o critério **17.6** manda
 * *"reusar, não copiar"*, e um `route.ts` não importa de outro. Esta função é o envelope compartilhado.
 *
 * ---------------------------------------------------------------------------
 *  A seta é `http → schemas`, e ela NUNCA inverte
 * ---------------------------------------------------------------------------
 *
 * A spec desta fatia (§3.6) propôs o contrário — pôr esta função **dentro** de
 * `interface/schemas/ocorrencia.ts`, importando `CampoNaoSuportado` de `@/interface/http`. É acíclico, e
 * mesmo assim está errado, por uma razão que só aparece no navegador:
 *
 * `src/interface/http/com-contexto.ts` **começa** com `import { cookies, headers } from "next/headers"`, e
 * `@/interface/http` o reexporta. Do outro lado, **três componentes de cliente alcançam
 * `@/interface/schemas`** — `formulario-de-categoria.tsx` diretamente, e `formulario-de-pedido-de-entrada`
 * e `sub-formulario-de-contatos` através de `componentes/telefone.ts`. Com a seta invertida, o grafo de
 * módulos deles passaria a alcançar `next/headers` e, atrás dele, `@/composicao` → `@/infraestrutura` →
 * `pg`, `@supabase/*` e `@azure/*`. **É a mesma classe de defeito que `comando-de-ocorrencia.ts` evita ao
 * receber `rotulosDeStatus` por parâmetro em vez de importá-lo.**
 *
 * Nesta direção o risco não existe: **nada de cliente importa `@/interface/http`**, e quem conhece `422` é
 * transporte, não schema.
 *
 * **Por que arquivo próprio e não dentro de `problema.ts`.** Aquele é o módulo da **forma** RFC 9457 — a
 * tabela `STATUS_POR_CODIGO` e as classes de erro. Saber **quais campos deste produto não têm destino** é
 * política de endpoint, não forma de erro.
 */
export function recusarSemDestino(corpo: unknown): void {
  const proibidos = camposSemDestino(corpo);
  if (proibidos.length > 0) throw new CampoNaoSuportado(proibidos);
}
