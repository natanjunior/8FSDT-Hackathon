import type { AutorizacaoEmitida } from "@/aplicacao/anexo";

/**
 * `AutorizacaoDeUpload`, do jeito que o contrato a declara.
 *
 * **`estado` é constante e mora aqui.** O objeto nasce pendente e é apagado pela regra de ciclo de vida se
 * nunca for reivindicado; reivindicar o promove a confirmado. O campo é devolvido para que esse
 * comportamento seja **visível ao cliente**, e não uma regra invisível do storage — e por ser um fato do
 * contrato, e não do domínio, ele é escrito na projeção.
 */
export function projetarAutorizacaoDeUpload(emitida: AutorizacaoEmitida) {
  return {
    chave: emitida.chave,
    chaveMiniatura: emitida.chaveMiniatura,
    ticket: emitida.ticket,
    estado: "pendente" as const,
    upload: emitida.upload,
    uploadMiniatura: emitida.uploadMiniatura,
  };
}
