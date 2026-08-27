import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import { montarArmazenamentoDeAnexos } from "@/composicao";

/**
 * **A TERCEIRA lista fechada do projeto**, e a razão é irmã das duas primeiras.
 *
 * `portasDeAnexo` assina **SAS de escrita** e queima o livro-caixa de 30/h; esta entrega a porta que **lê
 * objeto, troca etiqueta e assina SAS de leitura**. São capacidades diferentes: alargar a segunda lista
 * daria ao endpoint de leitura o poder de emitir crédito de upload — precisão perdida por economia de
 * quinze linhas.
 *
 * **O `eslint.config.mjs` permite importar `armazenamentoDeAnexos` em exatamente dois `route.ts`:**
 * `app/api/ocorrencias/route.ts` (que reivindica) e
 * `app/api/ocorrencias/[ocorrenciaId]/anexos/[anexoId]/route.ts` (que lê). Um terceiro não é caso a
 * resolver no código: é uma linha naquele arquivo, escrita por quem decidir que ele deve existir.
 *
 * **O que isto não afrouxa:** os dois endpoints continuam escopados. Passam pelo `comContexto`, exigem
 * permissão e recebem `ctx` como qualquer outro. A porta não é escopada porque não tem escopo a ter — quem
 * amarra é o ticket, na escrita, e a linha de `anexos` lida pelo repositório escopado, na leitura.
 */
export function armazenamentoDeAnexos(): ArmazenamentoDeAnexos {
  return montarArmazenamentoDeAnexos();
}
