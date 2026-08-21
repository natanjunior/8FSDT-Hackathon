import { type Papel } from "./Papel";
import { PERMISSOES_POR_PAPEL, type Permissao } from "./Permissao";

/**
 * A ligação entre uma Pessoa, um Papel e uma Organização (glossário §1).
 *
 * Uma Pessoa tem no máximo **um** vínculo por Organização — é a `PRIMARY KEY (pessoa_id, organizacao_id)`
 * do modelo (§6.4) — e pode ter vários vínculos em organizações diferentes (D4, Persona 1B).
 *
 * **Por que o Vínculo mora sob `dominio/organizacao/`.** A `arquitetura.md` §2 lista seis agregados e
 * `Vínculo` não é um deles. Ele é escopado por `organizacao_id`, é criado e revogado por um Gestor daquela
 * Organização, e não existe fora dela — então o limite de consistência a que ele pertence é o da
 * `Organização`. A `Pessoa` é global e sobrevive à revogação do vínculo. Ver o achado nº 4 do relatório
 * desta tarefa: nenhum documento decide isso, e esta é a leitura adotada.
 */
export class Vinculo {
  private constructor(
    readonly pessoaId: string,
    readonly organizacaoId: string,
    readonly papel: Papel,
  ) {}

  static de(pessoaId: string, organizacaoId: string, papel: Papel): Vinculo {
    return new Vinculo(pessoaId, organizacaoId, papel);
  }

  /**
   * **A única pergunta de autorização do sistema.**
   *
   * Contrato §4.5: as checagens perguntam `vinculo.pode(X)`, **nunca** `vinculo.papel == GESTOR`. É o
   * princípio de segregação de interface da CA aula 1 (p.9) aplicado onde ele paga: depende-se do
   * comportamento autorizado, não do papel concreto.
   */
  pode(permissao: Permissao): boolean {
    return this.permissoes.includes(permissao);
  }

  /** A lista que a interface usa para desenhar (ou esconder) ações — `Contexto.permissoes` do contrato. */
  get permissoes(): readonly Permissao[] {
    return PERMISSOES_POR_PAPEL[this.papel];
  }
}
