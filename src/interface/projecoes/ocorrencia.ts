import type {
  CursorDeListagem,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  PaginaDeOcorrencias,
  TransicaoLida,
} from "@/aplicacao/ocorrencia";
import { comandosDisponiveis, type MotivoPausa, type StatusOcorrencia } from "@/dominio/ocorrencia";

import { projetarAnexo } from "./anexo";

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

/**
 * O motivo da pausa **em palavras**, para a segunda linha do item na lista do Gestor (critério 14.3).
 *
 * **Reusa a mesma tabela do rótulo — não há segundo vocabulário.** A regra 2 do glossário proíbe frase
 * montada em tempo de execução, e inventar uma forma curta aqui criaria exatamente o segundo texto que a
 * tabela existe para impedir.
 *
 * **Hoje isto é inalcançável:** nada pode estar `pausada` antes do item 23. E entre o 23 e o 31 o rótulo
 * do Solicitante — que é o de todo mundo até lá — já traz o motivo dentro dele, então a segunda linha vai
 * repeti-lo. A janela é curta e está declarada na §3.4 da spec; quem a fecha é o **31**, trocando o rótulo
 * do Gestor para *"Pausada"*.
 */
export function rotuloDeMotivoPausa(motivo: MotivoPausa): string {
  return ROTULO_DE_PAUSA[motivo];
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
 * **`anexos` e `quantidadeDeAnexos` vêm do que o repositório leu** — desde o item 13b. O schema diz
 * *"lista vazia quando não há anexo — nunca `null`, para o cliente não precisar de dois caminhos de
 * leitura"*, e é o que `OcorrenciaLida.anexos` garante em tipo. A contagem é o comprimento da lista: no
 * detalhe os anexos já vieram, e uma segunda consulta para contá-los seria trabalho por nada.
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
    quantidadeDeAnexos: lida.anexos.length,
    registradaEm: lida.registradaEm,
    atualizadaEm: lida.atualizadaEm,
    descricao: lida.descricao,
    localizacaoComplemento: lida.localizacaoComplemento,
    anexos: lida.anexos.map((anexo) => projetarAnexo(lida.id, anexo)),
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

/**
 * O schema `OcorrenciaResumo` do contrato — o que a **listagem** devolve.
 *
 * **`categoria` sai `{id, nome}` e o `icone` não entra**, e isso é decisão, não esquecimento (critério
 * 14.6): o payload embute campo emprestado quando ele carrega **significado** — `area.tipo` deriva
 * visibilidade —, e ícone não carrega nenhum. T-03 cruza contra `GET /categorias`, que já o traz.
 *
 * **`quantidadeDeAnexos` vem do repositório desde o item 13b** — subconsulta correlacionada, não coluna
 * materializada. **`responsavel: null` continua forçado**, pelo item 19: `null` é a **verdade sobre o
 * produto de hoje**, não um valor de reserva.
 */
export function projetarOcorrenciaResumo(lida: OcorrenciaResumoLida) {
  return {
    id: lida.id,
    titulo: lida.titulo,
    status: lida.status,
    statusRotulo: rotuloDeStatus(lida.status, lida.motivoPausa),
    motivoPausa: lida.status === "pausada" ? lida.motivoPausa : null,
    prioridade: lida.prioridade,
    categoria: { id: lida.categoria.id, nome: lida.categoria.nome },
    area: lida.area,
    autor: lida.autor,
    responsavel: lida.responsavel,
    quantidadeDeAnexos: lida.quantidadeDeAnexos,
    registradaEm: lida.registradaEm,
    atualizadaEm: lida.atualizadaEm,
  };
}

export type OcorrenciaResumoProjetada = ReturnType<typeof projetarOcorrenciaResumo>;

/**
 * O cursor opaco: `base64url` do par `(registradaEm, id)` — *"exatamente o índice já existente"*
 * (`contrato-de-api.md` §7.7).
 *
 * **Opaco de propósito.** O cliente não deve montar cursor: no dia em que a ordenação ganhar uma segunda
 * coluna, um cliente que tenha aprendido a forma quebra. O que ele guarda é o que veio.
 */
export function codificarCursor(item: { registradaEm: string; id: string }): string {
  return Buffer.from(`${item.registradaEm}|${item.id}`, "utf8").toString("base64url");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * O caminho de volta — `null` quando o valor não é um cursor desta API.
 *
 * **`Buffer.from(x, "base64url")` não estoura com lixo: ele ignora o que não é do alfabeto.** Por isso a
 * validação real acontece **depois** de decodificar, sobre o conteúdo: duas partes, uma data que o
 * `Date.parse` entende, e um `uuid`. Sem isso, `?cursor=pagina-2` viraria uma consulta com data
 * `Invalid Date` — e um `500` no lugar do `400` que o contrato manda.
 */
export function decodificarCursor(bruto: string): CursorDeListagem | null {
  if (bruto === "") return null;

  const partes = Buffer.from(bruto, "base64url").toString("utf8").split("|");
  if (partes.length !== 2) return null;

  const [registradaEm, id] = partes;
  if (registradaEm === undefined || id === undefined) return null;
  if (Number.isNaN(Date.parse(registradaEm))) return null;
  if (!UUID.test(id)) return null;

  return { registradaEm, id };
}

/**
 * O envelope de `GET /ocorrencias` — **e o da estrada direta de T-03**, que é a mesma função.
 *
 * **`proximoCursor` é o do último item devolvido, e só existe com `temMais`.** Um cursor emitido sem haver
 * próxima página produziria um *"Carregar mais"* que devolve zero itens — o vazio que é defeito chegando
 * como `200`, que é a classe do achado R-15 do protótipo.
 */
export function projetarPaginaDeOcorrencias(pagina: PaginaDeOcorrencias) {
  const ultimo = pagina.itens[pagina.itens.length - 1];

  return {
    itens: pagina.itens.map(projetarOcorrenciaResumo),
    proximoCursor: pagina.temMais && ultimo !== undefined ? codificarCursor(ultimo) : null,
    visibilidadeAplicada: pagina.visibilidadeAplicada,
  };
}

export type PaginaDeOcorrenciasProjetada = ReturnType<typeof projetarPaginaDeOcorrencias>;
