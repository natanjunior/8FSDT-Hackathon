import { AnexoDaOcorrencia, type DadosDeAnexo } from "./AnexoDaOcorrencia";
import { PRIORIDADE_INICIAL, type Prioridade } from "./Prioridade";
import { RegistroDeTransicao } from "./RegistroDeTransicao";
import { type StatusOcorrencia } from "./StatusOcorrencia";

/** O tipo da Área, congelado no registro. Repetido aqui e não importado: `dominio/ocorrencia` não
 *  importa `dominio/organizacao` — módulos irmãos não se atravessam (ADR-0006, regra 5). */
export type TipoDeAreaCongelado = "comum" | "privativa";

export type DadosDeRegistro = {
  titulo: string;
  descricao: string;
  categoriaId: string;
  areaId: string;
  /** A cópia de `areas.tipo` **no instante do registro** — quem a lê é a Aplicação (modelo §7.5). */
  areaTipo: TipoDeAreaCongelado;
  localizacaoComplemento: string | null;
  autorPessoaId: string;
  /** ISO 8601. O agregado não lê relógio — isso o torna testável sem congelar o tempo. */
  ocorreuEm: string;
  /**
   * As evidências reivindicadas **no ato do registro**. Ausente é lista vazia.
   *
   * **Chegam já apuradas**, como `areaTipo` chega: conferir ticket, ler o objeto e trocar a etiqueta é
   * conversa com o mundo, e conversa com o mundo é do comando de aplicação, nunca do agregado.
   */
  anexos?: readonly DadosDeAnexo[];
};

/** O que o repositório devolve ao reidratar a raiz. **Sem `id`**: quem gera identidade é o banco. */
export type DadosDeReconstituicao = {
  titulo: string;
  descricao: string;
  categoriaId: string;
  areaId: string;
  areaTipo: TipoDeAreaCongelado;
  localizacaoComplemento: string | null;
  autorPessoaId: string;
  registradaEm: string;
  status: StatusOcorrencia;
  prioridade: Prioridade;
  /**
   * **A solução aplicada, ou `null`.** Obrigatório, e **não** opcional com padrão `null`: o esquecimento
   * aqui é destrutivo e silencioso. Com padrão, um `montarAgregado` que não a passasse faria **todo**
   * `aplicarTransicao` — inclusive o do `analisar` — apagar a coluna. Obrigatório, o compilador cobra os
   * três chamadores que existem. É o mesmo argumento que fez `temResponsavel` nascer obrigatório no 22.
   */
  solucaoAplicada: string | null;
  /** **A trilha inteira, da origem à última.** Trilha parcial dentro do agregado é mentira no lugar
   *  onde a invariante 3 mora — e quem lesse cinco registros de um agregado que tem oito não teria
   *  como saber. O tamanho é limitado pela máquina de estados: meia dúzia de linhas por ocorrência. */
  trilha: readonly RegistroDeTransicao[];
};

/**
 * ============================================================================
 *  A raiz do agregado — consistência forçada (aula 5, p.9)
 * ============================================================================
 *
 * *"Somente a lógica do agregado pode alterar o seu estado."* As invariantes que esta classe carrega:
 *
 * 1. **`status` nunca é escrito de fora** — não há setter, o campo é privado, e a única porta são os
 *    comandos. `registrar` é o único desta fatia; os outros dez chegam nos itens 16 a 27.
 * 2. **Toda transição produz exatamente um registro**, na mesma operação.
 * 3. **O histórico é append-only** — `trilha` devolve cópia congelada.
 * 4. **A criação gera o primeiro registro, com status anterior nulo** — a premissa **P1**.
 *
 * **O agregado não persiste** (ADR-0005), e é isso que torna o teste dele exaustivo e em milissegundos.
 */
