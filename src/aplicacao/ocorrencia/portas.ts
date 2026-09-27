import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import type { TipoDeAnexo } from "@/dominio/anexo";
import type { Papel } from "@/dominio/organizacao";
import type {
  Comando,
  MotivoCancelamento,
  MotivoPausa,
  Ocorrencia,
  Prioridade,
  StatusOcorrencia,
  TipoDeAreaCongelado,
} from "@/dominio/ocorrencia";

/** Como uma Pessoa aparece **dentro** de um recurso escopado. Nunca traz contato (contrato §4.6). */
export type PessoaReferencia = { pessoaId: string; nome: string };

/** Uma pessoa dentro do compartilhamento: a referência de sempre, mais o papel NESTA organização. */
export type PessoaComPapel = PessoaReferencia & { papel: Papel };

/**
 * Um compartilhamento, como a leitura o devolve — item 87.
 *
 * **Só de vínculo ATIVO de quem recebeu**: o revogado fica na tabela sem efeito e volta na readmissão.
 * **Quem compartilhou aparece mesmo revogado**, como quem transicionou continua nomeado na trilha.
 */
export type CompartilhamentoLido = {
  com: PessoaComPapel;
  por: PessoaComPapel;
  compartilhadoEm: string;
};

/** Um registro da trilha, como a leitura o devolve. Os cinco campos do enunciado. */
export type TransicaoLida = {
  sequencia: number;
  statusAnterior: StatusOcorrencia | null;
  statusNovo: StatusOcorrencia;
  /** ISO 8601 — a conversão do `timestamptz` acontece no repositório. */
  ocorreuEm: string;
  autor: PessoaReferencia;
  observacao: string | null;
  motivoPausa: MotivoPausa | null;
  motivoCancelamento: MotivoCancelamento | null;
};

/**
 * Por que a atribuição terminou. **Declarado aqui e não no Domínio**, porque a atribuição está FORA do
 * agregado — decisão da §3.1 da spec do item 19. Os dois valores são os do `ENUM` do banco
 * (`migrations/…_008_atribuicoes.sql:28`) e os do `openapi.yaml:3038-3041`.
 *
 * **`recusa` não tem produtor nesta entrega**, e entra assim mesmo: ele é do **tipo**, não do endpoint.
 */
export type MotivoEncerramentoDeAtribuicao = "reatribuicao" | "recusa";

/**
 * Uma atribuição, como a leitura a devolve — a **segunda fonte** da linha do tempo (item 29).
 *
 * **Repare no que NÃO está aqui: `id`.** O identificador da atribuição não sai em payload nenhum — o
 * `EventoAtribuicao` do contrato não o tem —, e um modelo de leitura que o carregasse convidaria a
 * inventar `GET /atribuicoes/{id}`, que não existe e não vai existir.
 *
 * **`autor` é quem ATRIBUIU**, nunca o responsável: é a colisão nº 2 do glossário (*"responsável"* tem
 * três significados), e é o campo que o contrato exige em todo evento da linha do tempo.
 *
 * **Vínculo revogado continua saindo nomeado**, pela mesma razão da trilha: revogar não apaga a linha de
 * `vinculos` (modelo §6.4), então o `join` casa igual — quem foi responsável continua nomeado no
 * histórico.
 */
export type AtribuicaoLida = {
  responsavel: PessoaReferencia;
  autor: PessoaReferencia;
  /** ISO 8601 — a conversão do `timestamptz` acontece no repositório. */
  atribuidoEm: string;
  encerradaEm: string | null;
  motivoEncerramento: MotivoEncerramentoDeAtribuicao | null;
};

/**
 * Uma mensagem do canal 1, como a leitura a devolve — a **terceira** fonte da linha do tempo (item 30).
 *
 * **É o schema `Comentario` do contrato, e é ele inteiro** — `{id, texto, autor{pessoaId,nome},
 * criadoEm}` (`openapi.yaml`). O `canalId` **não** está aqui: o canal é detalhe de armazenamento, e o
 * contrato não o publica em lugar nenhum. Expô-lo convidaria um cliente a construir
 * `/canais/{id}/mensagens`, que é o caminho que a §8.6 recusou por escrito.
 *
 * **Não há `editadoEm` nem `excluidoEm`, e a ausência é o critério 30.3.** Não há coluna, não há método
 * na porta, e não há `export` na rota.
 */
export type ComentarioLido = {
  id: string;
  texto: string;
  autor: PessoaReferencia;
  /** ISO 8601 — a conversão do `timestamptz` acontece no repositório. */
  criadoEm: string;
};

/**
 * O ponto de retomada da conversa: **o par que a ordenação da conversa usa**.
 *
 * **É um tipo próprio e não `CursorDeListagem`, e a razão é o nome.** `CursorDeListagem` diz
 * `registradaEm`, que é campo da ocorrência; carregar nele o `criado_em` de uma mensagem faria o nome
 * mentir aqui, em `conversa.ts` e no SQL. **Generalizar os dois para `{ instante, id }` é o certo a
 * longo prazo** e custa renomear um campo em seis sítios do código do 14 e do 15, que esta fatia não tem
 * outra razão para abrir — fica declarado como o conserto barato do dia em que houver um **terceiro**
 * recurso paginado.
 */
export type CursorDeConversa = { criadoEm: string; id: string };

/** O que a leitura paginada da conversa recebe. Quem chama pede **uma linha a mais** do que devolve. */
export type PaginaDeMensagens = { limite: number; cursor: CursorDeConversa | null };

