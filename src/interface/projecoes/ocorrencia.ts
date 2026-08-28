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
  MOTIVOS_DE_PAUSA,
  PRIORIDADES,
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
 * **Alcançável desde o item 23**, que é quem torna `pausada` um estado real. Entre o 23 e o 31 o rótulo
 * do Solicitante — que é o de todo mundo até lá — **já traz o motivo dentro dele**, e por isso a segunda
 * linha de T-03 não sai: quem decide é `segundaLinhaDeMotivo`, logo abaixo, e ela volta sozinha quando o
 * **31** trocar o rótulo do Gestor para *"Pausada"*. É o critério **23.6**.
 */
export function rotuloDeMotivoPausa(motivo: MotivoPausa): string {
  return ROTULO_DE_PAUSA[motivo];
}

/**
 * ============================================================================
 *  O motivo como OPÇÃO DE ESCOLHA — o segundo vocabulário, e ele nasce no item 23
 * ============================================================================
 *
 * `ROTULO_DE_PAUSA` traz a coluna do Solicitante do glossário §4 — *"Parada — esperando material
 * chegar"*. Isso é **o que aconteceu com a ocorrência**, e não serve como opção de um seletor:
 * *"Parada — esperando material chegar"* dentro de um formulário chamado **Motivo** é uma frase
 * respondendo a outra pergunta.
 *
 * **A forma é exatamente a de `nomeDoStatus` × `rotuloDeStatus`**, e o argumento já está escrito neste
 * arquivo: uma responde *"qual conjunto você quer"*, a outra *"o que está acontecendo com a sua
 * ocorrência"*. Aqui a pergunta é ainda mais direta — *o que ela está esperando?*
 *
 * **Isso NÃO é a segunda cópia que o glossário proíbe.** A regra 2 proíbe **frase montada em tempo de
 * execução** (*"Parada, esperando aguardando peça"*), não um segundo vocabulário declarado. É a mesma
 * coisa que a coluna do Gestor já é.
 *
 * **Os quatro textos são transcrição, não texto novo de produto:** saem de
 * `docs/prototipo/telas.html:2405-2423`, e batem com a definição de `Pausada` no glossário §4.
 */
const NOME_DO_MOTIVO_PAUSA: Readonly<Record<MotivoPausa, string>> = {
  aguardando_informacao_solicitante: "Aguardando informação do solicitante",
  aguardando_peca: "Aguardando peça",
  aguardando_autorizacao: "Aguardando autorização",
  aguardando_terceiro: "Aguardando um terceiro",
};

export function nomeDoMotivoPausa(motivo: MotivoPausa): string {
  return NOME_DO_MOTIVO_PAUSA[motivo];
}

/**
 * Os quatro pares **prontos**, para descer por prop até o modal de pausa.
 *
 * **Existe para que `app/` não importe o Domínio**, que é a disciplina que a página mantém desde o
 * item 11. É a mesma forma de `rotulosDeStatus()` e `nomesDeStatus()` em `rotulos.ts`: o navegador não
 * monta rótulo, e a página não conhece `MOTIVOS_DE_PAUSA`.
 *
 * **`valor` é `string`, e não `MotivoPausa`** — quem consome é componente de cliente, e tipo do Domínio
 * não atravessa essa fronteira.
 */
export function opcoesDeMotivoPausa(): readonly { valor: string; rotulo: string }[] {
  return MOTIVOS_DE_PAUSA.map((motivo) => ({ valor: motivo, rotulo: nomeDoMotivoPausa(motivo) }));
}

/**
 * ============================================================================
 *  A segunda linha do item de T-03 — o critério 23.6, e é conserto que se remove sozinho
 * ============================================================================
 *
 * **A segunda linha só sai quando acrescenta informação.** Até o item **31**, o `statusRotulo` de todo
 * mundo é a coluna do Solicitante — e nela `pausada` **já traz o motivo dentro do rótulo**. Imprimir a
 * segunda linha ali produziria, no mesmo item:
 *
 * > Parada — esperando material chegar · Parada — esperando material chegar
 *
 * **A precondição está escrita, e hoje é falsa.** O `glossario.md` condiciona a segunda linha ao
 * rótulo colapsar em *"Pausada"*: *"o motivo precisa viajar como campo próprio ao lado do rótulo —
 * não embutido nele"*. Enquanto não colapsa, o motivo **está** dentro do rótulo e a segunda linha não
 * tem trabalho.
 *
 * **No dia em que o item 31 fizer o rótulo do Gestor virar "Pausada", os textos divergem, a linha
 * volta sozinha, e é o que o critério 14.3 pede.** Esta guarda **não é removida lá** — ela vira
 * verdadeira sozinha.
 *
 * **É uma função, e não duas condições `&&` repetidas nos dois recortes do Gestor.** Duas condições
 * que precisam concordar em dois lugares é o defeito que o item 22 consertou ao criar `acaoPrimaria`.
 */
export function segundaLinhaDeMotivo(
  motivo: MotivoPausa | null,
  statusRotulo: string,
): string | null {
  if (motivo === null) return null;
  const rotulo = rotuloDeMotivoPausa(motivo);
  return rotulo === statusRotulo ? null : rotulo;
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
 * Os três pares **prontos**, para descer por prop até o seletor de T-05 e até a barra de filtros de T-03.
 *
 * **Existe para que `app/` e o navegador não montem rótulo**, que é a mesma razão de `opcoesDeMotivoPausa()`
 * logo acima. Importar `PRIORIDADES` de dentro de um componente de cliente arrastaria `@/dominio/ocorrencia`
 * inteiro para o pacote do navegador.
 *
 * **`valor` é `string`, e não `Prioridade`** — quem consome é componente de cliente, e tipo do Domínio não
 * atravessa essa fronteira. É também o que torna o retorno atribuível a `OpcaoDeFiltro`
 * (`barra-de-filtros.tsx:16`) sem conversão.
 *
 * **Usa `nomeDaPrioridade`, deste módulo, e NÃO o `rotuloDePrioridade` de `componentes/rotulos.ts`** — os
 * dois devolvem as mesmas três palavras, e `rotulos.ts:8` já importa **daqui**: chamá-lo fecharia um ciclo.
 * *(Que existam duas funções para o mesmo texto é achado do plano desta fatia, não conserto dela.)*
 *
 * **A ordem é a de `PRIORIDADES`** — `baixa · normal · alta` —, que é a escala, e é o que faz o seletor ler
 * na mesma direção que o filtro de T-03.
 */
export function opcoesDePrioridade(): readonly { valor: string; rotulo: string }[] {
  return PRIORIDADES.map((prioridade) => ({ valor: prioridade, rotulo: nomeDaPrioridade(prioridade) }));
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
