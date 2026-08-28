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
   * **A cópia com um estado novo e um registro a mais.** É o que todo comando de transição faz, e por
   * isso mora num lugar só: os itens 17 a 27 acrescentam o método público e chamam isto.
   */
  private comTransicao(status: StatusOcorrencia, registro: RegistroDeTransicao): Ocorrencia {
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
      [...this._trilha, registro],
      this._anexos,
    );
  }
}