/**
 * O que a escrita da mensagem recebe.
 *
 * **`em` viaja ao lado, como nas três portas irmãs** (`registrarSolucaoAplicada`, `alterarPrioridade`,
 * `avaliar`): `atualizada_em` não é campo da raiz, e aqui não há registro de transição de onde tirá-lo.
 * **Um relógio, lido uma vez** — o mesmo instante carimba `mensagens.criado_em`,
 * `canais_conversa.criado_em` (quando o canal nasce) e `ocorrencias.atualizada_em`.
 */
export type DadosDaMensagem = { autorPessoaId: string; texto: string; em: string };

/**
 * Um anexo, do jeito que a leitura o devolve — o schema `Anexo` do contrato, menos as URLs.
 *
 * **Repare no que NÃO está aqui: `chave` e `thumbnail_chave`.** *"A chave nunca sai"* (modelo §2.8) deixa
 * de ser disciplina e passa a ser **tipo**: não há como vazá-la em payload porque o objeto que alimenta
 * todo payload não a tem. Quem precisa dela é uma leitura só — `objetoDoAnexo`, do `302` —, e ela devolve
 * um tipo estreito que não serve para mais nada.
 */
export type AnexoLido = {
  id: string;
  tipo: TipoDeAnexo;
  titulo: string | null;
  nomeArquivo: string | null;
  tipoConteudo: string;
  tamanhoBytes: number;
  /** Se há prévia. **A projeção monta a URL; ela não precisa da chave para isso.** */
  temMiniatura: boolean;
  anexadoEm: string;
};

/**
 * O modelo de leitura da ocorrência.
 *
 * **Não é a linha do banco, e não é o agregado.** É o que o repositório tem permissão de devolver
 * (ADR-0005), e é o que a projeção transforma em `OcorrenciaDetalhe`. Note o que **não** está aqui:
 * `organizacaoId`, `areaTipo` solto, `acoesDisponiveis`. O primeiro nunca sai; o segundo vive dentro de
 * `area.tipo`; o terceiro é **derivado por quem pergunta** e por isso não é dado gravado.
 */
export type OcorrenciaLida = {
  id: string;
  titulo: string;
  descricao: string;
  status: StatusOcorrencia;
  prioridade: Prioridade;
  categoria: { id: string; nome: string; icone: string };
  /** O `tipo` aqui é o **congelado no registro**, não o atual da Área (modelo §7.5). */
  area: { id: string; nome: string; tipo: TipoDeAreaCongelado };
  localizacaoComplemento: string | null;
  /** Da mais antiga para a mais recente. **Lista vazia quando não há anexo, nunca `null`.** */
  anexos: readonly AnexoLido[];
  autor: PessoaReferencia;
  /** Quem está cuidando **agora** — a atribuição vigente, ou `null` quando não há. Uma no máximo, e quem
   *  garante é o índice `atribuicoes_vigente_uk` (item 19). */
  responsavel: PessoaReferencia | null;
  /** Com quem a ocorrência está compartilhada (item 87). Do mais recente para o mais antigo. Lista
   *  vazia, nunca `null`. */
  compartilhamentos: readonly CompartilhamentoLido[];
  solucaoAplicada: string | null;
  avaliacao: { nota: number; comentario: string | null; avaliadaEm: string } | null;
  motivoPausa: MotivoPausa | null;
  ultimaTransicao: TransicaoLida;
  registradaEm: string;
  atualizadaEm: string;
};

/**
 * Como a ocorrência aparece na **listagem** — o `OcorrenciaResumo` do contrato (§12), e nada além.
 *
 * **Repare no que não está aqui, e é a razão de este tipo existir:** `descricao` (até 5.000 caracteres),
 * a trilha e a `ultimaTransicao` inteira. Numa página de 20 isso é payload que ninguém lê e um `select`
 * que ninguém precisa — e devolver `OcorrenciaLida` na lista seria a forma preguiçosa de fazer o
 * repositório trabalhar por vinte.
 *
 * **`motivoPausa` vem do último registro da trilha**, e é o único campo daqui que não é coluna de
 * `ocorrencias`. Ele está no resumo porque o rótulo do Gestor é sempre *"Pausada"*: sem ele, a lista dele
 * mostraria quatro esperas diferentes com a mesma palavra (`contrato-de-api.md` §8.8).
 */
export type OcorrenciaResumoLida = {
  id: string;
  titulo: string;
  status: StatusOcorrencia;
  prioridade: Prioridade;
  /** **Sem `icone`, de propósito** — critério 14.6. A tela cruza contra `GET /categorias`. */
  categoria: { id: string; nome: string };
  /** O `tipo` é o **congelado no registro**, nunca o atual da Área (modelo §7.5). */
  area: { id: string; nome: string; tipo: TipoDeAreaCongelado };
  autor: PessoaReferencia;
  /** Quem está cuidando **agora** — a atribuição vigente, ou `null` quando não há. Uma no máximo, e quem
   *  garante é o índice `atribuicoes_vigente_uk` (item 19). */
  responsavel: PessoaReferencia | null;
  /**
   * **Contagem, não lista** (contrato §8.8) — a tela só precisa da marca *"com foto"*. Vem de
   * subconsulta correlacionada contra o índice `(organizacao_id, ocorrencia_id)`; `ocorrencias
   * .total_anexos` foi recusada pelo critério da §7.1 do modelo: desnormaliza-se o que é **filtrado ou
   * ordenado**, nunca o que é só projetado.
   */
  quantidadeDeAnexos: number;
  /**
   * **Se a ocorrência já foi avaliada** — `avaliacao_nota is not null` (item 27, critério 27.5).
   *
   * **Booleano, e não a avaliação inteira:** a lista responde *"já foi?"*, não *"quanto foi?"* — a nota e
   * o comentário são conteúdo do detalhe. **E o precedente que recusou `temAnexo` não alcança este
   * caso:** lá o `0..1` é *"por escopo — não por schema"*; aqui é **do schema** — invariante 8, com
   * `CHECK` no banco. Não há segunda avaliação para a qual o booleano quebre.
   *
   * **É FATO da ocorrência, como `status` e `motivoPausa`** — não afazer calculado por leitor. O critério
   * 14.5 não se reabre: `acoesDisponiveis` continua fora do resumo, e quem cruza o fato com quem lê é a
   * tela.
   */
  avaliada: boolean;
  motivoPausa: MotivoPausa | null;
  registradaEm: string;
  atualizadaEm: string;
};