export class Ocorrencia {
  private constructor(
    readonly titulo: string,
    readonly descricao: string,
    readonly categoriaId: string,
    readonly areaId: string,
    readonly areaTipo: TipoDeAreaCongelado,
    readonly localizacaoComplemento: string | null,
    readonly autorPessoaId: string,
    readonly registradaEm: string,
    private readonly _status: StatusOcorrencia,
    private readonly _prioridade: Prioridade,
    /**
     * **Coluna de `ocorrencias`, e portanto DENTRO do limite** — ao contrário de `atribuicoes`, que a
     * spec do item 19 pôs fora de propósito. Quem decide o valor gravado é este objeto; o repositório
     * transcreve (aula 5, p.9).
     */
    private readonly _solucaoAplicada: string | null,
    private readonly _trilha: readonly RegistroDeTransicao[],
    /**
     * **`null` significa "não carregado", e não "sem anexo".** O caminho de **escrita** reidrata o
     * agregado sem anexos de propósito: `AnexoDaOcorrencia` carrega `chave`, e *"a chave nunca sai"*
     * (modelo §2.8) é garantido por `SELECT_DOS_ANEXOS` **não a selecionar**. Trazer os anexos de volta
     * abriria a segunda leitura do produto que devolve chave; devolver `[]` seria mentira. Estoura.
     */
    private readonly _anexos: readonly AnexoDaOcorrencia[] | null,
  ) {}

  /**
   * O comando `registrar` — a seta `[*] → Aberta` da máquina de estados.
   *
   * **Três coisas o agregado escreve e o cliente não envia:** `status`, `prioridade` e o registro de
   * transição. A quarta — `areaTipo` — chega já lida da Área, porque ler outra tabela é do comando de
   * aplicação, não do agregado.
   */
  static registrar(dados: DadosDeRegistro): Ocorrencia {
    return new Ocorrencia(
      dados.titulo,
      dados.descricao,
      dados.categoriaId,
      dados.areaId,
      dados.areaTipo,
      dados.localizacaoComplemento,
      dados.autorPessoaId,
      dados.ocorreuEm,
      "aberta",
      PRIORIDADE_INICIAL,
      // **Sempre `null` ao nascer, e `DadosDeRegistro` NÃO ganha o campo** (D-P4): não há o que
      // descrever antes de o atendimento começar, e nenhum schema de entrada o aceita no registro.
      null,
      [
        RegistroDeTransicao.origem({
          ocorreuEm: dados.ocorreuEm,
          autorPessoaId: dados.autorPessoaId,
        }),
      ],
      (dados.anexos ?? []).map((anexo) => AnexoDaOcorrencia.reivindicado(anexo)),
    );
  }

  /**
   * **A volta do banco — a segunda fábrica.**
   *
   * `registrar` cria; esta reidrata. **O agregado continua sem `id`**, e é decisão: quem gera identidade
   * é o banco (`gen_random_uuid()`), e dar `id` ao Domínio o obrigaria a inventar UUID — a mesma conversa
   * com o mundo que o fez não ler relógio. **O `id` viaja ao lado**, nos dois métodos da porta.
   */
  static reconstituir(dados: DadosDeReconstituicao): Ocorrencia {
    if (dados.trilha.length === 0) {
      throw new Error("Ocorrência sem trilha — a invariante 2 foi violada antes desta leitura.");
    }

    return new Ocorrencia(
      dados.titulo,
      dados.descricao,
      dados.categoriaId,
      dados.areaId,
      dados.areaTipo,
      dados.localizacaoComplemento,
      dados.autorPessoaId,
      dados.registradaEm,
      dados.status,
      dados.prioridade,
      dados.solucaoAplicada,
      [...dados.trilha],
      // Ver o comentário do campo: `null` é "não carregado", e o getter estoura em vez de mentir.
      null,
    );
  }

  get status(): StatusOcorrencia {
    return this._status;
  }

  get prioridade(): Prioridade {
    return this._prioridade;
  }

  /**
   * A solução aplicada, ou `null` quando não há.
   *
   * **Existe para o repositório transcrever**, e é isso que mantém a ADR-0001 valendo por estrutura nesta
   * coluna: `aplicarTransicao` lê o que o agregado decidiu, não um valor que viajou por fora dele.
   */
  get solucaoAplicada(): string | null {
    return this._solucaoAplicada;
  }

  /** **Congelada**: quem lê não consegue acrescentar registro por fora do comando (invariante 3). */
  get trilha(): readonly RegistroDeTransicao[] {
    return Object.freeze([...this._trilha]);
  }

