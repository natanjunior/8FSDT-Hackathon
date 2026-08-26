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

  /** O registro que a resposta de todo comando devolve em `ultimaTransicao`. */
  get ultimaTransicao(): RegistroDeTransicao {
    const ultima = this._trilha[this._trilha.length - 1];
    if (ultima === undefined) {
      throw new Error("Ocorrência sem trilha — a invariante 2 foi violada na construção.");
    }
    return ultima;
  }
}
