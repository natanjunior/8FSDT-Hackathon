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
  registrar(ocorrencia: Ocorrencia): Promise<OcorrenciaLida>;
  /** `null` quando não existe **nesta organização** — o repositório escopado não vê as outras. */
  porId(id: string): Promise<OcorrenciaLida | null>;
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
};

export type { Comando };