/**
 * O ponto de retomada da paginação: **o par que o índice de listagem ordena**.
 *
 * O `id` não é enfeite — é o desempate. Sem ele, duas ocorrências com o mesmo `registrada_em` deixam a
 * ordem indefinida, e é exatamente aí que um item aparece em duas páginas (critério 14.2).
 */
export type CursorDeListagem = { registradaEm: string; id: string };

/**
 * O que a consulta de listagem recebe.
 *
 * **`autorPessoaId` presente = só as daquela Pessoa.** O repositório **não conhece permissão**: quem
 * traduz *"tem `ocorrencia.ler_todas`"* em *"sem filtro de autor"* é a camada de Aplicação, e é a única
 * que pode — o repositório não vê o `Vinculo`.
 *
 * **`deslocamento`, e não `cursor`** — item 14b, 09/09/2026. A posição da página é numérica sobre um
 * **instante de corte**, e o corte é o que devolve a imunidade que o cursor dava de graça: `registrada_em`
 * nunca muda, então `registrada_em <= ate` é uma fronteira superior imóvel. Ocorrência registrada depois
 * de o leitor abrir a lista **não entra no conjunto** e não empurra ninguém.
 *
 * **O `deslocamento` chega COMPENSADO.** Quem o calcula é `listarOcorrencias`, e o repositório não sabe
 * que houve compensação — para ele é um `offset`. A razão está na §3.3 da spec: o corte protege contra
 * inserção e **não** protege contra o item que sai do recorte.
 */
export type FiltroDeListagem = {
  autorPessoaId?: string;
  /** Quantas linhas devolver. **Já não se pede uma a mais**: o `total` diz se há próxima. */
  limite: number;
  /** Quantas pular. Já compensado (§3.3). Nunca negativo. */
  deslocamento: number;
  /** ISO 8601 com fuso — a fronteira superior imóvel do conjunto. */
  ate: string;
  /**
   * **O recorte de G2 — o item 15, e ele mora aqui e não numa consulta separada:** filtrar depois de
   * paginar devolveria páginas de tamanho aleatório e uma última página falsamente vazia. O recorte
   * precisa acontecer **antes** do `limit`.
   *
   * O parâmetro da porta já se chama `filtro`, então lá dentro isto é `filtro.filtro` — feio e correto,
   * e melhor que renomear um tipo que três arquivos já usam.
   */
  filtro?: FiltroDeOcorrencias;
  /**
   * A ordem da página (item 67). **Ausente é o padrão**: `atualizada_em` decrescente. Não entra em
   * `FiltroDeOcorrencias` porque não recorta: a contagem é a mesma em qualquer ordem.
   */
  ordenacao?: OrdenacaoDeOcorrencias;
};

/**
 * O que a consulta do painel recebe — e **os três identificadores não são o mesmo**.
 *
 * É a sutileza da §3.6 da spec virada tipo. `autorPessoaId` é a **visibilidade do painel**: vem só da
 * permissão, e ausente significa *"quem chamou tem `ler_todas`"*. `pessoaIdDeQuemPergunta` é **quem está
 * lendo**, e serve a um `FILTER` só — o de `minhas`.
 *
 * **Se os dois fossem um, `minhas` seria igual a `total` sempre que `?autor=eu` estivesse ligado** — o
 * número que serve para *ligar* o recorte deixaria de existir assim que ele fosse ligado.
 *
 * **`autorPessoaIdDaPagina` é o terceiro, e ele existe porque o `total` mora aqui.** A §3.6 da spec
 * divide a página do painel: a página recorta por permissão **e** por `?autor=eu`; o painel, só por
 * permissão. Como o `total` saiu da consulta da página e virou o quinto `FILTER` desta, ele tem de trazer
 * o recorte da página junto — senão um Gestor com `?autor=eu` recebe o `total` da organização inteira ao
 * lado de uma lista com as próprias, e a navegação numerada passa a oferecer páginas que não existem.
 * **É o mesmo valor que `listar` recebe em `autorPessoaId`**, calculado uma vez só, no mesmo lugar de
 * sempre.
 */
export type FiltroDeContagem = {
  autorPessoaId?: string;
  autorPessoaIdDaPagina?: string;
  pessoaIdDeQuemPergunta: string;
  ate: string;
  /**
   * **Aplicado a `totalFiltrado` e a `novas`; NÃO aos quatro do painel.** A assimetria é deliberada: os
   * quatro do painel respondem *"o que existe para você escolher"* e por isso ignoram o recorte; `totalFiltrado`
   * descreve a lista que está na tela, e `novas` responde *"apertar Atualizar vai mudar essa lista"*. Ver
   * o comentário do SQL.
   */
  filtro?: FiltroDeOcorrencias;
};