  /**
   * **Congelada, pela mesma razão da trilha:** quem lê não consegue pendurar anexo por fora do comando.
   * Lista, e não `anexo | null` — a lista é a forma permanente do contrato; o teto de **um** é escopo, e
   * mora no `maxItems: 1` do schema de entrada (contrato §8.3).
   */
  get anexos(): readonly AnexoDaOcorrencia[] {
    if (this._anexos === null) {
      throw new Error(
        "Agregado reconstituído sem anexos — o caminho de escrita não os carrega. " +
          "Quem precisa de anexo lê o modelo de leitura (OcorrenciaLida.anexos).",
      );
    }
    return Object.freeze([...this._anexos]);
  }

  /** O registro que a resposta de todo comando devolve em `ultimaTransicao`. */
  get ultimaTransicao(): RegistroDeTransicao {
    const ultima = this._trilha[this._trilha.length - 1];
    if (ultima === undefined) {
      throw new Error("Ocorrência sem trilha — a invariante 2 foi violada na construção.");
    }
    return ultima;
  }

  /**
   * O comando `analisar` — a seta `Aberta → Em análise` (F2, critérios 16.1 e 16.2).
   *
   * **Devolve instância nova**, porque `_status` e `_trilha` são `private readonly` e a imutabilidade é o
   * que sustenta a invariante 3.
   *
   * **A guarda aqui é `Error`, não `ErroDeDominio`, e é deliberado.** Alcançá-la significa que a
   * Aplicação esqueceu de conferir com `transicaoPermitida` — defeito nosso, não recusa de negócio —, e é
   * o idioma que este arquivo já usa para invariante violada. **Ela não é o caminho da corrida entre dois
   * Gestores:** esse é o `where status = <anterior>` do repositório.
   */
  analisar(entrada: {
    autorPessoaId: string;
    /** ISO 8601. O agregado não lê relógio — quem chama informa o instante. */
    ocorreuEm: string;
    observacao?: string | null;
  }): Ocorrencia {
    if (this._status !== "aberta") {
      throw new Error(
        `analisar exige status 'aberta'; a ocorrência está '${this._status}' — invariante 1 violada.`,
      );
    }

    return this.comTransicao(
      "em_analise",
      RegistroDeTransicao.avanco({
        // **Do último registro, não do tamanho da lista:** correto mesmo se um dia alguém carregar
        // trilha parcial, e o `unique (ocorrencia_id, sequencia)` continua sendo a rede.
        sequencia: this.ultimaTransicao.sequencia + 1,
        statusAnterior: this._status,
        statusNovo: "em_analise",
        ocorreuEm: entrada.ocorreuEm,
        autorPessoaId: entrada.autorPessoaId,
        observacao: entrada.observacao ?? null,
      }),
    );
  }

  /**
   * O comando `iniciarAtendimento` — a seta `Em análise → Em atendimento` (F2, critério 22.1).
   *
   * **Ele NÃO confere responsável, e a ausência é a decisão.** A invariante 9 — *"`iniciarAtendimento`
   * exige responsável atribuído"* — está classificada pela `arquitetura.md` §4 como **do comando de
   * aplicação**, *"porque atravessa outra tabela no momento em que o comando roda"*. Dar o booleano a
   * este método para que ele pudesse recusar moveria a invariante para dentro do limite por conveniência
   * de teste, e o agregado deixaria de ser testável sem banco — que é a propriedade que separa as oito
   * primeiras invariantes das duas últimas.
   *
   * **A guarda aqui é `Error`, não `ErroDeDominio`**, pelo mesmo argumento do `analisar`: alcançá-la
   * significa que a Aplicação esqueceu de conferir com `transicaoPermitida`. Ela **não** é o caminho da
   * corrida entre dois Gestores: esse é o `where status = <anterior>` do repositório.
   *
   * **`RegistroDeTransicao.avanco` aceita este destino** porque só recusa `pausada` e `cancelada`, os
   * dois que exigem motivo codificado. Nada muda lá.
   */
  iniciarAtendimento(entrada: {
    autorPessoaId: string;
    /** ISO 8601. O agregado não lê relógio — quem chama informa o instante. */
    ocorreuEm: string;
    observacao?: string | null;
  }): Ocorrencia {
    if (this._status !== "em_analise") {
      throw new Error(
        `iniciarAtendimento exige status 'em_analise'; a ocorrência está '${this._status}' — invariante 1 violada.`,
      );
    }

    return this.comTransicao(
      "em_atendimento",
      RegistroDeTransicao.avanco({
        // **Do último registro, não do tamanho da lista** — o mesmo argumento do `analisar`.
        sequencia: this.ultimaTransicao.sequencia + 1,
        statusAnterior: this._status,
        statusNovo: "em_atendimento",
        ocorreuEm: entrada.ocorreuEm,
        autorPessoaId: entrada.autorPessoaId,
        observacao: entrada.observacao ?? null,
      }),
    );
  }

