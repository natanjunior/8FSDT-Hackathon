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
  /** Sempre `null` nesta fatia: `atribuicoes` é do item 19. */
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
  /** Sempre `null` nesta fatia: `atribuicoes` é o item 19. */
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
   */
  carregar(id: string): Promise<Ocorrencia | null>;

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