/** As seis contagens, como o repositório as devolve. */
export type ContagensLidas = {
  /**
   * O tamanho do conjunto **filtrado**, no corte — o `total` do envelope e o insumo da compensação.
   *
   * **Mora aqui e não num `count(*) over ()` da consulta da página**, e a razão é de custo: a função de
   * janela obriga a consumir o conjunto filtrado inteiro antes de emitir a primeira linha, porque o
   * `limit` para a saída e não a entrada. Contando aqui, a página continua sendo `limit/offset` sobre o
   * índice, e o número sai da consulta que já ia varrer a partição para o painel.
   */
  totalFiltrado: number;
  /**
   * Quantas existem sob a visibilidade de quem pergunta, no corte — **sem** os três filtros de G2 e
   * **sem** o recorte de autor da página. É a regra de `minhas`, do outro lado: os dois números existem
   * para o leitor **escolher o recorte**, e por isso medem o mesmo conjunto.
   */
  todas: number;
  minhas: number;
  emAberto: number;
  semResponsavel: number;
  /** As que ficaram **fora** do corte — `registrada_em > ate`, sob o recorte da página. */
  novas: number;
};

/**
 * O recorte que `GET /ocorrencias` aceita — os três de G2 mais *"só as minhas"* (item 15).
 *
 * **Campo ausente é "não filtre por esta dimensão"**, e não uma lista vazia: lista vazia significaria
 * *"nenhum valor serve"*, que é um pedido diferente e que nenhuma tela produz.
 *
 * **`apenasDoAutor` é `boolean`, não a string `"eu"`.** `eu` é vocabulário de URL; esta camada recebe a
 * decisão, e quem é *"eu"* já está no contexto de quem pergunta.
 */
export type FiltroDeOcorrencias = {
  readonly status?: readonly StatusOcorrencia[];
  readonly categoriaId?: readonly string[];
  readonly prioridade?: readonly Prioridade[];
  readonly apenasDoAutor?: boolean;
  /**
   * O texto como a pessoa digitou, aparado — **não** os termos já partidos. Quem parte em termos é o
   * repositório, que é quem sabe a forma do casamento; a frase do vazio precisa do texto inteiro.
   */
  readonly titulo?: string;
  readonly areaId?: readonly string[];
  readonly responsavelPessoaId?: readonly string[];
};

/**
 * As colunas por que a listagem aceita ordenar (item 67, critério 67.5).
 *
 * **A ordenação fica FORA de `FiltroDeOcorrencias`**, pela mesma razão que o 14b tirou a paginação dele:
 * recorte muda quantas linhas existem, ordem não muda número nenhum. Por isso `FiltroDeContagem` não a
 * recebe.
 */
export const COLUNAS_DE_ORDENACAO = [
  "status",
  "titulo",
  "area",
  "prioridade",
  "responsavel",
  "atualizacao",
] as const;

export type ColunaDeOrdenacao = (typeof COLUNAS_DE_ORDENACAO)[number];

/** Ausente é o padrão: `atualizacao` decrescente. */
export type OrdenacaoDeOcorrencias = {
  readonly ordem: ColunaDeOrdenacao;
  readonly sentido: "crescente" | "decrescente";
};

/**
 * O que o registro pode dar. **Desfecho, não exceção** — é o idioma que `categorias-escopadas.ts` já usa
 * para o nome duplicado, e ele existe porque traduzir código de banco em erro de domínio é decisão de
 * Aplicação, não de repositório.
 */
export type ResultadoDoRegistro =
  | { desfecho: "registrada"; ocorrencia: OcorrenciaLida }
  | { desfecho: "anexo-ja-reivindicado"; ocorrenciaId: string };

/**
 * O que a escrita de uma transição pode dar. **Desfecho, não exceção**, na fronteira da porta — é o
 * idioma que `ResultadoDoRegistro` já usa aqui em cima para o anexo já reivindicado.
 *
 * **`conflito` é a corrida entre dois Gestores**, e o repositório a detecta sem coluna de versão: o
 * `update … where status = <anterior>` devolve zero linhas quando alguém chegou antes. Traduzir estado de
 * banco em erro de domínio é decisão de **Aplicação** — por isso o repositório devolve um desfecho, e
 * não lança.
 */
export type ResultadoDaTransicao =
  | { desfecho: "aplicada"; ocorrencia: OcorrenciaLida }
  | { desfecho: "conflito" };

/** O que a atribuição precisa saber. **O instante é UM**, lido pelo comando de aplicação e transcrito
 *  aqui: ele carimba `atribuido_em`, o `encerrada_em` da anterior e `ocorrencias.atualizada_em`. Dois
 *  relógios produziriam uma ocorrência atualizada milissegundos antes da atribuição que a atualizou. */
export type DadosDaAtribuicao = {
  responsavelPessoaId: string;
  /** Quem comandou. **Nunca vem do corpo**, e não há campo para ele no schema. */
  atribuidoPorPessoaId: string;
  /** ISO 8601. */
  em: string;
};

/**
 * O que a atribuição pode dar. **Desfecho, não exceção**, na fronteira da porta — o idioma que
 * `ResultadoDoRegistro` e `ResultadoDaTransicao` já usam aqui em cima.
 *
 * **`responsavel-sem-vinculo-ativo` nasce do `where exists` do próprio `insert`**, sem leitura prévia: é
 * a doutrina do item 8, e uma leitura antes perde a corrida. O `422` que ele vira é o critério 19.3, e
 * **pessoa de outra organização recebe o mesmo desfecho sem um `if` a mais** — o `$1` é a organização
 * ativa, amarrada pelo escopo, então o vínculo de outra simplesmente não existe para a consulta (§6.3).
 *
 * **`conflito` tem DUAS causas, e a primeira é a que o item 21 acrescentou.** (1) O **estado não admite
 * mais o comando** — a ocorrência virou `resolvida` ou `cancelada` entre o `carregar` e o `COMMIT`, e o
 * guarda de estado da porta atualiza zero linhas; é o critério **21.4** sob corrida. (2) O `23505` em
 * `atribuicoes_vigente_uk`, que desde o item 21 é rede e não caso comum, porque o guarda serializa duas
 * atribuições concorrentes à mesma ocorrência. **As duas viram o mesmo `409`**: o comando relê e responde
 * com o estado de agora. Traduzir estado de banco em erro de domínio é decisão de **Aplicação** — por isso
 * o repositório devolve um desfecho e não lança, exatamente como em `ResultadoDaTransicao`.
 */
