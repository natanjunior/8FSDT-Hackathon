import type { ArmazenamentoDeAnexos } from "@/aplicacao/anexo";
import type { TipoDeAnexo } from "@/dominio/anexo";
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
 */
export type FiltroDeListagem = {
  autorPessoaId?: string;
  /** Quantas linhas ler. **Quem chama pede uma a mais do que vai devolver** (`consultas.ts`). */
  limite: number;
  cursor: CursorDeListagem | null;
  /**
   * **O recorte de G2 — o item 15, e ele mora aqui e não numa consulta separada:** filtrar depois de
   * paginar devolveria páginas de tamanho aleatório e uma última página falsamente vazia. O recorte
   * precisa acontecer **antes** do `limit`.
   *
   * O parâmetro da porta já se chama `filtro`, então lá dentro isto é `filtro.filtro` — feio e correto,
   * e melhor que renomear um tipo que três arquivos já usam.
   */
  filtro?: FiltroDeOcorrencias;
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
 * **`conflito` é a corrida entre dois Gestores**, e o repositório a detecta pelo `23505` na constraint
 * `atribuicoes_vigente_uk`: o segundo `update` de encerramento reavalia o predicado sobre a linha já
 * encerrada pelo primeiro, atualiza zero linhas, e o `insert` dele bate no índice parcial. Traduzir
 * estado de banco em erro de domínio é decisão de **Aplicação** — por isso o repositório devolve um
 * desfecho e não lança, exatamente como em `ResultadoDaTransicao`.
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
   * Quatro instruções e uma releitura, na ordem: o `update` que encerra a atribuição vigente com motivo
   * `reatribuicao`; o `insert … where exists (vínculo ativo)`; o `update ocorrencias set atualizada_em`;
   * e o `lerPorId` de dentro da transação.
   *
   * **A ordem não é estilo.** O `update` vem antes do `insert`, e é o que faz `atribuicoes_vigente_uk`
   * nunca ser violado no caminho normal.
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
   * Uma página da listagem, em `registrada_em DESC, id DESC`.
   *
   * **Ordenação fixa, e não há parâmetro para mudá-la** (S-A11): só existe um índice de listagem, e
   * ordenar por outra coluna seria varredura da partição inteira a cada página.
   *
   * Devolve **até** `filtro.limite` linhas. Saber se há mais é de quem chamou — ele pede uma a mais.
   */
  listar(filtro: FiltroDeListagem): Promise<readonly OcorrenciaResumoLida[]>;
  /** Do mais antigo para o mais recente, por `sequencia`. **Não há `atualizar` nem `apagar`** aqui, e a
   *  ausência é a invariante 3 expressa em tipo. */
  trilha(ocorrenciaId: string): Promise<readonly TransicaoLida[]>;
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
