import type {
  CursorDeListagem,
  FiltroDeOcorrencias,
  OcorrenciaLida,
  OcorrenciaResumoLida,
  PaginaDeOcorrencias,
  TransicaoLida,
} from "@/aplicacao/ocorrencia";
import {
  comandosDisponiveis,
  type MotivoPausa,
  type Prioridade,
  type StatusOcorrencia,
} from "@/dominio/ocorrencia";

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

/**
 * ============================================================================
 *  A coluna do Gestor — o nome do status como OPÇÃO DE FILTRO
 * ============================================================================
 *
 * **É a mesma tabela do glossário §4, na outra coluna** (`contrato-de-api.md`) — não é rótulo novo e não é
 * rótulo montado no navegador. Ela existe separada do `rotuloDeStatus` porque responde outra pergunta:
 * *"qual conjunto você quer"*, e não *"o que está acontecendo com a sua ocorrência"*.
 *
 * **A coluna do Solicitante não serviria**, e a razão é mecânica: nela `pausada` tem **quatro** rótulos,
 * um por motivo, e uma opção de filtro não tem motivo.
 *
 * **Não é a segunda cópia que o contrato §8.8 recusa** — essa seria montar rótulo no navegador, e aqui os
 * rótulos descem prontos do Server Component para a barra.
 *
 * **Custo declarado, e temporário:** até o item **31**, o chip diz *"Aberta"* enquanto o item da lista diz
 * *"Recebida — aguardando análise"* — dois vocabulários para o mesmo status na mesma tela. É o custo que a
 * spec do item 11 já declarou ao escolher uma coluna só, ficando visível lado a lado. Achado **A-6**.
 */
const NOME_DO_STATUS: Readonly<Record<StatusOcorrencia, string>> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  em_atendimento: "Em atendimento",
  pausada: "Pausada",
  resolvida: "Resolvida",
  cancelada: "Cancelada",
};

const NOME_DA_PRIORIDADE: Readonly<Record<Prioridade, string>> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
};

export function nomeDoStatus(status: StatusOcorrencia): string {
  return NOME_DO_STATUS[status];
}

export function nomeDaPrioridade(prioridade: Prioridade): string {
  return NOME_DA_PRIORIDADE[prioridade];
}

/**
 * O recorte aplicado, em cláusulas — o subtítulo do **terceiro vazio** (critério 15.6).
 *
 * **A forma é mecânica de propósito, e diverge do exemplo que o critério ilustra.** O 15.6 mostra
 * *"Nenhuma **pausada** com prioridade **alta** em Recanto Azul."*, que depende de concordância em
 * português: funciona para `pausada`, `aberta`, `resolvida` e `cancelada`, e **quebra** para `em_analise`
 * e `em_atendimento` — *"Nenhuma em análise com…"*. Com dois valores na mesma dimensão quebra sempre:
 * *"Nenhuma pausada, aberta com…"*.
 *
 * **A saída é reusar o rótulo do chip.** *"Status: Pausada · Prioridade: Alta"* não precisa concordar com
 * nada, é literalmente o que a pessoa marcou, e mantém **um vocabulário só** na tela. Quem monta a frase
 * em volta — *"Em Recanto Azul, com …"* — é a página, que é quem sabe o nome da organização. Foi ao hub
 * como **P2** do plano, e segue pela opção recomendada até alguém dizer o contrário.
 *
 * **`nomeDaCategoria` devolve `undefined` para a categoria desativada que veio na URL** (§3.8 da spec), e
 * aí a cláusula conta em vez de nomear — nunca inventa nome.
 */
export function descricaoDoRecorte(
  filtro: FiltroDeOcorrencias,
  nomeDaCategoria: (id: string) => string | undefined,
): readonly string[] {
  const clausulas: string[] = [];

  if (filtro.status !== undefined) {
    clausulas.push(`Status: ${filtro.status.map(nomeDoStatus).join(", ")}`);
  }

  if (filtro.categoriaId !== undefined) {
    const nomes = filtro.categoriaId.map(nomeDaCategoria).filter((nome) => nome !== undefined);
    clausulas.push(
      nomes.length === filtro.categoriaId.length
        ? `Categoria: ${nomes.join(", ")}`
        : // **`selecionado`, masculino, concordando com o "valor" implícito** — e é a MESMA palavra que o
          // chip usa (`Status: 2 selecionados`, §3.5 da spec). Duas superfícies mostrando o mesmo recorte
          // com duas palavras diferentes seria o começo de dois vocabulários.
          `Categoria: ${filtro.categoriaId.length} selecionado${filtro.categoriaId.length > 1 ? "s" : ""}`,
    );
  }

  if (filtro.prioridade !== undefined) {
    clausulas.push(`Prioridade: ${filtro.prioridade.map(nomeDaPrioridade).join(", ")}`);
  }

  if (filtro.apenasDoAutor === true) clausulas.push("Só as minhas");

  return clausulas;
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
      // **A invariante 9, respondida sem custo:** `OcorrenciaLida.responsavel` existe desde o item 19, e
      // o `left join lateral` que o preenche já é pago pelo `SELECT_DA_OCORRENCIA`. Nenhuma consulta a
      // mais para saber se o botão aparece.
      temResponsavel: lida.responsavel !== null,
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
 * materializada. **`responsavel` vem preenchido desde o item 19**, quando há atribuição vigente — a
 * projeção só repassa o que `OcorrenciaResumoLida` traz, e quem garante *uma no máximo* é
 * `atribuicoes_vigente_uk`, não este arquivo.
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