export type ResultadoDaAtribuicao =
  | { desfecho: "atribuida"; reatribuicao: boolean; ocorrencia: OcorrenciaLida }
  | { desfecho: "responsavel-sem-vinculo-ativo" }
  | { desfecho: "conflito" };


/**
 * O que a escrita da solução aplicada pode dar. **Desfecho, não exceção**, na fronteira da porta — o
 * idioma que `ResultadoDoRegistro`, `ResultadoDaTransicao` e `ResultadoDaAtribuicao` já usam aqui em cima.
 *
 * **`conflito` NÃO é a corrida de dois textos**, e a distinção é a §7.9 do contrato: dois Gestores
 * gravando solução no mesmo estado é exposição **aceita**, e o segundo vence. O que este desfecho detecta
 * é outra coisa — **o estado mudou entre o `carregar` e o `update`** —, e o que ele impede é escrita em
 * registro fechado: *"mutação silenciosa de registro fechado, que é precisamente o que a ADR-0001 existe
 * para impedir"* (contrato §8.4). Uma cláusula `where status = <o que o agregado leu>` fecha a janela.
 */
export type ResultadoDaSolucaoAplicada =
  | { desfecho: "gravada"; ocorrencia: OcorrenciaLida }
  | { desfecho: "conflito" };

/**
 * O que a alteração de prioridade pode dar. **Desfecho, não exceção**, na fronteira da porta — o idioma que
 * `ResultadoDoRegistro`, `ResultadoDaTransicao`, `ResultadoDaAtribuicao` e `ResultadoDaSolucaoAplicada` já
 * usam aqui em cima.
 *
 * **`conflito` significa UMA coisa e só uma: *"virou terminal entre a leitura e a escrita"***. Não há
 * segundo caso — `carregar` já provou que a linha existe nesta organização, e não existe `DELETE` de
 * ocorrência em endpoint nenhum. É a diferença para `ResultadoDaSolucaoAplicada`, cujo `conflito` significa
 * *"o estado mudou"* e por isso alcança estados que ainda admitem o comando (achado A-5 da spec do 17).
 *
 * **Movimento LEGAL entre a leitura e a escrita não é conflito:** `aberta → em_analise` grava, porque a
 * prioridade continua alterável nos quatro estados. Quem quiser ver por quê, o predicado está no
 * repositório e a razão está na §3.4 da spec — o `409` deste comando nomeia um fato, e o
 * `inventario-de-telas.md:1532-1536` decidiu que ele **não tem frase de tela própria**, então ele não pode
 * aparecer sobre um caso em que a frase publicada mente.
 *
 * **E o que ele NÃO detecta, por decisão de contrato:** dois Gestores alterando a prioridade no mesmo
 * estado — o segundo vence, sem aviso. É um dos **dois** pontos que a §7.9 nomeia como exposição aceita.
 * O que o produto passa a ter contra o toque errado é a **janela de conserto** do critério 17.7, na tela.
 */
export type ResultadoDaPrioridade =
  | { desfecho: "alterada"; ocorrencia: OcorrenciaLida }
  | { desfecho: "conflito" };

/**
 * O desfecho da porta do item 27 — **e o `conflito` aqui detecta DUAS coisas, não uma.**
 *
 * Nas duas portas irmãs (`ResultadoDaSolucaoAplicada` e `ResultadoDaPrioridade`) o `conflito` significa
 * *"o estado mudou entre a leitura e a escrita"*. **Aqui ele significa isso OU *"alguém já avaliou entre
 * a leitura e a escrita"***, porque o predicado tem duas metades — e a segunda é a única que reprova de
 * verdade, já que `resolvida` é terminal.
 *
 * **Quem traduz é o comando de aplicação**, relendo: transformar erro do banco em erro de domínio é
 * decisão de **Aplicação**, e por isso o repositório devolve um desfecho e não lança.
 */
export type ResultadoDaAvaliacao =
  | { desfecho: "avaliada"; ocorrencia: OcorrenciaLida }
  | { desfecho: "conflito" };

/**
 * ============================================================================
 *  O que a porta de ESCRITA devolve — o agregado, **e o fato que ele não tem**
 * ============================================================================
 *
 * `carregar` devolvia `Ocorrencia | null`, e a justificativa continua valendo inteira: *"devolve o
 * AGREGADO, não `OcorrenciaLida`, e a diferença é a invariante 1"*. **O que a redação não previu é que as
 * invariantes 9 e 10** — as duas que a `arquitetura.md` §4 pôs na Aplicação — **precisam, junto do
 * agregado, de fatos de fora dele**, e precisam deles até para montar o corpo de um `409`:
 * `recusaDeTransicao` deriva `acoesDisponiveis` de quem pergunta, e a partir do item 22 essa derivação
 * pergunta se há responsável.
 *
 * **Por que um envelope e não uma porta nova.** Uma `temResponsavelVigente(id)` seria uma **terceira ida
 * ao banco** em todo comando que precise montar um `409` — hoje são duas —, e abriria a janela entre as
 * duas leituras sem comprar nada. Aqui o fato sai do **mesmo `select`** do agregado, num `exists`
 * correlacionado: nenhuma consulta a mais, nenhum `join`.
 *
 * **Por que não dentro do agregado.** `reconstituir` receber `temResponsavel` moveria a invariante 9 para
 * dentro do limite, contra a `arquitetura.md` §4 e contra a §3.1 da spec do item 19, que pôs a Atribuição
 * **fora** dele. Mudar o lado do limite é decisão de arquitetura, não de fatia.
 *
 * **O lugar já está pronto para o segundo fato do mesmo tipo:** a **invariante 10** — *"`resolver` não
 * exige solução aplicada; depende da configuração da `Organização`"* — é a próxima a precisar disto, e é
 * do item 26.
 */
