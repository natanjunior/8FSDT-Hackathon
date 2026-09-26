import type { AutorizacaoEmitida } from "@/aplicacao/anexo";
import type { AnexoLido } from "@/aplicacao/ocorrencia";

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

/**
 * O schema `Anexo` do contrato.
 *
 * **As duas URLs são caminhos desta API, montados a partir do `anexoId`** — que é a chave primária,
 * imutável. É por isso que o endpoint existe: se elas carregassem a chave do storage, mudariam no dia em
 * que a variante de prefixo da §10.3 fosse necessária, e cada `Anexo` já entregue apontaria para um
 * caminho morto (contrato §10.4).
 *
 * **`fonte` não aparece, de propósito:** ela diz qual provedor resolve a chave, e isso é infraestrutura —
 * o cliente recebe uma URL desta API e segue o `302`.
 */
export function projetarAnexo(ocorrenciaId: string, lido: AnexoLido) {
  const url = `/api/ocorrencias/${ocorrenciaId}/anexos/${lido.id}`;

  return {
    id: lido.id,
    tipo: lido.tipo,
    titulo: lido.titulo,
    nomeArquivo: lido.nomeArquivo,
    // A **mesma** operação, com a mesma autorização — parâmetro, não caminho novo.
    miniaturaUrl: lido.temMiniatura ? `${url}?variante=miniatura` : null,
    tipoConteudo: lido.tipoConteudo,
    tamanhoBytes: lido.tamanhoBytes,
    url,
    anexadoEm: lido.anexadoEm,
  };
}

export type AnexoProjetado = ReturnType<typeof projetarAnexo>;
