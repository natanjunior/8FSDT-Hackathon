import { AnexoDaOcorrencia, type DadosDeAnexo } from "./AnexoDaOcorrencia";
import { type MotivoPausa } from "./Motivos";
import { PRIORIDADE_INICIAL, type Prioridade } from "./Prioridade";
import { RegistroDeTransicao } from "./RegistroDeTransicao";
import { ehTerminal, type StatusOcorrencia } from "./StatusOcorrencia";

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
 *    comandos. São **seis** os que transicionam — `registrar`, `analisar`, `iniciarAtendimento`,
 *    `resolver`, `pausar` e `retomar`; os itens 18 e 27 trazem o resto.
 * 1b. **Nem todo comando é transição, e o item 25 é o primeiro.** `registrarSolucaoAplicada` muda um dado
 *    da raiz — `solucao_aplicada` — **sem tocar `status` e sem tocar a trilha**, e por isso não passa por
 *    `comTransicao`. A invariante 1 continua intacta: ele não escreve `status`.
 * 1c. **O item 17 é o segundo caso, e o primeiro com recusa de código próprio.** `alterarPrioridade` muda
 *    `prioridade` — coluna da raiz — **sem tocar `status` e sem tocar a trilha**, e recusa em estado
 *    terminal com `PRIORIDADE_IMUTAVEL_EM_ESTADO_TERMINAL`, que é a **invariante 7** falando com o próprio
 *    nome. A invariante 1 continua intacta: ele não escreve `status`.
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
   * O comando `pausar` — `Em análise` **ou** `Em atendimento` → `Pausada` (critério 23.2), e **o
   * primeiro comando de transição do produto com DOIS estados de origem**.
   *
   * `analisar`, `iniciarAtendimento` e `resolver` têm origem única; esta guarda aceita duas
   * (`MaquinaDeEstados.ts`, `TRANSICOES`), e `cancelar` terá quatro. **Continua sendo `Error` e
   * continua sendo rede, não decisão** — quem decide é `transicaoPermitida`, na Aplicação.
   *
   * **`RegistroDeTransicao.avanco` NÃO serve aqui**, e é o ponto da fatia: `pausada` exige motivo
   * codificado e observação não vazia, e `avanco` recusa este destino de propósito. A porta é `pausa`.
   *
   * **`comTransicao` é chamado sem o terceiro parâmetro, e a omissão é deliberada:** o padrão é *"a
   * solução aplicada que já havia"*, e é exatamente o comportamento correto — pausar uma ocorrência
   * que já tem solução registrada (possível a partir de `em_atendimento`, quando o item 25 existir)
   * **não pode apagá-la**.
   *
   * **O agregado não sabe o que é `retomar`, e o critério 23.3 é sobre isso.** Ele grava
   * `statusAnterior` como grava em toda transição; o que faz o campo servir de alvo do retorno é o
   * item **24** lê-lo — e ele o lê, logo abaixo, em `retomar`. Nada de especial é escrito aqui, e essa
   * ausência **é** o critério: *"não há campo extra para o alvo do retorno"*.
   */
  pausar(entrada: {
    autorPessoaId: string;
    /** ISO 8601. O agregado não lê relógio — quem chama informa o instante. */
    ocorreuEm: string;
    motivo: MotivoPausa;
    /** **Obrigatória** — invariante 5. Quem apara é o comando de aplicação. */
    observacao: string;
  }): Ocorrencia {
    if (this._status !== "em_analise" && this._status !== "em_atendimento") {
      throw new Error(
        `pausar exige status 'em_analise' ou 'em_atendimento'; a ocorrência está '${this._status}' — invariante 1 violada.`,
      );
    }

    return this.comTransicao(
      "pausada",
      RegistroDeTransicao.pausa({
        // **Do último registro, não do tamanho da lista** — o mesmo argumento dos três anteriores.
        sequencia: this.ultimaTransicao.sequencia + 1,
        statusAnterior: this._status,
        ocorreuEm: entrada.ocorreuEm,
        autorPessoaId: entrada.autorPessoaId,
        observacao: entrada.observacao,
        motivoPausa: entrada.motivo,
      }),
    );
  }

  /**
   * O comando `retomar` — `Pausada` → **o status anterior à pausa** (critérios 24.1 a 24.4), e **o
   * único comando do produto cujo destino não está escrito em lugar nenhum**.
   *
   * Os outros quatro sabem para onde vão antes de rodar; este **descobre**, lendo o `statusAnterior`
   * do registro que a pausa gravou. É a invariante 6 da `arquitetura.md` §4 — *"`retomar` usa o
   * `status anterior` do registro de pausa como alvo — **não há campo extra para isso**"* — e é por
   * isso que `TRANSICOES` não responde "para onde": ela responde *"deste status, quais comandos"*.
   *
   * **O alvo é `ultimaTransicao`, e NÃO uma busca para trás procurando o último `statusNovo ===
   * 'pausada'`.** Enquanto o status é `pausada`, o último registro **é** o da pausa, e três fatos
   * estruturais fecham isso: de `pausada` só saem `retomar` e `cancelar`; comando que não transiciona
   * não acrescenta registro; e registro que não muda status é recusado pelo `CHECK`
   * `registros_transicao_mudanca_ck`. Buscar para trás seria uma segunda regra respondendo a mesma
   * pergunta — e uma que continuaria certa se a primeira quebrasse, escondendo a quebra.
   *
   * **A segunda guarda é do critério 24.1**, que diz *"`Em análise` ou `Em atendimento`, **nunca outro
   * destino**"*. `RegistroDeTransicao.statusAnterior` é `StatusOcorrencia | null`, porque ele serve à
   * trilha inteira; sem a guarda, uma linha corrompida apontando `resolvida` faria `retomar` alcançar
   * um **estado terminal pela porta errada**. Custa um `if`; o que ele impede não tem conserto, porque
   * a trilha é append-only.
   *
   * **As duas guardas são `Error`, não `ErroDeDominio`**, pelo mesmo argumento dos quatro comandos
   * anteriores: alcançá-las é defeito nosso, não recusa de negócio. A primeira significa que a
   * Aplicação esqueceu de conferir com `transicaoPermitida`; a segunda, que o banco guarda um registro
   * que os `CHECK` dele não deveriam ter aceitado.
   *
   * **A invariante 9 NÃO vale aqui, e a ausência é decisão** (spec §3.4). A `arquitetura.md` §4 a
   * atribui a **`iniciarAtendimento`, nominalmente** — não a *"chegar em `em_atendimento`"* —, e o
   * fato torna a checagem vazia: para estar pausada vinda de `em_atendimento` a ocorrência já passou
   * pelo `iniciarAtendimento`, que exigiu o responsável, e **não existe comando de desatribuição** em
   * endpoint nenhum.
   *
   * **`RegistroDeTransicao.avanco` serve, e não é acaso:** ela recusa exatamente `pausada` e
   * `cancelada`, os dois destinos que o banco obriga a ter motivo codificado. O destino de `retomar` é
   * sempre um dos dois que ela aceita. **`RegistroDeTransicao` não muda.**
   *
   * **`comTransicao` é chamado sem o terceiro parâmetro, e a omissão é deliberada:** o padrão é *"a
   * solução aplicada que já havia"*. Uma ocorrência pausada a partir de `em_atendimento` pode ter
   * solução registrada (item 25), e retomá-la **não pode apagá-la**. É a mesma omissão do `pausar`.
   */
  retomar(entrada: {
    autorPessoaId: string;
    /** ISO 8601. O agregado não lê relógio — quem chama informa o instante. */
    ocorreuEm: string;
    observacao?: string | null;
  }): Ocorrencia {
    if (this._status !== "pausada") {
      throw new Error(
        `retomar exige status 'pausada'; a ocorrência está '${this._status}' — invariante 1 violada.`,
      );
    }

    const destino = this.ultimaTransicao.statusAnterior;
    if (destino !== "em_analise" && destino !== "em_atendimento") {
      throw new Error(
        `retomar leu '${destino ?? "nulo"}' como destino, e a pausa só sai de 'em_analise' ou ` +
          `'em_atendimento' — o registro de pausa está corrompido (invariante 6).`,
      );
    }

    return this.comTransicao(
      destino,
      RegistroDeTransicao.avanco({
        // **Do último registro, não do tamanho da lista** — o mesmo argumento dos quatro anteriores.
        sequencia: this.ultimaTransicao.sequencia + 1,
        statusAnterior: this._status,
        statusNovo: destino,
        ocorreuEm: entrada.ocorreuEm,
        autorPessoaId: entrada.autorPessoaId,
        observacao: entrada.observacao ?? null,
      }),
    );
  }

  /**
   * O comando `registrarSolucaoAplicada` — **o primeiro do agregado que muda estado sem tocar a trilha**
   * (item 25, critérios 25.1 e 25.2).
   *
   * **Ele participa, e não é escolha de conveniência.** `solucao_aplicada` é coluna de `ocorrencias`,
   * dentro do limite — ver o comentário do campo `_solucaoAplicada`, acima. *"Somente a lógica do agregado
   * pode alterar o seu estado"* (aula 5, p.9) vale para toda coluna da raiz, transicione ela ou não.
   *
   * **A guarda tem DUAS origens**, como a do `pausar`, e a lista sai da tabela companheira
   * (`MaquinaDeEstados.ts`, `SEM_TRANSICAO`) — não há segunda cópia dela aqui. Continua sendo `Error`:
   * alcançá-la significa que a Aplicação esqueceu de conferir com `comandoPermitido`.
   *
   * **A mensagem NÃO termina em *"invariante 1 violada"*, e as seis anteriores terminam.** A invariante 1
   * é sobre `status` nunca ser escrito de fora; **este comando não escreve `status`**. Repeti-la seria
   * citar a invariante errada no único lugar do arquivo em que ela não está em jogo.
   *
   * **`solucaoAplicada` é `string`, e não `string | null`.** Vazio aqui não é ausente: o endpoint declara
   * o campo `required` com `minLength: 1` (`openapi.yaml`), e quem apara é o schema. **Apagar solução
   * aplicada não é capacidade de endpoint nenhum** — é a mesma frase do `resolver`, do outro lado.
   *
   * **Não chama `comTransicao`, e a ausência é o item:** aquele acresce um registro à trilha, e o contrato
   * declara que este comando *"não gera registro de transição"* (§8.4). A porta é `comSolucaoAplicada`.
   */
  registrarSolucaoAplicada(entrada: { solucaoAplicada: string }): Ocorrencia {
    if (this._status !== "em_atendimento" && this._status !== "pausada") {
      throw new Error(
        `registrarSolucaoAplicada exige 'em_atendimento' ou 'pausada'; a ocorrência está '${this._status}'.`,
      );
    }

    return this.comSolucaoAplicada(entrada.solucaoAplicada);
  }

  /**
   * O comando `alterarPrioridade` — **o segundo do agregado que muda a raiz sem tocar a trilha** (item 17,
   * critérios 17.1 e 17.3), e o **primeiro cuja recusa tem código próprio**.
   *
   * **Ele participa pela regra da coluna, não por conveniência.** `prioridade` é coluna de `ocorrencias`,
   * dentro do limite — ver o comentário de `_solucaoAplicada`, acima, que escreve a regra: *"somente a
   * lógica do agregado pode alterar o seu estado"* (aula 5, p.9) vale para toda coluna da raiz.
   *
   * **A guarda lê `ehTerminal`, e NÃO redigita a lista.** Esta é a primeira guarda do arquivo sem uma
   * segunda cópia dos estados: `TERMINAIS` é do próprio módulo (`StatusOcorrencia.ts:29`), e a lista dos
   * quatro estados admitidos é o complemento exato dela. As sete anteriores redigitam; esta não pode
   * divergir da tabela companheira porque não a repete.
   *
   * **A mensagem cita a invariante 7**, que é a que `arquitetura.md:287` numera. A do item 25 não cita
   * nenhuma, e a diferença é o ponto: lá não havia invariante em jogo; aqui há, e ela tem número.
   *
   * **Continua sendo `Error`, e não `ErroDeDominio`.** Alcançá-la significa que a Aplicação esqueceu de
   * conferir com `comandoPermitido` — defeito nosso, não recusa de negócio. **Ela não é o caminho da
   * corrida:** esse é o `status <> all(TERMINAIS)` do repositório.
   *
   * **Não há guarda de valor igual, e a ausência é decisão.** Trocar `normal` por `normal` devolve
   * instância nova e a porta grava: o agregado não sabe se a escrita vale a pena, e o `<select>` da tela
   * não dispara `change` sem mudança. Inventar a recusa aqui criaria um erro para uma requisição que o
   * contrato aceita.
   *
   * **Não chama `comTransicao`, e a ausência é o item:** aquele acresce um registro à trilha, e o contrato
   * declara que este comando *"não gera registro de transição"* (`contrato-de-api.md:1206`). A porta é
   * `comPrioridade`.
   */
  alterarPrioridade(entrada: { prioridade: Prioridade }): Ocorrencia {
    if (ehTerminal(this._status)) {
      throw new Error(
        `alterarPrioridade não age em estado terminal; a ocorrência está '${this._status}' — invariante 7 violada.`,
      );
    }

    return this.comPrioridade(entrada.prioridade);
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

  /**
   * **A cópia com uma coluna trocada, e a trilha intacta.** É o irmão de `comTransicao`, e existe para que
   * o nome diga o que a diferença é: **há dois jeitos de copiar este agregado** — com um estado novo e um
   * registro a mais, ou com um dado da raiz trocado e nada na trilha.
   *
   * *Alternativa recusada — generalizar `comTransicao` num `copia({ status?, solucaoAplicada?, registro? })`:*
   * indireção nova para **um** chamador, e os seis comandos existentes passariam a montar objeto onde hoje
   * passam três argumentos. Refatoração de seis caminhos para economizar uma chamada de construtor.
   *
   * **O custo aceito, declarado:** o construtor privado passa a ter **três** sítios de chamada. Ele é
   * privado e posicional, então um campo novo quebra os três **em tempo de compilação** — o esquecimento é
   * alto, não silencioso, que é o mesmo argumento que fez `solucaoAplicada` nascer obrigatória em
   * `DadosDeReconstituicao`.
   */
  private comSolucaoAplicada(solucaoAplicada: string): Ocorrencia {
    return new Ocorrencia(
      this.titulo,
      this.descricao,
      this.categoriaId,
      this.areaId,
      this.areaTipo,
      this.localizacaoComplemento,
      this.autorPessoaId,
      this.registradaEm,
      // **`_status` e `_trilha` atravessam intactos**, e é a diferença inteira para `comTransicao`.
      this._status,
      this._prioridade,
      solucaoAplicada,
      // Cópia, e não a referência: `reconstituir` já copia, e duas instâncias imutáveis compartilhando o
      // mesmo array é seguro hoje e deixa de ser no dia em que alguém escrever dentro do limite.
      [...this._trilha],
      this._anexos,
    );
  }

  /**
   * **A cópia com a prioridade trocada — o TERCEIRO jeito de copiar este agregado.** Irmão de
   * `comTransicao` e de `comSolucaoAplicada`, e existe pela mesma razão que aquele: **o nome diz qual é a
   * diferença**.
   *
   * *Alternativa recusada — generalizar `comSolucaoAplicada` num `comRaizAlterada({ solucaoAplicada?,
   * prioridade? })`:* é a mesma alternativa que o item 25 recusou um nível acima, e o argumento sobrevive
   * com dois chamadores em vez de um. Um objeto de campos opcionais devolve ao chamador a chance de não
   * passar nenhum, e os dois nomes dizem o que cada escrita é.
   *
   * **O custo aceito, declarado:** o construtor privado passa a ter **quatro** sítios de chamada. Ele é
   * privado e posicional, então um campo novo quebra os quatro **em tempo de compilação** — o esquecimento
   * é alto, não silencioso, que é o mesmo argumento do item 25.
   */
  private comPrioridade(prioridade: Prioridade): Ocorrencia {
    return new Ocorrencia(
      this.titulo,
      this.descricao,
      this.categoriaId,
      this.areaId,
      this.areaTipo,
      this.localizacaoComplemento,
      this.autorPessoaId,
      this.registradaEm,
      // **`_status`, `_trilha` e `_solucaoAplicada` atravessam intactos.** O primeiro é a invariante 1 não
      // estando em jogo; o segundo é o critério 17.3; o terceiro é não apagar o que o item 25 gravou.
      this._status,
      prioridade,
      this._solucaoAplicada,
      // Cópia, e não a referência — o mesmo argumento de `comSolucaoAplicada`.
      [...this._trilha],
      this._anexos,
    );
  }
}