export type OcorrenciaCarregada = {
  ocorrencia: Ocorrencia;
  /** Há atribuição vigente? A invariante 9, apurada no **mesmo** `select` do agregado. */
  temResponsavel: boolean;
};

export interface RepositorioEscopadoDeOcorrencias {
  /**
   * **Recebe o agregado, não um DTO — e a diferença é a invariante 1.**
   *
   * *"Somente a lógica do agregado pode alterar o seu estado"* (aula 5, p.9). Se esta porta recebesse
   * `{ titulo, descricao, … }` e deixasse `status` e `prioridade` para o `default` do banco, **o
   * agregado não seria a porta**: seria um objeto que ninguém atravessa, e a ADR-0001 valeria por
   * disciplina em vez de por estrutura. Recebendo `Ocorrencia`, o repositório **transcreve** o que o
   * agregado decidiu — incluindo o primeiro registro da trilha, que ele lê de `ocorrencia.trilha`.
   *
   * **Ocorrência + registro num `COMMIT` só**, que é a invariante 2, e é a razão de esta porta receber a
   * transação escopada e não só a consulta.
   */
  registrar(ocorrencia: Ocorrencia): Promise<ResultadoDoRegistro>;

  /**
   * **Devolve o AGREGADO, não `OcorrenciaLida` — e a diferença é a invariante 1.**
   *
   * É o item do DoD que o lint não alcança (*"o repositório devolve agregado ou objeto de leitura
   * declarado"*): para **escrever**, o que volta tem de ser o agregado, senão a invariante 1 vira
   * disciplina. `null` quando não existe **nesta organização** — o repositório escopado não vê as outras.
   *
   * **Não traz anexos**, e o agregado diz isso em voz alta em vez de devolver lista vazia:
   * `AnexoDaOcorrencia` carrega `chave`, e `objetoDoAnexo` é a única leitura do produto que a devolve.
   *
   * **Devolve um ENVELOPE desde o item 22** — `OcorrenciaCarregada`, com o agregado dentro e o fato da
   * invariante 9 ao lado. Ver o comentário do tipo, logo acima.
   */
  carregar(id: string): Promise<OcorrenciaCarregada | null>;

  /**
   * **Transcreve a transição que o agregado decidiu, num `COMMIT` só** — `update` da raiz mais `insert`
   * do registro, que é a invariante 2.
   *
   * **Este método não decide nada.** `status`, `atualizada_em` e os oito campos do registro saem de
   * `ocorrencia` e de `ocorrencia.ultimaTransicao`. O predicado do `update` é o `statusAnterior` do
   * próprio registro — nada foi inventado, e é o controle otimista que o contrato §7.9 afirma existir.
   *
   * **Não há `atualizar` nem `apagar` para `registros_transicao`**, aqui nem em lugar nenhum: a ausência
   * é a invariante 3 expressa em tipo.
   */
  aplicarTransicao(id: string, ocorrencia: Ocorrencia): Promise<ResultadoDaTransicao>;

  /**
   * **Atribui — ou reatribui — o responsável, em UM `COMMIT`.**
   *
   * Três escritas e uma releitura, na ordem: o `update ocorrencias` que **guarda o estado** e carimba
   * `atualizada_em`; o `update` que encerra a atribuição vigente com motivo `reatribuicao`; o
   * `insert … where exists (vínculo ativo)`; e o `lerPorId` de dentro da transação.
   *
   * **A ordem não é estilo.** O guarda vem primeiro porque recusar depois de escrever comitaria o
   * encerramento da atribuição anterior (item 21). E o `update` de encerramento vem antes do `insert`,
   * que é o que faz `atribuicoes_vigente_uk` nunca ser violado no caminho normal.
   *
   * **Não escreve `status` e não escreve na trilha**, e a ausência é o critério 19.4: a trilha é só de
   * status. `ocorrencias` recebe uma coluna e uma só — `atualizada_em` —, porque atribuir é **atividade**
   * na ocorrência (`arquitetura.md` §5.8).
   */
  atribuirResponsavel(ocorrenciaId: string, dados: DadosDaAtribuicao): Promise<ResultadoDaAtribuicao>;

  /**
   * **Grava a solução aplicada, em UM `COMMIT` — e a ausência de `insert` é a invariante 3 aqui.**
   *
   * Uma instrução e uma releitura: o `update` da raiz, seguido do `lerPorId` de dentro da transação. **Não
   * há como este método gravar na trilha, porque ele não tem a instrução** — é o critério 25.1 na camada
   * onde ele é estrutural, e não só testado.
   *
   * **Recebe o AGREGADO — a instância que o comando devolveu.** O valor gravado sai de
   * `ocorrencia.solucaoAplicada`; o predicado sai de `ocorrencia.status`, que o comando **preserva**. Uma
   * instância responde às duas perguntas, e o método continua transcrevendo em vez de decidir.
   *
   * **`em` viaja ao lado porque `atualizada_em` não é campo da raiz** — em `aplicarTransicao` ele sai do
   * registro, e aqui não há registro. O carimbo não é opcional: *"houve atividade nesta ocorrência"*
   * (`arquitetura.md` §5.8), e escrever a solução aplicada é atividade.
   */
  registrarSolucaoAplicada(
    id: string,
    ocorrencia: Ocorrencia,
    em: string,
  ): Promise<ResultadoDaSolucaoAplicada>;