  /**
   * O comando `resolver` — a seta `Em atendimento → Resolvida` (F2, critério 26.1), e **o primeiro
   * estado terminal do produto**.
   *
   * **Ele NÃO confere permissão, e a ausência é a decisão.** O critério 26.3 — *"só o Gestor"* — é
   * autorização, e autorização mora no `comContexto`, com `ocorrencia.resolver` dentro de
   * `SO_DO_GESTOR`. Dar a este método o papel de quem chamou moveria para dentro do limite uma regra que
   * a `arquitetura.md` §5 põe na Interface, e o agregado deixaria de ser testável sem contexto de
   * requisição.
   *
   * **`solucaoAplicada` entra aqui, e é o corpo de UMA requisição** (contrato §8.4): enviada neste
   * comando, *"equivale a chamar `/registrar-solucao-aplicada` antes — e o registro de transição é um
   * só"*. **Ausente ou nula, a que já havia é preservada:** apagar solução aplicada não é capacidade de
   * endpoint nenhum, e `resolvida` congela a coluna — *"não há caminho de volta, e não deve haver"*
   * (contrato §8.4).
   *
   * **A guarda aqui é `Error`, não `ErroDeDominio`**, pelo mesmo argumento dos dois anteriores:
   * alcançá-la significa que a Aplicação esqueceu de conferir com `transicaoPermitida`. Ela **não** é o
   * caminho da corrida entre dois Gestores: esse é o `where status = <anterior>` do repositório.
   *
   * **`RegistroDeTransicao.avanco` aceita este destino** porque só recusa `pausada` e `cancelada`, os
   * dois que exigem motivo codificado. Nada muda lá.
   */
  resolver(entrada: {
    autorPessoaId: string;
    /** ISO 8601. O agregado não lê relógio — quem chama informa o instante. */
    ocorreuEm: string;
    observacao?: string | null;
    /** **Ausente ou `null` = preserva.** Quem transforma `""` em `null` é o comando de aplicação. */
    solucaoAplicada?: string | null;
  }): Ocorrencia {
    if (this._status !== "em_atendimento") {
      throw new Error(
        `resolver exige status 'em_atendimento'; a ocorrência está '${this._status}' — invariante 1 violada.`,
      );
    }

    return this.comTransicao(
      "resolvida",
      RegistroDeTransicao.avanco({
        // **Do último registro, não do tamanho da lista** — o mesmo argumento do `analisar`.
        sequencia: this.ultimaTransicao.sequencia + 1,
        statusAnterior: this._status,
        statusNovo: "resolvida",
        ocorreuEm: entrada.ocorreuEm,
        autorPessoaId: entrada.autorPessoaId,
        observacao: entrada.observacao ?? null,
      }),
      entrada.solucaoAplicada ?? this._solucaoAplicada,
    );
  }

  /**
   * **A cópia com um estado novo e um registro a mais.** É o que todo comando de transição faz, e por
   * isso mora num lugar só: os itens 17 a 27 acrescentam o método público e chamam isto.
   */
  private comTransicao(
    status: StatusOcorrencia,
    registro: RegistroDeTransicao,
    /**
     * **A solução aplicada da instância nova. Ausente = a que já havia.**
     *
     * O padrão é o que mantém `analisar`, `iniciarAtendimento` e os comandos que ainda vão nascer sem uma
     * linha a mais — e é o que impede o defeito simétrico: sem ele, toda transição zeraria a coluna.
     * **Só `resolver` informa este parâmetro** nesta fatia.
     */
    solucaoAplicada: string | null = this._solucaoAplicada,
  ): Ocorrencia {
    return new Ocorrencia(
      this.titulo,
      this.descricao,
      this.categoriaId,
      this.areaId,
      this.areaTipo,
      this.localizacaoComplemento,
      this.autorPessoaId,
      this.registradaEm,
      status,
      this._prioridade,
      solucaoAplicada,
      [...this._trilha, registro],
      this._anexos,
    );
  }
}
