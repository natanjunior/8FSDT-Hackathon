import type { AreaSemente, CategoriaSemente, TipoArea } from "@/dominio/organizacao";

/**
 * **As portas da Organização** (ADR-0005, parte 1): a Aplicação declara, a Infraestrutura implementa.
 *
 * Nada aqui é o formato de uma tabela. `OrganizacaoCriada` é o schema `Organizacao` do contrato menos o
 * que a Interface acrescenta; `CategoriaLida` e `AreaLida` são os schemas `Categoria` e `Area` — e
 * nenhum dos dois carrega `organizacao_id`, `criado_por_pessoa_id` ou os relógios de auditoria, que
 * existem no banco e **não sobem**.
 */

/**
 * O que a POL-01 cria, junto, numa transação só.
 *
 * **`codigoPublico` chega pronto**, sorteado pela Aplicação: o repositório não escolhe código, e por isso
 * não tem como escolher um derivado do nome (contrato §8.1). **As duas listas chegam prontas** pela mesma
 * razão — a semente é decisão de domínio, e a Infraestrutura só a insere.
 */
export type NovaOrganizacao = {
  nome: string;
  codigoPublico: string;
  criadaPorPessoaId: string;
  categorias: readonly CategoriaSemente[];
  areas: readonly AreaSemente[];
};

/**
 * O schema `Organizacao` do `openapi.yaml`, do lado de dentro.
 *
 * **As duas contagens são o que foi realmente inserido**, não o tamanho das listas enviadas: é isso que
 * as torna capazes de detectar semente parcial sem uma segunda chamada (modelo §14.3).
 */
export type OrganizacaoCriada = {
  id: string;
  nome: string;
  codigoPublico: string;
  criadoEm: string;
  categoriasSemeadas: number;
  areasSemeadas: number;
};

export interface RepositorioDeOrganizacoes {
  /**
   * Cria organização, vínculo de Gestor e as duas sementes **na mesma transação** — não existe organização
   * com zero categorias (modelo §14.3).
   *
   * A atomicidade é **promessa desta porta**, não parâmetro dela: quem chama não abre transação, não a
   * fecha, e não tem como esquecer.
   *
   * @throws CodigoPublicoEmUso quando o `codigoPublico` já pertence a outra organização.
   */
  criar(nova: NovaOrganizacao): Promise<OrganizacaoCriada>;
}

/** O schema `Categoria` do contrato. `icone` **nunca vem nulo** — a coluna é `NOT NULL`. */
export type CategoriaLida = {
  id: string;
  nome: string;
  icone: string;
  ativa: boolean;
  ordem: number;
};

/** O schema `Area` do contrato. `tipo` é o **vigente**; o congelado mora na ocorrência. */
export type AreaLida = {
  id: string;
  nome: string;
  tipo: TipoArea;
  ativa: boolean;
  ordem: number;
};

/**
 * As duas portas escopadas desta fatia. Nenhuma das duas recebe o identificador da organização — ele está
 * amarrado ao `$1` pelo ponto único (ADR-0003), e o repositório **não tem como saber** qual é.
 */
export interface RepositorioEscopadoDeCategorias {
  listar(opcoes: { apenasAtivas: boolean }): Promise<readonly CategoriaLida[]>;
}

export interface RepositorioEscopadoDeAreas {
  listar(opcoes: { apenasAtivas: boolean }): Promise<readonly AreaLida[]>;
}