  /**
   * **Altera a prioridade, em UM `COMMIT` — e a ausência de `insert` é o critério 17.3 em estrutura.**
   *
   * Uma instrução e uma releitura: o `update` da raiz, seguido do `lerPorId` de dentro da transação. **Não
   * há como este método gravar na trilha, porque ele não tem a instrução** — e não há como a alteração
   * aparecer na linha do tempo, porque ela também sai da trilha (PA-21).
   *
   * **A assinatura é IDÊNTICA à de `registrarSolucaoAplicada`, e o predicado é diferente.** Aqui ele é
   * `status <> all(TERMINAIS)`: a lista **não sobe pela assinatura** porque é a **invariante 7**, e a
   * invariante mora no Domínio — o repositório a importa de `@/dominio/ocorrencia`, que ele já importa.
   *
   * **Recebe o AGREGADO — a instância que o comando devolveu.** O valor gravado sai de
   * `ocorrencia.prioridade`. **O `status` dela NÃO é o predicado** (é a diferença para a porta vizinha): a
   * instância viaja porque é ela que carrega o valor, e o método continua transcrevendo em vez de decidir.
   *
   * **`em` viaja ao lado porque `atualizada_em` não é campo da raiz** — em `aplicarTransicao` ele sai do
   * registro, e aqui não há registro. O carimbo não é opcional: alterar prioridade é **atividade** na
   * ocorrência (`arquitetura.md` §5.8).
   */
  alterarPrioridade(id: string, ocorrencia: Ocorrencia, em: string): Promise<ResultadoDaPrioridade>;

  /**
   * **A avaliação — um `update`, uma releitura, e NENHUM `insert`** (item 27, critério 27.4).
   *
   * **A assinatura é IDÊNTICA à das duas portas irmãs, e o predicado é diferente das duas.** Aqui ele
   * tem **duas** metades — `status = <o que o agregado leu>` **e** `avaliacao_nota is null` —, e a segunda
   * é a que fecha a janela: `resolvida` é terminal, então a primeira nunca reprova sozinha. É a
   * **invariante 8** no banco, e o `JA_AVALIADA` é código publicado para exatamente este caso.
   *
   * **Recebe o agregado JÁ AVALIADO** — a instância que sai de `Ocorrencia.avaliar` —, e transcreve dela
   * as três colunas. `em` viaja ao lado e é o **mesmo instante** de `avaliadaEm`: `atualizada_em` não é
   * campo da raiz, e dois relógios violariam o `CHECK (avaliada_em >= registrada_em)`.
   */
  avaliar(id: string, ocorrencia: Ocorrencia, em: string): Promise<ResultadoDaAvaliacao>;

  /** `null` quando não existe **nesta organização** — o repositório escopado não vê as outras. */
  porId(id: string): Promise<OcorrenciaLida | null>;

