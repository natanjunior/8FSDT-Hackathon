import type { OcorrenciaLida, TransicaoLida } from "@/aplicacao/ocorrencia";
import { comandosDisponiveis, type MotivoPausa, type StatusOcorrencia } from "@/dominio/ocorrencia";

/**
 * ============================================================================
 *  Os rótulos exibidos — transcritos do `glossario.md` §4
 * ============================================================================
 *
 * A tabela do glossário é **a fonte**: *"o contrato de API a consome, e nenhum rótulo nasce fora daqui"*.
 *
 * **Esta é a coluna do Solicitante, e a escolha é decisão da spec do item 11 (§3.3).** A tabela tem duas
 * colunas e depende de quem lê; a **dependência de papel é do item 31**, que é o que ele tem de próprio.
 * Até lá, a coluna do Solicitante é o padrão — porque a do Gestor para `aberta` é *"Aberta"*, que é o
 * enum com maiúscula, exatamente o que este campo existe para não ser.
 *
 * **Custo declarado:** até o item 31, um Gestor que registre lê *"Recebida — aguardando análise"*.
 *
 * **`Pausada` tem quatro rótulos, não um molde com o motivo interpolado** (regra 2 do glossário): frase
 * montada em tempo de execução produz *"Parada, esperando aguardando peça"*.
 */
const ROTULO_DE_PAUSA: Readonly<Record<MotivoPausa, string>> = {
  aguardando_informacao_solicitante: "Parada — esperando você responder",
  aguardando_peca: "Parada — esperando material chegar",
  aguardando_autorizacao: "Parada — esperando autorização",
  aguardando_terceiro: "Parada — esperando um terceiro",
};

const ROTULO_DE_STATUS: Readonly<Record<Exclude<StatusOcorrencia, "pausada">, string>> = {
  aberta: "Recebida — aguardando análise",
  em_analise: "Em análise",
  em_atendimento: "Em execução",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

export function rotuloDeStatus(status: StatusOcorrencia, motivoPausa: MotivoPausa | null): string {
  if (status !== "pausada") return ROTULO_DE_STATUS[status];
  // Sem motivo não deveria acontecer — o `CHECK` do banco garante o par —, mas o rótulo não é o lugar
  // de estourar: degrada para a palavra, que continua sendo texto e não cor (A-5).
  return motivoPausa === null ? "Parada" : ROTULO_DE_PAUSA[motivoPausa];
}

/** O schema `RegistroDeTransicao` do contrato. **`sequencia` não sai** — é ordem interna da trilha. */
export function projetarTransicao(lida: TransicaoLida) {
  return {
    statusAnterior: lida.statusAnterior,
    statusNovo: lida.statusNovo,
    ocorreuEm: lida.ocorreuEm,
    autor: lida.autor,
    observacao: lida.observacao,
    motivoPausa: lida.motivoPausa,
    motivoCancelamento: lida.motivoCancelamento,
  };
}

export type QuemLe = {
  pessoaId: string;
  /** `Vinculo.permissoes`. */
  permissoes: readonly string[];
};

/**
 * O schema `OcorrenciaDetalhe`.
 *
 * **`anexos` é `[]` e `quantidadeDeAnexos` é `0` nesta fatia**, e os dois valores são forçados, não
 * escolhidos: a tabela `anexos` é do item 13b. O schema diz *"lista vazia quando não há anexo — nunca
 * `null`, para o cliente não precisar de dois caminhos de leitura"*, e a contagem *"já é a forma final"*.
 *
 * **`acoesDisponiveis` nunca vem nula e nunca vem ausente** — o campo é `required`, e a tela que
 * renderiza exatamente esta lista precisa distinguir *"não há o que fazer"* de *"a lista não veio"*.
 * Hoje ela sai vazia porque `COMANDOS_IMPLEMENTADOS` está vazia, e vazia é **verdade sobre o produto de
 * hoje**: nenhum dos onze endpoints de comando foi construído.
 */
export function projetarOcorrenciaDetalhe(lida: OcorrenciaLida, quemLe: QuemLe) {
  return {
    id: lida.id,
    titulo: lida.titulo,
    status: lida.status,
    statusRotulo: rotuloDeStatus(lida.status, lida.motivoPausa),
    motivoPausa: lida.motivoPausa,
    prioridade: lida.prioridade,
    categoria: { id: lida.categoria.id, nome: lida.categoria.nome, icone: lida.categoria.icone },
    area: lida.area,
    autor: lida.autor,
    responsavel: lida.responsavel,
    quantidadeDeAnexos: 0,
    registradaEm: lida.registradaEm,
    atualizadaEm: lida.atualizadaEm,
    descricao: lida.descricao,
    localizacaoComplemento: lida.localizacaoComplemento,
    anexos: [],
    solucaoAplicada: lida.solucaoAplicada,
    avaliacao: lida.avaliacao,
    ultimaTransicao: projetarTransicao(lida.ultimaTransicao),
    acoesDisponiveis: comandosDisponiveis({
      status: lida.status,
      permissoes: quemLe.permissoes,
      ehAutor: lida.autor.pessoaId === quemLe.pessoaId,
      jaAvaliada: lida.avaliacao !== null,
    }),
  };
}