  /**
   * **A única leitura do produto que devolve `chave`, e ela devolve só isso.**
   *
   * Existe para o `302` de `GET /ocorrencias/{id}/anexos/{anexoId}` assinar a SAS. `null` quando o anexo
   * não existe **ou não é desta ocorrência** — os dois casos dão o mesmo `404`, pela §6.3.
   */
  objetoDoAnexo(
    ocorrenciaId: string,
    anexoId: string,
  ): Promise<{ chave: string; thumbnailChave: string | null } | null>;
  /**
   * A linha do par ocorrência e pessoa, ou `null` — item 87.
   *
   * **É `porId` com um filtro a mais, e a mesma regra de vínculo ativo**: quem recebeu e foi revogado
   * responde `null`, porque a linha ficou sem efeito. Existe separada porque quem pergunta aqui é a
   * recusa de escrita, que precisa distinguir *"recebeu"* de *"não alcança"* para escolher entre `403` e
   * `404` — e ela não quer a lista inteira da ocorrência para responder um par.
   */
  compartilhamentoCom(ocorrenciaId: string, comPessoaId: string): Promise<CompartilhamentoLido | null>;
  /**
   * Uma página da listagem, em `registrada_em DESC, id DESC`.
   *
   * **Ordenação fixa, e não há parâmetro para mudá-la** (S-A11): só existe um índice de listagem, e
   * ordenar por outra coluna seria varredura da partição inteira a cada página.
   *
   * Devolve **até** `filtro.limite` linhas, a partir de `filtro.deslocamento`, dentro do corte
   * `registrada_em <= filtro.ate`. **Saber se há mais é do `contar`** — desde o item 14b não se pede
   * uma linha a mais: o `total` responde.
   */
  listar(filtro: FiltroDeListagem): Promise<readonly OcorrenciaResumoLida[]>;
  /**
   * As cinco contagens de `GET /ocorrencias` — **todas sob a mesma visibilidade que a listagem aplica**
   * (item 14b, critério 14b.6).
   *
   * Um `COUNT` sem `autor_pessoa_id` vaza a **existência** de ocorrências que o Solicitante não pode
   * ler: ele não veria os títulos, mas leria o número. É por isso que o `GET /dashboard` **não** foi
   * reusado — o `backlogPorStatus` conta a organização inteira, o que está correto lá, porque só o
   * Gestor o alcança, e seria vazamento aqui.
   */
  contar(filtro: FiltroDeContagem): Promise<ContagensLidas>;
  /** Do mais antigo para o mais recente, por `sequencia`. **Não há `atualizar` nem `apagar`** aqui, e a
   *  ausência é a invariante 3 expressa em tipo. */
  trilha(ocorrenciaId: string): Promise<readonly TransicaoLida[]>;
  /**
   * **Todas as atribuições da ocorrência, da mais antiga para a mais recente** — a segunda fonte da linha
   * do tempo (item 29), pelo índice `atribuicoes_linha_do_tempo_ix`, que o item 19 criou nomeando este.
   *
   * **Sem `limit` e sem filtrar `encerrada_em`, e as duas ausências são o critério 29.3:** *n*
   * atribuições, *n* eventos. O `LATERAL` que preenche `OcorrenciaLida.responsavel` responde outra
   * pergunta — *"quem cuida AGORA"* — e continua respondendo só ela.
   *
   * **Não há `atualizar` nem `apagar` aqui**, e a ausência não é a invariante 3: `atribuicoes` recebe
   * `UPDATE` de propósito, e quem o faz é `atribuirResponsavel`. O que esta porta não faz é escrever.
   */
  atribuicoes(ocorrenciaId: string): Promise<readonly AtribuicaoLida[]>;
  /**
   * **Uma página da conversa, do mais antigo para o mais recente** — canal 1, pelo índice
   * `mensagens_do_canal_ix (canal_id, criado_em)` da migração 009.
   *
   * **Ordem crescente, e ela é do contrato** (`openapi.yaml`: *"Página de comentários, do mais antigo
   * para o mais recente"*), não desta porta. A consequência — numa conversa maior que o `limite`, as
   * mensagens novas estão na **última** página — está declarada no achado **A-2** da spec, com a
   * volumetria que a torna rara (2,5 mensagens por canal, §12 do modelo).
   *
   * Devolve **até** `pagina.limite` linhas. Saber se há mais é de quem chamou — ele pede uma a mais.
   */
  comentarios(ocorrenciaId: string, pagina: PaginaDeMensagens): Promise<readonly ComentarioLido[]>;
  /**
   * **TODAS as mensagens da ocorrência, sem limite e sem cursor** — a terceira fonte da linha do tempo
   * (critério 30.7), e a irmã de `trilha` e de `atribuicoes`, que também não paginam.
   *
   * **É a única das três fontes sem limite natural**, e o custo está declarado: a trilha é limitada pela
   * máquina de estados (~10), as atribuições pelas reatribuições, e as mensagens por ninguém —
   * `POST /comentarios` não tem limite de chamadas nem chave de idempotência (contrato §7.10). **A
   * aposta é a volumetria da §12 do modelo.** Declarar um teto é mudança de `openapi.yaml`, e é do hub.
   *
   * **Método separado de `comentarios`, e não um `limite` opcional.** A linha do tempo nunca pagina, e
   * um parâmetro que ela nunca usa mentiria sobre a leitura. O SQL é o mesmo; só a cauda muda.
   */
  mensagens(ocorrenciaId: string): Promise<readonly ComentarioLido[]>;
  /**
   * **Publica no canal 1, em UM `COMMIT` — e o canal nasce aqui, se ainda não existir.**
   *
   * Quatro instruções e uma releitura, na ordem: o `insert … on conflict do nothing` do canal; o
   * `select` que lê o `id` — **a única fonte do identificador**, exista o canal de antes ou de agora; o
   * `insert` da mensagem; o `update ocorrencias set atualizada_em`; e a releitura da mensagem de dentro
   * da transação.
   *
   * **O caminho da primeira mensagem e o da milésima são o mesmo caminho, sem `if`.** É o que faz a
   * corrida ser ruído em vez de informação: dois Gestores comentando ao mesmo tempo numa ocorrência sem
   * canal — um dos dois `insert` perde para `canais_conversa_tipo_uk`, o `on conflict do nothing` o
   * absorve, e o `select` seguinte devolve o mesmo `id` para os dois. É o oposto de
   * `atribuicoes_vigente_uk`, onde a corrida é informação e vira `409`.
   *
   * **Não escreve `status` e não escreve na trilha**, e a ausência é estrutural: o método não tem a
   * instrução. `ocorrencias` recebe **uma** coluna, `atualizada_em` — porque o carimbo não quer dizer
   * *"esta linha mudou"*, e sim *"houve atividade nesta ocorrência"*, o que **inclui mensagem nova, que
   * é `INSERT` em outra tabela** (`arquitetura.md` §5.8, que cita este caso pelo nome).
   *
   * **Não devolve desfecho, e a ausência de `ResultadoDa…` é decisão:** não há predicado de estado a
   * reprovar. Comentar é admitido nos **seis** estados — o contrato não publica
   * `409 TRANSICAO_NAO_PERMITIDA` neste endpoint —, e a ocorrência de outra organização já virou `404`
   * na Aplicação, antes de esta transação começar.
   */
  comentar(ocorrenciaId: string, dados: DadosDaMensagem): Promise<ComentarioLido>;
}

/** O que o comando de aplicação precisa. Nomeado para o teste montar só isto. */
export type PortasDoRegistro = {
  ocorrencias: RepositorioEscopadoDeOcorrencias;
  categorias: {
    listar(opcoes: { apenasAtivas: boolean }): Promise<readonly { id: string; ativa: boolean }[]>;
  };
  areas: {
    listar(opcoes: { apenasAtivas: boolean }): Promise<
      readonly { id: string; ativa: boolean; tipo: TipoDeAreaCongelado }[]
    >;
  };
  /**
   * **Não é repositório escopado, e por isso não está em `RepositoriosEscopados`.** O adaptador não
   * conhece organização: quem amarra o escopo é o ticket. Quem o entrega ao comando é o `route.ts`,
   * pela terceira lista fechada do lint.
   */
  armazenamento: ArmazenamentoDeAnexos;
};

export type { Comando };
